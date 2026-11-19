/**
 * 逐字稿條目的時間戳與順延處理（#153 步驟 1）
 *
 * 釘住三件可觀察行為：
 *   1. 新增條目的 timestamp 是「開始說話」的時間，且送 create: true；編輯維持原 ts、不帶 create。
 *   2. 伺服器順延 ts 後，客戶端用 replaces 移除樂觀更新留下的舊 key，不會同一條目出現兩次。
 *   3. source 只收合法枚舉，其他一律 null。
 */

import { describe, expect, it, vi } from 'vite-plus/test'
import { applyEntrySaved, normalizeTranscriptSource, TRANSCRIPT_SOURCES } from '../lib/transcript-entries'
import JitsiView from '../views/JitsiView.vue'

type Entry = { id: string | null; timestamp: number; speaker: string; text: string; source?: string }

describe('applyEntrySaved：伺服器確認後套用到本機 transcriptData', () => {
  const a: Entry = { id: 'a', timestamp: 1000, speaker: 'A', text: '甲' }
  const b: Entry = { id: 'b', timestamp: 1000, speaker: 'B', text: '乙' }

  it('ts 沒被順延：原地放入，不動其他 key', () => {
    const next = applyEntrySaved({ '1000': a }, a, 1000)
    expect(Object.keys(next)).toEqual(['1000'])
    expect(next['1000']).toBe(a)
  })

  it('ts 被順延：移除樂觀更新的舊 key，放入實際 ts；兩個人的條目都保留', () => {
    // B 的瀏覽器先樂觀地把自己放在 1000；伺服器發現 A 已占用，順延到 1001 並回報 replaces: 1000
    const local = { '1000': b }
    const next = applyEntrySaved(local, { ...b, timestamp: 1001 }, 1000)
    expect(next['1000']).toBeUndefined()
    expect(next['1001']).toEqual({ ...b, timestamp: 1001 })
    // 不修改傳入的物件
    expect(local['1000']).toBe(b)
  })

  it('其他客戶端收到的 entry_saved 不帶 replaces：A 自己正當占用的 1000 不會被刪', () => {
    // 伺服器只把 replaces 回給送出請求的連線（見 meeting-room.test.ts）；其他人收到的是純 entry_saved。
    // 若這裡誤帶 replaces: 1000，A 的條目會被刪掉——第一版實作就犯了這個錯，被測試抓到。
    const next = applyEntrySaved({ '1000': a }, { ...b, timestamp: 1001 })
    expect(next).toEqual({ '1000': a, '1001': { ...b, timestamp: 1001 } })
  })

  it('沒有 replaces（編輯既有條目）：單純覆寫同一 key', () => {
    const edited = { ...a, text: '甲（已校對）' }
    const next = applyEntrySaved({ '1000': a }, edited)
    expect(next).toEqual({ '1000': edited })
  })
})

describe('normalizeTranscriptSource：只收合法來源', () => {
  it.each(TRANSCRIPT_SOURCES)('%s 原樣保留', source => {
    expect(normalizeTranscriptSource(source)).toBe(source)
  })

  it.each([undefined, null, '', 'MANUAL', 'firebase', 42, {}])('%j 收斂成 null', value => {
    expect(normalizeTranscriptSource(value)).toBeNull()
  })
})

describe('JitsiView：新增與編輯送出不同的 save_entry', () => {
  type Context = {
    isHistoricalDate: boolean
    today: string
    transcriptData: Record<string, Entry>
    sendMeetingMessage: ReturnType<typeof vi.fn>
    saveTranscriptEntry: (entry: Entry, options: { create: boolean }) => void
  }
  const methods = JitsiView.methods as unknown as {
    addTranscriptData: (this: Context, entry: Entry) => void
    updateTranscriptData: (this: Context, entry: Entry) => void
    saveTranscriptEntry: (this: Context, entry: Entry, options: { create: boolean }) => void
    handleWsMessage: (this: Context, msg: unknown) => void
  }
  function context(): Context {
    const ctx = { isHistoricalDate: false, today: '20261119', transcriptData: {}, sendMeetingMessage: vi.fn() } as unknown as Context
    ctx.saveTranscriptEntry = methods.saveTranscriptEntry.bind(ctx)
    return ctx
  }
  const entry: Entry = { id: 'audio_1000', timestamp: 1000, speaker: '我', text: '大家好', source: 'manual' }

  it('addTranscriptData 樂觀放入本機並送 create: true', () => {
    const ctx = context()
    methods.addTranscriptData.call(ctx, entry)
    expect(ctx.transcriptData['1000']).toBe(entry)
    expect(ctx.sendMeetingMessage).toHaveBeenCalledWith({ type: 'save_entry', entry, create: true })
  })

  it('updateTranscriptData 維持原 ts 並送 create: false', () => {
    const ctx = context()
    const edited = { ...entry, text: '大家好（校對）' }
    methods.updateTranscriptData.call(ctx, edited)
    expect(ctx.sendMeetingMessage).toHaveBeenCalledWith({ type: 'save_entry', entry: edited, create: false })
  })

  it('entry_saved 帶 replaces 時，本機舊 key 被實際 ts 取代', () => {
    const ctx = context()
    ctx.transcriptData = { '1000': entry }
    methods.handleWsMessage.call(ctx, { type: 'entry_saved', entry: { ...entry, timestamp: 1001 }, replaces: 1000 })
    expect(Object.keys(ctx.transcriptData)).toEqual(['1001'])
  })

  it('歷史日期走 REST：伺服器回傳順延後的 timestamp 時重新對 key', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true, timestamp: 1001 })))
    vi.stubGlobal('fetch', fetchMock)
    try {
      const ctx = context()
      ctx.isHistoricalDate = true
      methods.addTranscriptData.call(ctx, entry)
      const [url, request] = fetchMock.mock.calls[0] as [string, { method: string; body: string }]
      expect(url).toBe('/api/meeting/20261119/transcript')
      expect(request.method).toBe('POST')
      expect(JSON.parse(request.body)).toEqual({ ...entry, create: true })
      // 等 fetch → json → 重新對 key 的 promise 鏈跑完
      await new Promise(resolve => setTimeout(resolve, 0))
      expect(Object.keys(ctx.transcriptData)).toEqual(['1001'])
      expect(ctx.sendMeetingMessage).not.toHaveBeenCalled()
    } finally {
      vi.unstubAllGlobals()
    }
  })
})
