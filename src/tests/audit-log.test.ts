import { describe, expect, it } from 'vite-plus/test'
import app from '../index'
import zhTW from '../l10n/zh-TW.json'
import {
  auditActionForAdminPath,
  auditActionLabelKey,
  parseAuditDetail,
  readAdminActionBody,
  readAdminSessionToken,
  readCreatedAuditUser,
  restoreCommandFor,
  serializeAuditDetail,
  type AuditAction,
  type AuditEntry,
} from '../lib/audit-log'
import { isSuccessfulAuthAuditResponse, prepareAuthAudit } from '../server/lib/auth-audit'
import type { AppBindings } from '../server/api/types'

const ALL_ACTIONS: AuditAction[] = [
  'user.create',
  'user.role.set',
  'user.ban',
  'user.unban',
  'user.remove',
  'user.update',
  'user.impersonate',
  'user.password.set',
  'user.session.revoke',
  'user.sessions.revoke',
  'transcription.create',
  'transcription.replace',
  'transcription.delete',
  'transcription.restore',
  'transcription.outline.update',
  'transcription.outline.restore',
]

function entry(action: AuditAction, detail: AuditEntry['detail'] = {}, targetType: AuditEntry['target']['type'] = 'transcription'): AuditEntry {
  return {
    id: 1,
    createdAt: 0,
    actor: { id: 'u1', name: 'Admin', email: 'admin@example.com' },
    action,
    target: { type: targetType, id: '20260803', label: '2026-08-03' },
    detail,
  }
}

function lookup(path: string): unknown {
  return path.split('.').reduce<unknown>((node, key) => (node && typeof node === 'object' ? (node as Record<string, unknown>)[key] : undefined), zhTW)
}

