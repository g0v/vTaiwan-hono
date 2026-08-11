import { createAuth } from './createAuth'
import type { AppBindings } from '../../api/types'
import { nameChangeCooldownRemainingDays } from '../../lib/profile-name'
import { readStepUpExpiry } from './step-up'

export type AppRole = 'user' | 'admin' | 'super-admin'
// 只列本專案真的會強制的權限。議題（Topic）的上架與內容修改由 talk.vtaiwan.tw（Discourse）
// 的管理員負責，不屬於本站的授權範圍，故刻意不定義 topic.* 權限。
export type Permission = 'meeting.join' | 'meeting.moderate' | 'transcription.update'

export interface AuthContext {
  user: {
    id: string
    name: string
    email: string
    image: string | null
  }
  role: AppRole
  banned: boolean
  permissions: Permission[]
  /**
   * 是否已通過敏感操作二次驗證——見 step-up.ts。
   * 一般登入（含登出後重新登入）不會為 true，必須刻意走一次二次驗證登入。
   */
  fresh: boolean
  /** 二次驗證的到期時間（epoch 毫秒）；未通過時為 null。供前端顯示剩餘時間 */
  stepUpExpiresAt: number | null
  /** 名稱修改冷卻期剩餘天數；未在冷卻期時為 null。 */
  nameChangeCooldownDays: number | null
}

type UserNameChangeRow = {
  nameChangedAt: string | null
}

const permissionsByRole: Record<AppRole, Permission[]> = {
  user: ['meeting.join'],
  admin: ['meeting.join', 'meeting.moderate', 'transcription.update'],
  'super-admin': ['meeting.join', 'meeting.moderate', 'transcription.update'],
}

export function resolveRole(role: string | null | undefined): AppRole {
  return role === 'admin' || role === 'super-admin' ? role : 'user'
}

// 管理員（含超級管理員）判定——/admin 路由守衛與管理入口顯示的單一來源。
export function isAdminRole(role: AppRole): boolean {
  return role === 'admin' || role === 'super-admin'
}

// 超級管理員判定——成員資料等級的存取（成員列表、變更日誌）用它把關。
// 刻意不做成 Permission：Permission 是「業務權限」，admin 與 super-admin 一致；
// 成員管理層級的差異單一來源在 createAuth.ts 的 adminRoleAccess 與此函式。
export function isSuperAdminRole(role: AppRole): boolean {
  return role === 'super-admin'
}

export function permissionsForRole(role: AppRole): Permission[] {
  return permissionsByRole[role]
}

export function permissionsForAccount(role: AppRole, banned: boolean): Permission[] {
  return banned ? [] : permissionsForRole(role)
}

export function isActiveAdminRole(role: AppRole, banned: boolean): boolean {
  return !banned && isAdminRole(role)
}

export function hasPermission(context: AuthContext, permission: Permission): boolean {
  return !context.banned && context.permissions.includes(permission)
}

/**
 * 讀 session，但把例外（例如缺 D1 綁定、Better Auth 初始化失敗）壓成「未登入」。
 * 授權判斷寧可誤判為未登入回 401，也不要讓例外冒泡成 500 而看起來像端點壞掉。
 */
export async function tryGetAuthContext(env: AppBindings, headers: Headers): Promise<AuthContext | null> {
  try {
    return await getAuthContext(env, headers)
  } catch (error) {
    console.error('Failed to resolve auth context:', error)
    return null
  }
}

export async function getAuthContext(env: AppBindings, headers: Headers): Promise<AuthContext | null> {
  const auth = createAuth(env)
  const session = await auth.api.getSession({ headers })
  if (!session) return null

  const role = resolveRole(session.user.role)
  const banned = session.user.banned === true
  const stepUpExpiresAt = await readStepUpExpiry(headers.get('cookie'), session.session.id, env.BETTER_AUTH_SECRET)
  const user = await env.DB_AUTH.prepare('SELECT "nameChangedAt" FROM "user" WHERE "id" = ?').bind(session.user.id).first<UserNameChangeRow>()
  return {
    user: {
      id: session.user.id,
      name: session.user.name,
      email: session.user.email,
      image: session.user.image ?? null,
    },
    role,
    banned,
    permissions: permissionsForAccount(role, banned),
    fresh: stepUpExpiresAt !== null,
    stepUpExpiresAt,
    nameChangeCooldownDays: nameChangeCooldownRemainingDays(user?.nameChangedAt ?? null),
  }
}
