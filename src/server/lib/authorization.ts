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
