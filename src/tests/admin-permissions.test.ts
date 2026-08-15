import { describe, expect, it } from 'vite-plus/test'
import { createSSRApp } from 'vue'
import { renderToString } from '@vue/server-renderer'
import { createMemoryHistory, createRouter } from 'vue-router'
import { ADMIN_PERMISSION_DISPLAY_KEYS, roleHasDisplayedPermission, type AdminPermissionDisplayKey } from '../lib/admin-permissions'
import { createAppI18n } from '../i18n'
import AdminView from '../views/AdminView.vue'
import type { AppRole, AuthSession } from '../client/auth-session'

const ALL_ROLES: AppRole[] = ['user', 'admin', 'super-admin']

function displayedPermissionsFor(role: AppRole): AdminPermissionDisplayKey[] {
  return ADMIN_PERMISSION_DISPLAY_KEYS.filter(permission => roleHasDisplayedPermission(role, permission))
}

async function renderAdminView(role: 'admin' | 'super-admin'): Promise<string> {
  const authSession: AuthSession = {
    user: { id: role, name: role, email: `${role}@example.com`, image: null },
    role,
    banned: false,
    permissions: ['meeting.join', 'meeting.moderate', 'transcription.update'],
    fresh: true,
    stepUpExpiresAt: null,
    nameChangeCooldownDays: null,
  }
  const app = createSSRApp(AdminView, { authSession, authReady: true })
  const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/', component: { template: '<div />' } }] })
  await router.push('/')
  await router.isReady()
  app.use(router)
  app.use(createAppI18n())
  return renderToString(app)
}

describe('管理後台角色權限矩陣', () => {
  it('依議題 #106 顯示四項能力', () => {
    expect(ADMIN_PERMISSION_DISPLAY_KEYS).toEqual(['meeting.join', 'meeting.moderate', 'transcription.update', 'permission.manage'])
  })

  it('一般管理員具備業務權限，但沒有權限管理能力', () => {
    expect(displayedPermissionsFor('admin')).toEqual(['meeting.join', 'meeting.moderate', 'transcription.update'])
    expect(roleHasDisplayedPermission('admin', 'permission.manage')).toBe(false)
  })

  it('只有超級管理員的權限管理欄打勾', () => {
    expect(ALL_ROLES.filter(role => roleHasDisplayedPermission(role, 'permission.manage'))).toEqual(['super-admin'])
    expect(displayedPermissionsFor('super-admin')).toEqual(ADMIN_PERMISSION_DISPLAY_KEYS)
  })

  it('一般管理員實際看得到唯讀矩陣及權限差異', async () => {
    const html = await renderAdminView('admin')

    expect(html).toContain('角色權限一覽')
    expect(html).toContain('權限管理')
    expect(html).toContain('aria-label="更新逐字稿 — 管理員"')
    expect(html).not.toContain('aria-label="權限管理 — 管理員"')
    expect(html).toContain('aria-label="權限管理 — 超級管理員"')
  })
})
