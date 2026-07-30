import { describe, expect, it } from 'vite-plus/test'
import { hasSameOrigin, permissionsForRole, resolveRole } from '../server/lib/authorization'

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

  it('拒絕跨站 mutation，但允許無 Origin 的非瀏覽器請求', () => {
    const url = 'https://vtaiwan.tw/api/jitsi-token'
    expect(hasSameOrigin(url, 'https://vtaiwan.tw')).toBe(true)
    expect(hasSameOrigin(url, 'https://attacker.example')).toBe(false)
    expect(hasSameOrigin(url, undefined)).toBe(true)
  })
})
