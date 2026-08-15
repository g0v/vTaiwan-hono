import type { AppRole, Permission } from '../client/auth-session'

/**
 * 管理後台的角色能力表包含業務權限，以及只由角色判斷的權限管理能力。
 * `permission.manage` 僅供前端矩陣顯示，不是 Worker 端的 Permission。
 */
export type AdminPermissionDisplayKey = Permission | 'permission.manage'

export const ADMIN_PERMISSION_DISPLAY_KEYS: readonly AdminPermissionDisplayKey[] = ['meeting.join', 'meeting.moderate', 'transcription.update', 'permission.manage']

const permissionsByRole: Record<AppRole, readonly AdminPermissionDisplayKey[]> = {
  user: ['meeting.join'],
  admin: ['meeting.join', 'meeting.moderate', 'transcription.update'],
  'super-admin': ['meeting.join', 'meeting.moderate', 'transcription.update', 'permission.manage'],
}

export function roleHasDisplayedPermission(role: AppRole, permission: AdminPermissionDisplayKey): boolean {
  return permissionsByRole[role].includes(permission)
}
