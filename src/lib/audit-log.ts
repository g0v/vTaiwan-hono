// 管理後台變更日誌（#71）的共用型別與純函式。
// 放在 src/lib（而非 server/lib）是因為 AdminView 也要用這些型別——
// 匯入 server/lib 會把 Better Auth 一路拉進 client bundle。

/** 一次撈取／顯示的日誌上限；後台只需查近期變更，不做分頁 */
export const AUDIT_LOG_LIMIT = 200

/** 記錄的變更事件；不只角色變更，逐字稿與大綱的異動同樣入帳 */
export type AuditAction =
  | 'user.create'
  | 'user.role.set'
  | 'user.ban'
  | 'user.unban'
  | 'user.remove'
  | 'user.update'
  | 'user.impersonate'
  | 'user.password.set'
  // ⚠️ 單數 `user.session.revoke`（撤銷指定的一個工作階段）與複數 `user.sessions.revoke`
  // （撤銷該成員全部工作階段）只差一個字母，對應的端點也互為前綴。兩者的路徑對應
  // 在 audit-log.test.ts 有相鄰斷言釘住，改動時別把它們調換。
  | 'user.session.revoke'
  | 'user.sessions.revoke'
  | 'transcription.create'
  | 'transcription.replace'
  | 'transcription.delete'
  | 'transcription.restore'
  | 'transcription.outline.update'
  | 'transcription.outline.restore'

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
  /** 此變更產生／採用的版本（#73）；R2 未設定時不會有值 */
  versionId?: string
  /**
   * **變更前**狀態的版本——變更日誌「回復到變更前版本」按鈕的回復目標。
   * 逐字稿事件指向逐字稿版本，大綱事件指向大綱快照；沒有值代表這筆變更無法回復
   *（例如新增，或 #73 版本功能上線前就存在、且來不及保留舊內容的逐字稿）。
   */
  previousVersionId?: string
  /** 刪除逐字稿時一併保留的大綱快照，讓「回復刪除」能連大綱一起救回 */
  previousOutlineVersionId?: string
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
 * Better Auth admin plugin 中「會改變狀態」的端點 → 事件種類（#74 起已全數涵蓋）。
 * 查詢類（list-users／get-user／has-permission／list-user-sessions）不是變更，不入帳。
 *
 * 其中兩個端點的操作對象不在 request body 的 `userId`，由 `src/api/auth.ts` 另外取得：
 * - `create-user`：解析**成功回應**的 `{ user }` 才拿得到新帳號 id
 * - `revoke-user-session`：以 `sessionToken` 指定，須在 session 被刪掉**之前**反查 userId
 */
const ADMIN_PATH_ACTIONS: Record<string, AuditAction> = {
  '/api/auth/admin/create-user': 'user.create',
  '/api/auth/admin/set-role': 'user.role.set',
  '/api/auth/admin/ban-user': 'user.ban',
  '/api/auth/admin/unban-user': 'user.unban',
  '/api/auth/admin/remove-user': 'user.remove',
  '/api/auth/admin/update-user': 'user.update',
  // 冒用他人身分是審計上最不能漏的一項
  '/api/auth/admin/impersonate-user': 'user.impersonate',
  '/api/auth/admin/set-user-password': 'user.password.set',
  // 單數／複數是兩個不同端點：前者撤銷指定的一個工作階段，後者撤銷該成員全部工作階段
  '/api/auth/admin/revoke-user-session': 'user.session.revoke',
  '/api/auth/admin/revoke-user-sessions': 'user.sessions.revoke',
}

export function auditActionForAdminPath(pathname: string): AuditAction | null {
  return ADMIN_PATH_ACTIONS[pathname] ?? null
}

