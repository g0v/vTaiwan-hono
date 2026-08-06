import { describe, expect, it } from 'vite-plus/test'
import { extractMeetingIdFromFilename, formatMeetingId, matchesTranscriptionQuery, renderOutlinePreview, type Transcription } from '../lib/transcription-format'

function makeItem(overrides: Partial<Transcription> = {}): Transcription {
  return { meeting_id: '20250621', transcription: '逐字稿內容', outline: '## 會議大綱\n\n討論開放資料授權', ...overrides }
}

describe('逐字稿共用格式化', () => {
  it('8 碼會議 ID 加上連字號，其他長度原樣回傳', () => {
    expect(formatMeetingId('20250621')).toBe('2025-06-21')
    expect(formatMeetingId('2025')).toBe('2025')
  })

  it('由檔名取出會議 ID，格式不符回傳空字串', () => {
    expect(extractMeetingIdFromFilename('transcript-2025-06-21.txt')).toBe('20250621')
    expect(extractMeetingIdFromFilename('meeting-notes.txt')).toBe('')
  })

  it('大綱預覽截斷至 500 字並輸出已消毒的 HTML', () => {
    const rendered = renderOutlinePreview('# 標題\n\n<script>alert(1)</script>')
    expect(rendered).toContain('<h1>標題</h1>')
    expect(rendered).not.toContain('<script')

    const preview = renderOutlinePreview('あ'.repeat(600))
    expect(preview).toContain('...')
    expect(preview).not.toContain('あ'.repeat(501))
    expect(renderOutlinePreview('')).toBe('')
  })
})

describe('逐字稿關鍵字比對', () => {
  it('空查詢視為全部符合', () => {
    expect(matchesTranscriptionQuery(makeItem(), '')).toBe(true)
    expect(matchesTranscriptionQuery(makeItem(), '   ')).toBe(true)
  })

  it('比對會議 ID 與大綱內容，忽略大小寫與前後空白', () => {
    expect(matchesTranscriptionQuery(makeItem(), '202506')).toBe(true)
    expect(matchesTranscriptionQuery(makeItem(), ' 開放資料 ')).toBe(true)
    expect(matchesTranscriptionQuery(makeItem({ outline: 'Open Data' }), 'open')).toBe(true)
    expect(matchesTranscriptionQuery(makeItem(), '不存在的關鍵字')).toBe(false)
  })

  it('不比對逐字稿全文（僅 ID 與大綱）', () => {
    expect(matchesTranscriptionQuery(makeItem({ transcription: '祕密關鍵字' }), '祕密關鍵字')).toBe(false)
  })
})
