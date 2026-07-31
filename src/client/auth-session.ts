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

export function isAdminSession(session: AuthSession | null | undefined): boolean {
  return session?.role === 'admin' || session?.role === 'super-admin'
}

export function isSuperAdminSession(session: AuthSession | null | undefined): boolean {
  return session?.role === 'super-admin'
}