/** i18n key 不含連字號與多層點號歧義，故以明表對應（vue-i18n 會把點號當路徑） */
const ACTION_LABEL_KEYS: Record<AuditAction, string> = {
  'user.create': 'admin.logs.action.userCreate',
  'user.role.set': 'admin.logs.action.userRoleSet',
  'user.ban': 'admin.logs.action.userBan',
  'user.unban': 'admin.logs.action.userUnban',
  'user.remove': 'admin.logs.action.userRemove',
  'user.update': 'admin.logs.action.userUpdate',
  'user.impersonate': 'admin.logs.action.userImpersonate',
  'user.password.set': 'admin.logs.action.userPasswordSet',
  // key 刻意不叫 userSessionRevoke——與複數的 userSessionsRevoke 只差一個字母，
  // 一旦寫錯是「顯示了另一種事件的文案」這種不會報錯的失敗
  'user.session.revoke': 'admin.logs.action.userSessionRevokeSingle',
  'user.sessions.revoke': 'admin.logs.action.userSessionsRevoke',
  'transcription.create': 'admin.logs.action.transcriptionCreate',
  'transcription.replace': 'admin.logs.action.transcriptionReplace',
  'transcription.delete': 'admin.logs.action.transcriptionDelete',
  'transcription.restore': 'admin.logs.action.transcriptionRestore',
  'transcription.outline.update': 'admin.logs.action.transcriptionOutlineUpdate',
  'transcription.outline.restore': 'admin.logs.action.transcriptionOutlineRestore',
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

/**
 * `revoke-user-session` 的操作對象藏在 `sessionToken` 裡（body 沒有 userId）。
 * 取到 token 後要在動作生效**之前**反查 userId——session 被刪掉就對不回人了。
 */
export function readAdminSessionToken(body: unknown): string | null {
  if (!body || typeof body !== 'object') return null
  const token = (body as { sessionToken?: unknown }).sessionToken
  return typeof token === 'string' && token !== '' ? token : null
}

/**
 * 由 `create-user` 的成功回應（`{ user }`）取出新帳號的審計欄位。
 * 新帳號的 id 只存在於回應中，request body 拿不到。
 */
export function readCreatedAuditUser(body: unknown): { id: string; label: string; role: string | null } | null {
  if (!body || typeof body !== 'object') return null
  const user = (body as { user?: unknown }).user
  if (!user || typeof user !== 'object') return null

  const record = user as { id?: unknown; name?: unknown; email?: unknown; role?: unknown }
  if (typeof record.id !== 'string' || record.id === '') return null

  const name = typeof record.name === 'string' ? record.name : ''
  const email = typeof record.email === 'string' ? record.email : ''
  // 與 findAuditUserTarget 同一套 label 規則：姓名 → 信箱 → id
  const role = Array.isArray(record.role) ? record.role.filter(item => typeof item === 'string').join(',') : typeof record.role === 'string' ? record.role : null
  return { id: record.id, label: name || email || record.id, role: role === '' ? null : role }
}

/** 空物件存 NULL，避免整欄塞滿沒有資訊的 `{}` */
export function serializeAuditDetail(detail: AuditDetail): string | null {
  const entries = Object.entries(detail).filter(([, value]) => value !== undefined && value !== null && value !== '')
  return entries.length === 0 ? null : JSON.stringify(Object.fromEntries(entries))
}

/**
 * 變更日誌「管理操作」欄要送出的指令；`null` 代表該列不顯示按鈕。
 *
 * 只有逐字稿與大綱的變更可回復——角色／停權那類事件沒有「內容版本」可回到。
 * 這是前端顯示與後端呼叫的單一來源，避免兩邊各判一次而漂移。
 */
export type RestoreCommand =
  | { kind: 'transcription'; meetingId: string; versionId: string; outlineVersionId?: string }
  | { kind: 'outline'; meetingId: string; versionId: string }
  | { kind: 'delete'; meetingId: string }

export function restoreCommandFor(entry: AuditEntry): RestoreCommand | null {
  if (entry.target.type !== 'transcription') return null
  const meetingId = entry.target.id
  const versionId = entry.detail.previousVersionId

  switch (entry.action) {
    // 新增之前根本沒有內容，「回到變更前」＝這份逐字稿不存在
    case 'transcription.create':
      return { kind: 'delete', meetingId }
    // 覆蓋／刪除／回復都是換掉整份逐字稿，回得去的前提是變更前那版還在
    case 'transcription.replace':
    case 'transcription.delete':
    case 'transcription.restore':
      return versionId ? { kind: 'transcription', meetingId, versionId, outlineVersionId: entry.detail.previousOutlineVersionId } : null
    case 'transcription.outline.update':
    case 'transcription.outline.restore':
      return versionId ? { kind: 'outline', meetingId, versionId } : null
    default:
      return null
  }
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
  for (const key of ['fromRole', 'toRole', 'reason', 'versionId', 'previousVersionId', 'previousOutlineVersionId'] as const) {
    if (typeof record[key] === 'string') detail[key] = record[key]
  }
  if (typeof record.bytes === 'number' && Number.isFinite(record.bytes)) detail.bytes = record.bytes
  return detail
}
