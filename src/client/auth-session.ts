export type AppRole = 'user' | 'admin' | 'super-admin'
export type Permission = 'meeting.join' | 'meeting.moderate' | 'transcription.update' | 'topic.manage'

export interface AuthSession {
  user: {
    id: string
    name: string
    email: string
    image: string | null
  }
  role: AppRole
  permissions: Permission[]
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

// 是否為管理員（含超級管理員）——NavBar 管理入口與 AdminView 守衛的顯示層判定。
// 注意：這只是 UX 取捨，真正的安全邊界一律在 Worker 端（見 index.ts /admin 守衛與受保護端點）。
export function isAdminSession(session: AuthSession | null | undefined): boolean {
  return session?.role === 'admin' || session?.role === 'super-admin'
}
