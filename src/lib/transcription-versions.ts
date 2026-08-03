// 逐字稿版本（#73）的 key 規則與識別碼格式——純函式，SSR / client / Worker 共用。
//
// R2 佈局：
//   `<meeting_id>.txt`                          目前版本（既有 key，維持不變）
//   `versions/<meeting_id>/<versionId>.txt`     每次上傳保留的獨立版本
//
// versionId 採 `YYYYMMDDThhmmssSSSZ`（UTC，毫秒），字典序即時間序，
// 讓 R2 list 的結果不必另外解析時間就能排序。

/** 版本識別碼：20260803T091500123Z（UTC，含毫秒） */
const VERSION_ID_PATTERN = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(\d{3})Z$/

/** 會議 ID 一律為 8 位數字；建 R2 key 前必須驗過，避免把使用者輸入接進物件路徑 */
const MEETING_ID_PATTERN = /^\d{8}$/

export function isValidMeetingId(value: string): boolean {
  return MEETING_ID_PATTERN.test(value)
}

export function isValidVersionId(value: string): boolean {
  return VERSION_ID_PATTERN.test(value)
}

/** epoch 毫秒 → 版本識別碼 */
export function formatVersionId(epochMs: number): string {
  return new Date(epochMs).toISOString().replace(/[-:]/g, '').replace('.', '')
}

/** 版本識別碼 → epoch 毫秒；格式不符回 null（顯示端據此降級為原字串） */
export function parseVersionId(versionId: string): number | null {
  const match = VERSION_ID_PATTERN.exec(versionId)
  if (!match) return null
  const [, year, month, day, hour, minute, second, ms] = match
  const parsed = Date.parse(`${year}-${month}-${day}T${hour}:${minute}:${second}.${ms}Z`)
  return Number.isNaN(parsed) ? null : parsed
}

/** 某場會議所有版本的 R2 key 前綴（結尾的斜線不可省，否則會掃到別場會議） */
export function versionsPrefix(meetingId: string): string {
  return `versions/${meetingId}/`
}

/** 單一版本的 R2 key；meetingId / versionId 需先驗過格式 */
export function versionObjectKey(meetingId: string, versionId: string): string {
  return `${versionsPrefix(meetingId)}${versionId}.txt`
}

/** R2 key → 版本識別碼；不屬於該會議或格式不符回 null */
export function versionIdFromKey(key: string, meetingId: string): string | null {
  const prefix = versionsPrefix(meetingId)
  if (!key.startsWith(prefix) || !key.endsWith('.txt')) return null
  const versionId = key.slice(prefix.length, -'.txt'.length)
  return isValidVersionId(versionId) ? versionId : null
}

/** /api/transcriptions/:meeting_id/versions 回傳的單筆版本 */
export interface TranscriptionVersion {
  version_id: string
  /** 上傳時間（epoch 毫秒）：取自版本識別碼，解析失敗時退回 R2 的 uploaded */
  uploaded_at: number
  size: number
  /** 上傳者信箱快照（舊版本或缺 metadata 時為空字串） */
  uploaded_by: string
  /** 上傳時的原始檔名快照 */
  source_filename: string
}
