import { describe, expect, it } from 'vite-plus/test'
import { evaluateAdminAccess, hasSameOrigin, isAdminRole, permissionsForRole, resolveRole, type AppRole, type AuthContext } from '../server/lib/authorization'

// 測試用 AuthContext 工廠：只有 role 影響 evaluateAdminAccess 判定。
function contextWithRole(role: AppRole): AuthContext {
  return {
    user: { id: 'u1', name: 'Tester', email: 't@example.com', image: null },
    role,
    permissions: permissionsForRole(role),
  }
}

const ADMIN_URL = 'https://vtaiwan.tw/api/auth/admin/list-users'

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

  it('拒絕跨站 mutation，但允許無 Origin 的非瀏覽器請求', () => {
    const url = 'https://vtaiwan.tw/api/jitsi-token'
    expect(hasSameOrigin(url, 'https://vtaiwan.tw')).toBe(true)
    expect(hasSameOrigin(url, 'https://attacker.example')).toBe(false)
    expect(hasSameOrigin(url, undefined)).toBe(true)
  })
})

describe('管理端點存取守衛 evaluateAdminAccess', () => {
  it('未登入者打 GET（取用戶清單）→ 401', () => {
    expect(evaluateAdminAccess({ method: 'GET', url: ADMIN_URL, origin: undefined, context: null })).toEqual({ ok: false, status: 401 })
  })

  it('一般使用者打 GET（取用戶清單）→ 403', () => {
    expect(evaluateAdminAccess({ method: 'GET', url: ADMIN_URL, origin: undefined, context: contextWithRole('user') })).toEqual({ ok: false, status: 403 })
  })

  it('一般使用者打 POST（變更）→ 403', () => {
    expect(evaluateAdminAccess({ method: 'POST', url: ADMIN_URL, origin: 'https://vtaiwan.tw', context: contextWithRole('user') })).toEqual({ ok: false, status: 403 })
  })

  it('跨站 POST 在驗身分前就先被同源檢查擋下 → 403', () => {
    expect(evaluateAdminAccess({ method: 'POST', url: ADMIN_URL, origin: 'https://attacker.example', context: contextWithRole('super-admin') })).toEqual({ ok: false, status: 403 })
  })

  it('admin / super-admin 同源請求放行', () => {
    expect(evaluateAdminAccess({ method: 'GET', url: ADMIN_URL, origin: 'https://vtaiwan.tw', context: contextWithRole('admin') })).toEqual({ ok: true })
    expect(evaluateAdminAccess({ method: 'POST', url: ADMIN_URL, origin: 'https://vtaiwan.tw', context: contextWithRole('super-admin') })).toEqual({ ok: true })
  })
})
