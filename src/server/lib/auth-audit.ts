import type { AppBindings } from '../api/types'
import { auditActionForAdminPath, readAdminActionBody, readAdminSessionToken, readCreatedAuditUser, type AuditAction, type AuditDetail } from '../../lib/audit-log'
import { findAuditUserIdBySessionToken, findAuditUserTarget, recordAudit, type AuditTarget } from './audit-log'
import { resolveRole, type AuthContext } from './authorization'

export interface PreparedAuthAudit {
  action: AuditAction
  target: AuditTarget | null
  detail: AuditDetail
}

/**
 * Better Auth 的 before hook：在管理動作改變資料前保留審計所需快照。
 * 回傳 null 代表不是應審計的端點，或缺少無法在事後重建的操作對象。
 */
export async function prepareAuthAudit(env: AppBindings, path: string, body: unknown): Promise<PreparedAuthAudit | null> {
  const action = auditActionForAdminPath(`/api/auth${path}`)
  if (!action) return null

  const input = readAdminActionBody(body)
  const revokedUserId = action === 'user.session.revoke' ? await findAuditUserIdBySessionToken(env, readAdminSessionToken(body)) : null
  const targetUserId = input.userId ?? revokedUserId

  if (action === 'user.create') return { action, target: null, detail: {} }
  if (!targetUserId) return null

  const snapshot = await findAuditUserTarget(env, targetUserId)
  const detail: AuditDetail = action === 'user.role.set' ? { fromRole: snapshot?.role, toRole: input.role ? resolveRole(input.role) : undefined } : { reason: input.reason ?? undefined }

  return {
    action,
    target: { type: 'user', id: targetUserId, label: snapshot?.label ?? targetUserId },
    detail,
  }
}

/** Better Auth 成功回傳的最小形狀；不認得的回應一律不寫入，避免失敗操作被誤記。 */
export function isSuccessfulAuthAuditResponse(action: AuditAction, returned: unknown): boolean {
  if (!returned || typeof returned !== 'object') return false

  const record = returned as { success?: unknown; status?: unknown }
  if (action === 'user.password.set') return record.status === true
  if (action === 'user.remove' || action === 'user.session.revoke' || action === 'user.sessions.revoke') return record.success === true
  return readCreatedAuditUser(returned) !== null
}

function readAuditActor(value: unknown): AuthContext['user'] | null {
  if (!value || typeof value !== 'object') return null

  const user = value as { id?: unknown; name?: unknown; email?: unknown; image?: unknown }
  if (typeof user.id !== 'string' || typeof user.name !== 'string' || typeof user.email !== 'string') return null
  return { id: user.id, name: user.name, email: user.email, image: typeof user.image === 'string' ? user.image : null }
}

/** Better Auth 的 after hook：只在端點確認成功後，使用 before 保存的快照寫入日誌。 */
export async function recordPreparedAuthAudit(env: AppBindings, actorValue: unknown, prepared: PreparedAuthAudit | null, returned: unknown): Promise<void> {
  if (!prepared || !isSuccessfulAuthAuditResponse(prepared.action, returned)) return

  const actor = readAuditActor(actorValue)
  if (!actor) return

  if (prepared.action === 'user.create') {
    const created = readCreatedAuditUser(returned)
    if (!created) return
    await recordAudit(env, actor, prepared.action, { type: 'user', id: created.id, label: created.label }, { toRole: created.role ? resolveRole(created.role) : undefined })
    return
  }

  if (prepared.target) await recordAudit(env, actor, prepared.action, prepared.target, prepared.detail)
}
