export type AppRole = 'user' | 'admin' | 'super-admin'
// 與 server/lib/authorization.ts 的 Permission 對齊（client 端不 import server 模組）。
// 議題內容由 talk.vtaiwan.tw 的管理員維護，本站不定義 topic.* 權限。
export type Permission = 'meeting.join' | 'meeting.moderate' | 'transcription.update'

export const SESSION_NOT_FRESH_CODE = 'SESSION_NOT_FRESH' as const

/** 與 server/lib/step-up.ts 的 STEP_UP_PURPOSE 對齊（client 端不 import server 模組） */
export const STEP_UP_PURPOSE = 'step-up' as const

export interface AuthSession {
  user: {
    id: string
    name: string
    email: string
    image: string | null
  }
  role: AppRole
  banned: boolean
  permissions: Permission[]
  /** 是否已通過敏感操作二次驗證；一般登入不會為 true */
  fresh: boolean
  /** 二次驗證到期時間（epoch 毫秒）；未通過時為 null */
  stepUpExpiresAt: number | null
  /** 名稱修改冷卻期剩餘天數；未在冷卻期時為 null。 */
  nameChangeCooldownDays: number | null
}

export async function loadAuthSession(): Promise<AuthSession | null> {
  const response = await fetch('/api/me')
  if (response.status === 401) return null
  if (!response.ok) throw new Error(`Failed to load auth session: ${response.status}`)
  return (await response.json()) as AuthSession
}

export function hasPermission(session: AuthSession | null | undefined, permission: Permission): boolean {
  return !!session && !session.banned && session.permissions.includes(permission)
}

export function isAdminSession(session: AuthSession | null | undefined): boolean {
  return !!session && !session.banned && (session.role === 'admin' || session.role === 'super-admin')
}

export function isSuperAdminSession(session: AuthSession | null | undefined): boolean {
  return !!session && !session.banned && session.role === 'super-admin'
}

/**
 * 「通過了二次驗證，帳號卻沒有管理權限」——一般訪客到不了的狀態，代表登入的是另一個帳號。
 *
 * step-up cookie 只由「OAuth state 帶 purpose=step-up」的回調簽發，且綁定該次登入建立的
 * session（見 server/lib/step-up.ts）。因此 `fresh` 為 true 就表示使用者剛刻意完成二次驗證；
 * 此時角色仍非管理員，最可能是社群帳號的 email 與管理員帳號不同，Better Auth 依 email 找不到
 * 既有使用者而**新建了一個角色為 `user` 的帳號**，並簽發該新帳號的 session——等於被靜默換了身分。
 *
 * 少數情況也可能是管理員在持有有效 cookie 期間被降級／停權，故文案以「目前帳號無權限」為主述。
 *
 * 用 `fresh`（伺服器在載入當下的判定）而非 `needsStepUp`：後者摻入了前端倒數過期，
 * 停留過久就會漏判。
 */
export function isWrongAccountAfterStepUp(session: AuthSession | null | undefined): boolean {
  return !!session && !isAdminSession(session) && session.fresh
}

/**
 * 是否為「需要二次驗證」的錯誤內容。
 * 直接 fetch 得到的是 `{ code }`；Better Auth client（authClient.admin.*）會把回應
 * 內容包成 `{ error: { code } }`，故兩層都認。
 */
export function isSessionNotFreshPayload(payload: unknown): boolean {
  if (!payload || typeof payload !== 'object') return false
  const record = payload as { code?: unknown; error?: unknown }
  if (record.code === SESSION_NOT_FRESH_CODE) return true
  const nested = record.error
  return !!nested && typeof nested === 'object' && (nested as { code?: unknown }).code === SESSION_NOT_FRESH_CODE
}

/** 解析 403 回應是否為二次驗證要求；非 JSON 時回 false。 */
export async function responseRequiresStepUp(response: Response): Promise<boolean> {
  if (response.status !== 403) return false
  try {
    return isSessionNotFreshPayload(await response.clone().json())
  } catch {
    return false
  }
}
