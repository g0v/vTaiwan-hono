import { createAuth } from './createAuth'
import type { AppBindings } from '../../api/types'
import { readStepUpExpiry } from './step-up'

export type AppRole = 'user' | 'admin' | 'super-admin'
export type Permission = 'meeting.join' | 'meeting.moderate' | 'transcription.update' | 'topic.manage'

export interface AuthContext {
  user: {
    id: string
    name: string
    email: string
    image: string | null
  }
  role: AppRole
  permissions: Permission[]
  /**
   * 是否已通過敏感操作二次驗證——見 step-up.ts。
   * 一般登入（含登出後重新登入）不會為 true，必須刻意走一次二次驗證登入。
   */
  fresh: boolean
  /** 二次驗證的到期時間（epoch 毫秒）；未通過時為 null。供前端顯示剩餘時間 */
  stepUpExpiresAt: number | null
}

const permissionsByRole: Record<AppRole, Permission[]> = {
  user: ['meeting.join'],
  admin: ['meeting.join', 'meeting.moderate', 'transcription.update', 'topic.manage'],
  'super-admin': ['meeting.join', 'meeting.moderate', 'transcription.update', 'topic.manage'],
}

export function resolveRole(role: string | null | undefined): AppRole {
  return role === 'admin' || role === 'super-admin' ? role : 'user'
}

// 管理員（含超級管理員）判定——/admin 路由守衛與管理入口顯示的單一來源。
export function isAdminRole(role: AppRole): boolean {
  return role === 'admin' || role === 'super-admin'
}

export function permissionsForRole(role: AppRole): Permission[] {
  return permissionsByRole[role]
}

export function hasPermission(context: AuthContext, permission: Permission): boolean {
  return context.permissions.includes(permission)
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
  const stepUpExpiresAt = await readStepUpExpiry(headers.get('cookie'), session.session.id, env.BETTER_AUTH_SECRET)
  return {
    user: {
      id: session.user.id,
      name: session.user.name,
      email: session.user.email,
      image: session.user.image ?? null,
    },
    role,
    permissions: permissionsForRole(role),
    fresh: stepUpExpiresAt !== null,
    stepUpExpiresAt,
  }
}
