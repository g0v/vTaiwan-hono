/**
 * meeting_transcript_entries 的 D1 寫入（#153 步驟 1）
 *
 * MeetingRoom DO（今日即時）與 /api/meeting REST（歷史校對）共用同一組寫入規則：
 *
 *   新增（create）：要求的 ts 已被別的條目占用時，往後逐毫秒順延到第一個空位，
 *                   絕不覆蓋別人的條目。回傳實際寫入的 ts，呼叫端廣播／回應給客戶端重新對 key。
 *   編輯（update）：維持原 ts，只改 entry_id / speaker / text；speaker_uid 與 source 保留原值。
 *                   找不到該 ts 時退回新增（舊版客戶端不帶 create 旗標，仍可建立條目）。
 *
 * 為什麼不用 SELECT 找空位再 INSERT：
 *   D1 呼叫不受 DO input gate 保護，兩個 save_entry 可能在 SELECT 與 INSERT 之間交錯。
 *   `INSERT OR IGNORE` 本身是原子操作，changes === 0 就代表撞到主鍵，往後一毫秒再試即可。
 *
 * 只在 Worker 端執行；client 不得 import 本模組。
 */

import type { TranscriptEntry, TranscriptSource } from '../../lib/transcript-entries'

/** 順延找空位的上限；同一毫秒起連續 100 筆被占用在實務上不會發生，超過就視為異常。 */
export const MAX_TIMESTAMP_PROBES = 100

export interface EntryProvenance {
  speakerUid: string | null
  source: TranscriptSource | null
}

const INSERT_IF_FREE = 'INSERT OR IGNORE INTO meeting_transcript_entries (meeting_date, ts, entry_id, speaker, text, speaker_uid, source) VALUES (?, ?, ?, ?, ?, ?, ?)'
const UPDATE_IN_PLACE = 'UPDATE meeting_transcript_entries SET entry_id = ?, speaker = ?, text = ? WHERE meeting_date = ? AND ts = ?'

/**
 * 新增條目：從 entry.timestamp 起找第一個未被占用的 ts 寫入。
 * 回傳實際寫入的條目（timestamp 可能已順延，並帶上伺服器決定的 speakerUid / source）。
 */
export async function insertTranscriptEntry(db: D1Database, date: string, entry: TranscriptEntry, provenance: EntryProvenance): Promise<TranscriptEntry> {
  for (let probe = 0; probe < MAX_TIMESTAMP_PROBES; probe++) {
    const ts = entry.timestamp + probe
    const result = await db
      .prepare(INSERT_IF_FREE)
      .bind(date, ts, entry.id ?? null, entry.speaker ?? null, entry.text, provenance.speakerUid, provenance.source)
      .run()
    if (result.meta.changes > 0) {
      return { ...entry, timestamp: ts, speakerUid: provenance.speakerUid, source: provenance.source }
    }
  }
  throw new Error(`meeting_transcript_entries: ${date} 自 ${entry.timestamp} 起連續 ${MAX_TIMESTAMP_PROBES} 個 ts 皆被占用`)
}

/**
 * 編輯條目：維持原 ts。該 ts 不存在時退回新增（舊版客戶端的 upsert 語意）。
 * 回傳實際寫入的條目。
 */
export async function updateTranscriptEntry(db: D1Database, date: string, entry: TranscriptEntry, provenance: EntryProvenance): Promise<TranscriptEntry> {
  const result = await db
    .prepare(UPDATE_IN_PLACE)
    .bind(entry.id ?? null, entry.speaker ?? null, entry.text, date, entry.timestamp)
    .run()
  if (result.meta.changes > 0) return entry
  return insertTranscriptEntry(db, date, entry, provenance)
}
