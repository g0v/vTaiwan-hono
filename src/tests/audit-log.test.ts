import { describe, expect, it } from 'vite-plus/test'
import app from '../index'
import zhTW from '../l10n/zh-TW.json'
import { auditActionForAdminPath, auditActionLabelKey, parseAuditDetail, readAdminActionBody, serializeAuditDetail, type AuditAction } from '../lib/audit-log'

const ALL_ACTIONS: AuditAction[] = [
  'user.role.set',
  'user.ban',
  'user.unban',
  'user.remove',
  'user.update',
  'user.impersonate',
  'user.password.set',
  'user.sessions.revoke',
  'transcription.create',
  'transcription.replace',
  'transcription.outline.update',
]

function lookup(path: string): unknown {
  return path.split('.').reduce<unknown>((node, key) => (node && typeof node === 'object' ? (node as Record<string, unknown>)[key] : undefined), zhTW)
}

describe('變更日誌事件對應（#71）', () => {
  it('只有真的會改變狀態的管理端點入帳', () => {
    expect(auditActionForAdminPath('/api/auth/admin/set-role')).toBe('user.role.set')
    expect(auditActionForAdminPath('/api/auth/admin/ban-user')).toBe('user.ban')
    expect(auditActionForAdminPath('/api/auth/admin/unban-user')).toBe('user.unban')
    expect(auditActionForAdminPath('/api/auth/admin/remove-user')).toBe('user.remove')
    expect(auditActionForAdminPath('/api/auth/admin/update-user')).toBe('user.update')
    expect(auditActionForAdminPath('/api/auth/admin/set-user-password')).toBe('user.password.set')
    expect(auditActionForAdminPath('/api/auth/admin/revoke-user-sessions')).toBe('user.sessions.revoke')
  })

  // 冒用他人身分而不留痕是審計上最嚴重的漏洞，單獨釘一條
  it('impersonate-user 一定入帳', () => {
    expect(auditActionForAdminPath('/api/auth/admin/impersonate-user')).toBe('user.impersonate')
  })

  it('查詢類與登入流程不算變更事件', () => {
    expect(auditActionForAdminPath('/api/auth/admin/list-users')).toBeNull()
    expect(auditActionForAdminPath('/api/auth/admin/has-permission')).toBeNull()
    expect(auditActionForAdminPath('/api/auth/callback/google')).toBeNull()
    expect(auditActionForAdminPath('/api/me')).toBeNull()
  })

  // 少一個 key，日誌就會顯示 i18n 原始路徑。三檔同步由 l10n.test.ts 把關，這裡確保基準檔有值。
  it('每一種事件都有對應的顯示文案', () => {
    for (const action of ALL_ACTIONS) {
      expect(typeof lookup(auditActionLabelKey(action))).toBe('string')
    }
    expect(typeof lookup('admin.logs.action.unknown')).toBe('string')
  })
})

describe('管理端點請求 body 的審計欄位', () => {
  it('role 為字串或字串陣列都取得到（Better Auth 兩種都收）', () => {
    expect(readAdminActionBody({ userId: 'u1', role: 'admin' })).toEqual({ userId: 'u1', role: 'admin', reason: null })
    expect(readAdminActionBody({ userId: 'u1', role: ['admin', 'user'] })).toEqual({ userId: 'u1', role: 'admin,user', reason: null })
  })

  it('停權理由一併記錄', () => {
    expect(readAdminActionBody({ userId: 'u1', banReason: '違反社群守則' }).reason).toBe('違反社群守則')
  })

  it('缺欄位或非物件一律回 null，不會寫進空字串', () => {
    expect(readAdminActionBody({ userId: '' })).toEqual({ userId: null, role: null, reason: null })
    expect(readAdminActionBody(null)).toEqual({ userId: null, role: null, reason: null })
    expect(readAdminActionBody('not-json')).toEqual({ userId: null, role: null, reason: null })
    expect(readAdminActionBody({ userId: 'u1', role: 42 }).role).toBeNull()
  })
})

describe('事件附加資料（detail）序列化', () => {
  it('可雙向轉換，空值不佔欄位', () => {
    expect(serializeAuditDetail({ fromRole: 'user', toRole: 'admin' })).toBe('{"fromRole":"user","toRole":"admin"}')
    expect(serializeAuditDetail({})).toBeNull()
    expect(serializeAuditDetail({ reason: '', versionId: undefined })).toBeNull()
    expect(parseAuditDetail('{"fromRole":"user","toRole":"admin"}')).toEqual({ fromRole: 'user', toRole: 'admin' })
  })

  it('資料庫內容視為外部資料：壞掉或型別不符的欄位直接丟棄', () => {
    expect(parseAuditDetail('not json')).toEqual({})
    expect(parseAuditDetail(null)).toEqual({})
    expect(parseAuditDetail('[1,2,3]')).toEqual({})
    expect(parseAuditDetail('{"toRole":42,"bytes":"big","versionId":"20260803T091500123Z"}')).toEqual({ versionId: '20260803T091500123Z' })
  })
})

// 測試環境沒有 Cloudflare 綁定，因此只驗未登入這道關卡；
// 已登入但非 super-admin（403）與 session 不新鮮（403 + SESSION_NOT_FRESH）留待實測（見 AGENTS.md）。
describe('變更日誌端點的授權關卡', () => {
  it('未登入拿不到變更日誌', async () => {
    const res = await app.request('https://vtaiwan.tw/api/admin/audit-log', { headers: { origin: 'https://vtaiwan.tw' } })
    expect(res.status).toBe(401)
  })
})
