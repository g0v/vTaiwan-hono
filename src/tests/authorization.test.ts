import { describe, expect, it } from 'vite-plus/test'
import { isAdminRole, permissionsForRole, resolveRole } from '../server/lib/authorization'
import { adminRoleAccess } from '../server/lib/createAuth'

describe('Better Auth 業務權限', () => {
  it('將未知或缺少的角色降級為 user', () => {
    expect(resolveRole(undefined)).toBe('user')
    expect(resolveRole('legacy-admin')).toBe('user')
  })

  it('admin 擁有目前所有業務管理權限', () => {
    expect(permissionsForRole('admin')).toEqual(['meeting.join', 'meeting.moderate', 'transcription.update', 'topic.manage'])
  })

  it('super-admin 繼承 admin 的業務管理權限', () => {
    expect(permissionsForRole('super-admin')).toEqual(permissionsForRole('admin'))
  })

  it('一般使用者僅能加入會議', () => {
    expect(permissionsForRole('user')).toEqual(['meeting.join'])
  })

  it('僅 admin/super-admin 視為管理員（/admin 守衛與管理入口的判定）', () => {
    expect(isAdminRole('admin')).toBe(true)
    expect(isAdminRole('super-admin')).toBe(true)
    expect(isAdminRole('user')).toBe(false)
  })
})

// 管理端點（/api/auth/admin/*）的授權完全交給 Better Auth admin plugin，
// 而 plugin 是拿 roles[role].authorize(...) 判定的（has-permission.mjs）。
// 這組測試直接釘住那份設定：設定一旦回歸（例如誤把 admin 指到 adminAc），
// 這裡會紅燈——取代先前 Worker 端 requireAdmin() 的縱深防禦角色。
describe('管理端點角色設定 adminRoleAccess', () => {
  it('一般使用者拿不到任何管理權限', () => {
    expect(adminRoleAccess.user.authorize({ user: ['list'] }).success).toBe(false)
    expect(adminRoleAccess.user.authorize({ user: ['set-role'] }).success).toBe(false)
    expect(adminRoleAccess.user.authorize({ user: ['ban'] }).success).toBe(false)
  })

  it('admin 角色目前不得取用管理端點（僅 super-admin 可管理成員）', () => {
    expect(adminRoleAccess.admin.authorize({ user: ['list'] }).success).toBe(false)
    expect(adminRoleAccess.admin.authorize({ user: ['set-role'] }).success).toBe(false)
    expect(adminRoleAccess.admin.authorize({ user: ['ban'] }).success).toBe(false)
  })

  it('super-admin 可列表／改角色／停權', () => {
    expect(adminRoleAccess['super-admin'].authorize({ user: ['list'] }).success).toBe(true)
    expect(adminRoleAccess['super-admin'].authorize({ user: ['set-role'] }).success).toBe(true)
    expect(adminRoleAccess['super-admin'].authorize({ user: ['ban'] }).success).toBe(true)
  })
})
