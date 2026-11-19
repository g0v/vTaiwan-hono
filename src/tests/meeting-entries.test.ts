/**
 * meeting_transcript_entries 寫入規則（#153 步驟 1）
 *
 * 用假的 D1 模擬主鍵 (meeting_date, ts) 的行為，釘住：
 *   - 新增時 ts 被占用 → 順延到第一個空位，絕不覆蓋別人的條目
 *   - 編輯時維持原 ts，保留 speaker_uid / source
 *   - 編輯找不到該 ts → 退回新增（舊版客戶端不帶 create 旗標）
 *   - speaker_uid / source 由呼叫端（伺服器）決定，不是 entry 裡的值
 */

import { describe, expect, it } from 'vite-plus/test'
import { insertTranscriptEntry, MAX_TIMESTAMP_PROBES, updateTranscriptEntry } from '../server/lib/meeting-entries'
import type { TranscriptEntry } from '../lib/transcript-entries'
import { FakeD1 } from './helpers/fake-d1'

const DATE = '20261119'
const db = () => new FakeD1()
const asD1 = (fake: FakeD1) => fake.asD1()
const alice: TranscriptEntry = { id: 'audio_1000', timestamp: 1000, speaker: 'Alice', text: '甲' }
const bob: TranscriptEntry = { id: 'audio_1000b', timestamp: 1000, speaker: 'Bob', text: '乙' }

describe('insertTranscriptEntry：新增不覆蓋', () => {
  it('空位直接寫入，回傳帶伺服器決定的 speakerUid / source', async () => {
    const fake = db()
    const saved = await insertTranscriptEntry(asD1(fake), DATE, { ...alice, speakerUid: '假冒的', source: 'jitsi' }, { speakerUid: 'uid-alice', source: 'manual' })
    expect(saved).toEqual({ ...alice, speakerUid: 'uid-alice', source: 'manual' })
    expect(fake.rows.get(`${DATE}:1000`)).toEqual({ entry_id: 'audio_1000', speaker: 'Alice', text: '甲', speaker_uid: 'uid-alice', source: 'manual' })
  })

  it('同一毫秒兩人寫入：後到的順延到 1001，先到的完整保留', async () => {
    const fake = db()
    await insertTranscriptEntry(asD1(fake), DATE, alice, { speakerUid: 'uid-alice', source: 'manual' })
    const saved = await insertTranscriptEntry(asD1(fake), DATE, bob, { speakerUid: 'uid-bob', source: 'manual' })
    expect(saved.timestamp).toBe(1001)
    expect(fake.rows.get(`${DATE}:1000`)?.text).toBe('甲')
    expect(fake.rows.get(`${DATE}:1001`)?.text).toBe('乙')
    expect(fake.rows.size).toBe(2)
  })

  it('連續多個 ts 被占用：跳到第一個空位', async () => {
    const fake = db()
    for (const ts of [1000, 1001, 1002]) await insertTranscriptEntry(asD1(fake), DATE, { ...alice, timestamp: ts }, { speakerUid: null, source: null })
    const saved = await insertTranscriptEntry(asD1(fake), DATE, bob, { speakerUid: null, source: null })
    expect(saved.timestamp).toBe(1003)
  })

  it('不同日期的同一 ts 互不影響', async () => {
    const fake = db()
    await insertTranscriptEntry(asD1(fake), '20261118', alice, { speakerUid: null, source: null })
    const saved = await insertTranscriptEntry(asD1(fake), DATE, bob, { speakerUid: null, source: null })
    expect(saved.timestamp).toBe(1000)
  })

  it('超過探測上限仍找不到空位就拋錯，不無限迴圈', async () => {
    const fake = db()
    for (let i = 0; i < MAX_TIMESTAMP_PROBES; i++) fake.rows.set(`${DATE}:${1000 + i}`, { entry_id: null, speaker: null, text: 'x', speaker_uid: null, source: null })
    await expect(insertTranscriptEntry(asD1(fake), DATE, alice, { speakerUid: null, source: null })).rejects.toThrow(/皆被占用/)
    expect(fake.executed).toHaveLength(MAX_TIMESTAMP_PROBES)
  })
})

describe('updateTranscriptEntry：編輯原地更新', () => {
  it('既有條目：只改 entry_id / speaker / text，speaker_uid 與 source 保留原值', async () => {
    const fake = db()
    await insertTranscriptEntry(asD1(fake), DATE, alice, { speakerUid: 'uid-alice', source: 'manual' })
    // 另一位校對者（uid-editor）編輯 Alice 的條目
    const saved = await updateTranscriptEntry(asD1(fake), DATE, { ...alice, text: '甲（校對）' }, { speakerUid: 'uid-editor', source: null })
    expect(saved.timestamp).toBe(1000)
    expect(fake.rows.get(`${DATE}:1000`)).toEqual({ entry_id: 'audio_1000', speaker: 'Alice', text: '甲（校對）', speaker_uid: 'uid-alice', source: 'manual' })
    expect(fake.rows.size).toBe(1)
  })

  it('該 ts 不存在：退回新增（舊版客戶端的 upsert 語意）', async () => {
    const fake = db()
    const saved = await updateTranscriptEntry(asD1(fake), DATE, alice, { speakerUid: 'uid-alice', source: null })
    expect(saved.timestamp).toBe(1000)
    expect(fake.rows.get(`${DATE}:1000`)?.speaker_uid).toBe('uid-alice')
    expect(fake.executed[0]).toMatch(/^UPDATE/)
    expect(fake.executed[1]).toMatch(/^INSERT OR IGNORE/)
  })
})
