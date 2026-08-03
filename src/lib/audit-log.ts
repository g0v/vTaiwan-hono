// 管理後台變更日誌（#71）的共用型別與純函式。
// 放在 src/lib（而非 server/lib）是因為 AdminView 也要用這些型別——
// 匯入 server/lib 會把 Better Auth 一路拉進 client bundle。

/** 一次撈取／顯示的日誌上限；後台只需查近期變更，不做分頁 */
export const AUDIT_LOG_LIMIT = 200

/** 記錄的變更事件；不只角色變更，逐字稿與大綱的異動同樣入帳 */
export type AuditAction = 'user.role.set' | 'user.ban' | 'user.unban' | 'user.remove' | 'transcription.create' | 'transcription.replace' | 'transcription.outline.update'

export type AuditTargetType = 'user' | 'transcription'

/**
 * 事件附加資料（JSON 存於 detail 欄）。
 * 角色以字串保存：值在寫入前已由 Worker 端 `resolveRole` 正規化成 AppRole，
 * 但這裡不引入 AppRole 型別，避免 client / server 兩份定義再多一份複本。
 */
export interface AuditDetail {
  fromRole?: string
  toRole?: string
  /** 停權理由（ban-user） */
  reason?: string
  /** 逐字稿上傳保留的版本（#73）；R2 未設定時不會有值 */
  versionId?: string
  /** 逐字稿位元組數 */
  bytes?: number
}

export interface AuditEntry {
  id: number
  /** epoch 毫秒 */
  createdAt: number
  actor: { id: string; name: string; email: string }
  action: AuditAction
  /** label 為寫入當下的顯示名稱快照（使用者姓名／格式化後的會議日期） */
  target: { type: AuditTargetType; id: string; label: string }
  detail: AuditDetail
}

/**
 * Better Auth admin plugin 中「會改變狀態」的端點 → 事件種類。
 * 只列真的有寫入的動作：list-users 等查詢不是變更，不入帳。
 */
const ADMIN_PATH_ACTIONS: Record<string, AuditAction> = {
  '/api/auth/admin/set-role': 'user.role.set',
  '/api/auth/admin/ban-user': 'user.ban',
  '/api/auth/admin/unban-user': 'user.unban',
  '/api/auth/admin/remove-user': 'user.remove',
}

export function auditActionForAdminPath(pathname: string): AuditAction | null {
  return ADMIN_PATH_ACTIONS[pathname] ?? null
}

/** i18n key 不含連字號與多層點號歧義，故以明表對應（vue-i18n 會把點號當路徑） */
const ACTION_LABEL_KEYS: Record<AuditAction, string> = {
  'user.role.set': 'admin.logs.action.userRoleSet',
  'user.ban': 'admin.logs.action.userBan',
  'user.unban': 'admin.logs.action.userUnban',
  'user.remove': 'admin.logs.action.userRemove',
  'transcription.create': 'admin.logs.action.transcriptionCreate',
  'transcription.replace': 'admin.logs.action.transcriptionReplace',
  'transcription.outline.update': 'admin.logs.action.transcriptionOutlineUpdate',
}

export function auditActionLabelKey(action: AuditAction): string {
  return ACTION_LABEL_KEYS[action] ?? 'admin.logs.action.unknown'
}

/**
 * 由 Better Auth admin 端點的請求 body 取出審計要用的欄位。
 * `role` 在 set-role 可能是字串或字串陣列（見 plugin 的 setRoleBodySchema），
 * 這裡與 plugin 的 parseRoles 一致以逗號串接，再交給呼叫端正規化。
 */
export function readAdminActionBody(body: unknown): { userId: string | null; role: string | null; reason: string | null } {
  if (!body || typeof body !== 'object') return { userId: null, role: null, reason: null }
  const record = body as { userId?: unknown; role?: unknown; banReason?: unknown }
  const role = Array.isArray(record.role) ? record.role.filter(item => typeof item === 'string').join(',') : typeof record.role === 'string' ? record.role : null
  return {
    userId: typeof record.userId === 'string' && record.userId !== '' ? record.userId : null,
    role: role === '' ? null : role,
    reason: typeof record.banReason === 'string' && record.banReason !== '' ? record.banReason : null,
  }
}

/** 空物件存 NULL，避免整欄塞滿沒有資訊的 `{}` */
export function serializeAuditDetail(detail: AuditDetail): string | null {
  const entries = Object.entries(detail).filter(([, value]) => value !== undefined && value !== null && value !== '')
  return entries.length === 0 ? null : JSON.stringify(Object.fromEntries(entries))
}

/** 讀取端一律經過此函式：資料庫內容視為外部資料，型別不符的欄位直接丟棄 */
export function parseAuditDetail(raw: unknown): AuditDetail {
  if (typeof raw !== 'string' || raw === '') return {}
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return {}
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {}

  const record = parsed as Record<string, unknown>
  const detail: AuditDetail = {}
  for (const key of ['fromRole', 'toRole', 'reason', 'versionId'] as const) {
    if (typeof record[key] === 'string') detail[key] = record[key]
  }
  if (typeof record.bytes === 'number' && Number.isFinite(record.bytes)) detail.bytes = record.bytes
  return detail
}
