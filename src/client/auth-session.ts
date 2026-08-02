export type AppRole = 'user' | 'admin' | 'super-admin'
export type Permission = 'meeting.join' | 'meeting.moderate' | 'transcription.update' | 'topic.manage'

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
  permissions: Permission[]
  /** 是否已通過敏感操作二次驗證；一般登入不會為 true */
  fresh: boolean
  /** 二次驗證到期時間（epoch 毫秒）；未通過時為 null */
  stepUpExpiresAt: number | null
}

export async function loadAuthSession(): Promise<AuthSession | null> {
  const response = await fetch('/api/me')
  if (response.status === 401) return null
  if (!response.ok) throw new Error(`Failed to load auth session: ${response.status}`)
  return (await response.json()) as AuthSession
}

export function hasPermission(session: AuthSession | null | undefined, permission: Permission): boolean {
  return session?.permissions.includes(permission) ?? false
}

export function isAdminSession(session: AuthSession | null | undefined): boolean {
  return session?.role === 'admin' || session?.role === 'super-admin'
}

export function isSuperAdminSession(session: AuthSession | null | undefined): boolean {
  return session?.role === 'super-admin'
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
