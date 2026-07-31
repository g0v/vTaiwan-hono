import { createAuth } from './createAuth'
import type { AppBindings } from '../../api/types'

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

export function hasSameOrigin(requestUrl: string, origin: string | undefined): boolean {
  return origin === undefined || origin === new URL(requestUrl).origin
}

// 管理專用 API 的存取判定（純函式，可單元測試）：一般使用者一律擋下。
// 順序：變更類請求先做同源檢查（擋 CSRF）→ 必須已登入（401）→ 必須為管理員（403）。
// GET/HEAD 等安全方法不強制同源（跨站也讀不到需登入的回應），但仍要求管理員身分。
export type AdminAccessOutcome = { ok: true } | { ok: false; status: 401 | 403 }

export function evaluateAdminAccess(params: { method: string; url: string; origin: string | undefined; context: AuthContext | null }): AdminAccessOutcome {
  const { method, url, origin, context } = params
  const isSafeMethod = method === 'GET' || method === 'HEAD'
  if (!isSafeMethod && !hasSameOrigin(url, origin)) return { ok: false, status: 403 }
  if (!context) return { ok: false, status: 401 }
  if (!isAdminRole(context.role)) return { ok: false, status: 403 }
  return { ok: true }
}

export async function getAuthContext(env: AppBindings, headers: Headers): Promise<AuthContext | null> {
  const auth = createAuth(env)
  const session = await auth.api.getSession({ headers })
  if (!session) return null

  const role = resolveRole(session.user.role)
  return {
    user: {
      id: session.user.id,
      name: session.user.name,
      email: session.user.email,
      image: session.user.image ?? null,
    },
    role,
    permissions: permissionsForRole(role),
  }
}
