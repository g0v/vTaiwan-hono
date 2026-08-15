import { marked } from 'marked'
import { sanitizeUntrustedHtml } from './html-sanitizer'

// 逐字稿共用的純函式（列表頁、詳情頁、管理後台 tab 3 共用，避免各自複製一份）
// 皆不碰瀏覽器 API，可安全在 SSR 期間執行。

marked.setOptions({ breaks: true, gfm: true })

/** /api/transcription 回傳的逐字稿資料列 */
export interface Transcription {
  meeting_id: string
  transcription: string
  outline: string
}

const OUTLINE_PREVIEW_LENGTH = 500

/** 會議 ID 格式化：20250621 → 2025-06-21（長度非 8 時原樣回傳） */
export function formatMeetingId(id: string): string {
  if (id.length === 8) {
    return `${id.substring(0, 4)}-${id.substring(4, 6)}-${id.substring(6, 8)}`
  }
  return id
}

/** 由檔名取出會議 ID：transcript-2025-06-21.txt → 20250621（不符格式回傳空字串） */
export function extractMeetingIdFromFilename(filename: string): string {
  const match = filename.match(/transcript-(\d{4}-\d{2}-\d{2})/)
  return match ? match[1].replace(/-/g, '') : ''
}

/** 列表關鍵字比對：以會議 ID 與大綱內容為範圍，空查詢視為全部符合 */
export function matchesTranscriptionQuery(item: Transcription, query: string): boolean {
  const q = query.trim().toLowerCase()
  if (!q) return true
  return item.meeting_id.toLowerCase().includes(q) || item.outline.toLowerCase().includes(q)
}

/** Markdown → 已消毒的 HTML（大綱內容屬外部資料，一律經過 sanitizer） */
export function renderMarkdown(markdown: string): string {
  const html = sanitizeUntrustedHtml(marked.parse(markdown) as string)
  // Markdown 表格在窄螢幕不強制壓縮欄位；由容器負責水平捲動，避免撐破整張卡片。
  return html.replace(/<table\b[^>]*>[\s\S]*?<\/table>/g, table => `<div class="transcription-table-scroll">${table}</div>`)
}

/** 列表卡片用的大綱摘要：截斷後再轉 HTML */
export function renderOutlinePreview(outline: string): string {
  if (!outline) return ''
  const truncated = outline.length > OUTLINE_PREVIEW_LENGTH ? outline.substring(0, OUTLINE_PREVIEW_LENGTH) + '...' : outline
  return renderMarkdown(truncated)
}