describe('變更日誌事件對應（#71）', () => {
  it('只有真的會改變狀態的管理端點入帳', () => {
    expect(auditActionForAdminPath('/api/auth/admin/create-user')).toBe('user.create')
    expect(auditActionForAdminPath('/api/auth/admin/set-role')).toBe('user.role.set')
    expect(auditActionForAdminPath('/api/auth/admin/ban-user')).toBe('user.ban')
    expect(auditActionForAdminPath('/api/auth/admin/unban-user')).toBe('user.unban')
    expect(auditActionForAdminPath('/api/auth/admin/remove-user')).toBe('user.remove')
    expect(auditActionForAdminPath('/api/auth/admin/update-user')).toBe('user.update')
    expect(auditActionForAdminPath('/api/auth/admin/set-user-password')).toBe('user.password.set')
  })

  // 兩個端點互為前綴、事件名只差一個字母，調換了不會報錯只會顯示錯文案——相鄰釘住（#74）
  it('撤銷單一工作階段與撤銷全部工作階段是兩個不同事件', () => {
    expect(auditActionForAdminPath('/api/auth/admin/revoke-user-session')).toBe('user.session.revoke')
    expect(auditActionForAdminPath('/api/auth/admin/revoke-user-sessions')).toBe('user.sessions.revoke')
    expect(auditActionLabelKey('user.session.revoke')).not.toBe(auditActionLabelKey('user.sessions.revoke'))
  })

  // 冒用他人身分而不留痕是審計上最嚴重的漏洞，單獨釘一條
  it('impersonate-user 一定入帳', () => {
    expect(auditActionForAdminPath('/api/auth/admin/impersonate-user')).toBe('user.impersonate')
  })

  it('查詢類與登入流程不算變更事件', () => {
    expect(auditActionForAdminPath('/api/auth/admin/list-users')).toBeNull()
    expect(auditActionForAdminPath('/api/auth/admin/list-user-sessions')).toBeNull()
    expect(auditActionForAdminPath('/api/auth/admin/has-permission')).toBeNull()
    expect(auditActionForAdminPath('/api/auth/callback/google')).toBeNull()
    expect(auditActionForAdminPath('/api/auth/me')).toBeNull()
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

  // create-user 入帳後，這個函式也會吃到帶密碼的 body（#74）——只取白名單欄位，密碼不得外流到日誌
  it('只取白名單欄位，create-user 的密碼不會被帶出來', () => {
    const parsed = readAdminActionBody({ email: 'new@example.com', password: 'super-secret', name: 'New', role: 'admin' })
    expect(parsed).toEqual({ userId: null, role: 'admin', reason: null })
    expect(JSON.stringify(parsed)).not.toContain('super-secret')
  })
})

describe('create-user 的操作對象（#74）', () => {
  it('由成功回應取出新帳號的 id／顯示名稱／角色', () => {
    expect(readCreatedAuditUser({ user: { id: 'u9', name: '新成員', email: 'new@example.com', role: 'admin' } })).toEqual({ id: 'u9', label: '新成員', role: 'admin' })
  })

  it('label 依「姓名 → 信箱 → id」遞補，與 findAuditUserTarget 同一套規則', () => {
    expect(readCreatedAuditUser({ user: { id: 'u9', name: '', email: 'new@example.com' } })?.label).toBe('new@example.com')
    expect(readCreatedAuditUser({ user: { id: 'u9' } })?.label).toBe('u9')
  })

  it('角色為字串陣列時與 set-role 一致以逗號串接', () => {
    expect(readCreatedAuditUser({ user: { id: 'u9', role: ['admin', 'user'] } })?.role).toBe('admin,user')
  })

  // 拿不到 id 就沒有可指向的操作對象，寧可不留痕也不要寫一筆對不回人的日誌
  it('回應形狀不符時回 null', () => {
    expect(readCreatedAuditUser(null)).toBeNull()
    expect(readCreatedAuditUser({})).toBeNull()
    expect(readCreatedAuditUser({ user: null })).toBeNull()
    expect(readCreatedAuditUser({ user: { id: '' } })).toBeNull()
    expect(readCreatedAuditUser({ user: { id: 42 } })).toBeNull()
  })
})

describe('Better Auth after hook 的成功回應判定', () => {
  it('只接受各管理端點預期的成功回傳形狀', () => {
    expect(isSuccessfulAuthAuditResponse('user.create', { user: { id: 'u1' } })).toBe(true)
    expect(isSuccessfulAuthAuditResponse('user.role.set', { user: { id: 'u1' } })).toBe(true)
    expect(isSuccessfulAuthAuditResponse('user.remove', { success: true })).toBe(true)
    expect(isSuccessfulAuthAuditResponse('user.session.revoke', { success: true })).toBe(true)
    expect(isSuccessfulAuthAuditResponse('user.password.set', { status: true })).toBe(true)
  })

  it('錯誤或不完整回傳絕不入帳', () => {
    expect(isSuccessfulAuthAuditResponse('user.create', { code: 'USER_ALREADY_EXISTS' })).toBe(false)
    expect(isSuccessfulAuthAuditResponse('user.role.set', { user: { id: '' } })).toBe(false)
    expect(isSuccessfulAuthAuditResponse('user.remove', { success: false })).toBe(false)
    expect(isSuccessfulAuthAuditResponse('user.password.set', { status: false })).toBe(false)
  })
})

describe('Better Auth before hook 的審計快照', () => {
  const envWithUser = (user: { id: string; name: string; email: string; role: string }): AppBindings =>
    ({
      DB_AUTH: {
        prepare: () => ({
          bind: () => ({ first: async () => user }),
        }),
      },
    }) as unknown as AppBindings

  it('直接使用 Better Auth 已解析的 body，保存 role 變更前快照', async () => {
    await expect(prepareAuthAudit(envWithUser({ id: 'u1', name: '原姓名', email: 'member@example.com', role: 'user' }), '/admin/set-role', { userId: 'u1', role: 'admin' })).resolves.toEqual({
      action: 'user.role.set',
      target: { type: 'user', id: 'u1', label: '原姓名' },
      detail: { fromRole: 'user', toRole: 'admin' },
    })
  })

  it('create-user 不讀取 request stream，也不需預先查目標使用者', async () => {
    await expect(prepareAuthAudit({} as AppBindings, '/admin/create-user', { name: '新成員', password: 'never-log-this' })).resolves.toEqual({
      action: 'user.create',
      target: null,
      detail: {},
    })
  })
})

describe('revoke-user-session 的操作對象（#74）', () => {
  it('取得 sessionToken 供動作生效前反查使用者', () => {
    expect(readAdminSessionToken({ sessionToken: 'tok_abc' })).toBe('tok_abc')
  })

  it('缺欄位或型別不符一律回 null，不會拿空字串去查 session', () => {
    expect(readAdminSessionToken({ sessionToken: '' })).toBeNull()
    expect(readAdminSessionToken({ userId: 'u1' })).toBeNull()
    expect(readAdminSessionToken(null)).toBeNull()
    expect(readAdminSessionToken('tok_abc')).toBeNull()
    expect(readAdminSessionToken({ sessionToken: 42 })).toBeNull()
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

describe('變更日誌的「管理操作」回復指令', () => {
  it('逐字稿覆蓋／刪除／回復都回到前一份逐字稿版本', () => {
    for (const action of ['transcription.replace', 'transcription.delete', 'transcription.restore'] as const) {
      expect(restoreCommandFor(entry(action, { previousVersionId: '20260803T091500123Z' }))).toEqual({
        kind: 'transcription',
        meetingId: '20260803',
        versionId: '20260803T091500123Z',
        outlineVersionId: undefined,
      })
    }
  })

  it('刪除事件連大綱快照一起帶上，救回時才不會只剩空大綱', () => {
    const command = restoreCommandFor(entry('transcription.delete', { previousVersionId: '20260803T091500123Z', previousOutlineVersionId: '20260803T091500999Z' }))
    expect(command).toEqual({
      kind: 'transcription',
      meetingId: '20260803',
      versionId: '20260803T091500123Z',
      outlineVersionId: '20260803T091500999Z',
    })
  })

  it('大綱變更回到大綱快照', () => {
    for (const action of ['transcription.outline.update', 'transcription.outline.restore'] as const) {
      expect(restoreCommandFor(entry(action, { previousVersionId: '20260803T091500123Z' }))).toEqual({
        kind: 'outline',
        meetingId: '20260803',
        versionId: '20260803T091500123Z',
      })
    }
  })

  // 使用者選定的語意：新增之前不存在，因此「回到變更前」＝刪除該逐字稿
  it('新增逐字稿的回復動作是刪除', () => {
    expect(restoreCommandFor(entry('transcription.create', { versionId: '20260803T091500123Z' }))).toEqual({ kind: 'delete', meetingId: '20260803' })
  })

  it('沒有變更前版本就不給按鈕（例如 #73 上線前的舊資料）', () => {
    expect(restoreCommandFor(entry('transcription.replace'))).toBeNull()
    expect(restoreCommandFor(entry('transcription.outline.update'))).toBeNull()
  })

  it('成員類事件一律沒有回復按鈕', () => {
    for (const action of ['user.create', 'user.role.set', 'user.ban', 'user.remove', 'user.impersonate', 'user.session.revoke'] as const) {
      expect(restoreCommandFor(entry(action, { previousVersionId: '20260803T091500123Z' }, 'user'))).toBeNull()
    }
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

describe('回復／刪除端點的授權關卡', () => {
  const headers = { origin: 'https://vtaiwan.tw', 'content-type': 'application/json' }

  it('未登入不得回復逐字稿', async () => {
    const res = await app.request('https://vtaiwan.tw/api/transcription/restore', {
      method: 'POST',
      headers,
      body: JSON.stringify({ meeting_id: '20260803', target: 'transcription', version_id: '20260803T091500123Z' }),
    })
    expect(res.status).toBe(401)
  })

  it('未登入不得刪除逐字稿', async () => {
    const res = await app.request('https://vtaiwan.tw/api/transcription/delete', {
      method: 'POST',
      headers,
      body: JSON.stringify({ meeting_id: '20260803' }),
    })
    expect(res.status).toBe(401)
  })
})
