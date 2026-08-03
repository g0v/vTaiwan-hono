import { describe, expect, it } from 'vite-plus/test'
import app from '../index'
import zhTW from '../l10n/zh-TW.json'
import { auditActionForAdminPath, auditActionLabelKey, parseAuditDetail, readAdminActionBody, restoreCommandFor, serializeAuditDetail, type AuditAction, type AuditEntry } from '../lib/audit-log'

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
    for (const action of ['user.role.set', 'user.ban', 'user.remove', 'user.impersonate'] as const) {
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
    const res = await app.request('https://vtaiwan.tw/api/restore-transcription', {
      method: 'POST',
      headers,
      body: JSON.stringify({ meeting_id: '20260803', target: 'transcription', version_id: '20260803T091500123Z' }),
    })
    expect(res.status).toBe(401)
  })

  it('未登入不得刪除逐字稿', async () => {
    const res = await app.request('https://vtaiwan.tw/api/delete-transcription', {
      method: 'POST',
      headers,
      body: JSON.stringify({ meeting_id: '20260803' }),
    })
    expect(res.status).toBe(401)
  })
})
