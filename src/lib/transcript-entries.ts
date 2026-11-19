/**
 * 即時會議逐字稿條目的共用純邏輯（#153 步驟 1）
 *
 * 前後端共用：JitsiView（瀏覽器）、MeetingRoom DO 與 /api/meeting REST（Worker）都 import 這裡。
 * 不碰瀏覽器 API、不碰 D1；D1 讀寫在 `src/server/lib/meeting-entries.ts`。
 */

/** 條目的產生來源；對應 D1 欄位 `meeting_transcript_entries.source`。 */
export const TRANSCRIPT_SOURCES = ['manual', 'auto', 'jitsi'] as const
export type TranscriptSource = (typeof TRANSCRIPT_SOURCES)[number]

/** 逐字稿條目，對應 JitsiView.transcriptData 的 value 與 D1 的一列。 */
export interface TranscriptEntry {
  id: string | null
  /** 條目的時間戳（Unix ms），同一場次唯一；錄音條目用「開始說話」的時間。 */
  timestamp: number
  speaker: string
  text: string
  /** 說話者帳號 ID，由伺服器依認證結果填入；客戶端送來的值會被忽略。 */
  speakerUid?: string | null
  source?: TranscriptSource | null
}

/** 把客戶端送來的任意值收斂成合法的 source；不認得的一律當 null。 */
export function normalizeTranscriptSource(value: unknown): TranscriptSource | null {
  return typeof value === 'string' && (TRANSCRIPT_SOURCES as readonly string[]).includes(value) ? (value as TranscriptSource) : null
}

/**
 * 伺服器確認條目存好後，套用到本機的 transcriptData。
 *
 * 新增條目時客戶端會先樂觀地用自己要求的 timestamp 放進 transcriptData；
 * 伺服器若發現該 ts 已被別人占用，會往後順延並以 `replaces` 告知原本要求的 ts。
 * 這裡把舊 key 移掉、新 key 放進去，避免同一條目出現兩次。
 * 對其他客戶端而言 `replaces` 對應的 key 本來就不存在，刪除無副作用。
 *
 * 回傳新物件，不修改傳入的 transcriptData。
 */
export function applyEntrySaved<T extends { timestamp: number }>(transcriptData: Record<string, T>, entry: T, replaces?: number): Record<string, T> {
  const next = { ...transcriptData }
  if (replaces !== undefined && replaces !== entry.timestamp) delete next[String(replaces)]
  next[String(entry.timestamp)] = entry
  return next
}
