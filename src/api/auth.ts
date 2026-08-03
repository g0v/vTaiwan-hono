import { Hono } from 'hono'
import { createAuth } from '../server/lib/createAuth'
import { getAuthContext, resolveRole, tryGetAuthContext, type AuthContext } from '../server/lib/authorization'
import { findAuditUserTarget, recordAudit } from '../server/lib/audit-log'
import { auditActionForAdminPath, readAdminActionBody, type AuditDetail } from '../lib/audit-log'
import { requiresStepUp, sessionNotFreshBody } from '../server/lib/step-up'
import type { AppEnv } from './types'

export const app = new Hono<AppEnv>()

app.on(['GET', 'POST'], '/api/auth/*', async c => {
  const pathname = new URL(c.req.url).pathname

  // 管理端點屬敏感操作，需二次驗證（見 step-up.ts）。角色授權仍交還 Better Auth admin
  // plugin（單一來源為 createAuth.ts 的 adminRoleAccess），此處只多加一道 session 新鮮度。
  let context: AuthContext | null = null
  if (requiresStepUp(pathname)) {
    context = await tryGetAuthContext(c.env, c.req.raw.headers)
    if (!context) return c.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, 401)
    if (!context.fresh) return c.json(sessionNotFreshBody(), 403)
  }

  // 變更日誌（#71）：被審計的管理動作都落在 requiresStepUp 覆蓋的 /api/auth/admin/* 之內，
  // 因此上面必定已取得 context。若日後 requiresStepUp 縮小範圍，這裡要自行補讀，否則日誌會遺失操作者。
  const auditAction = auditActionForAdminPath(pathname)
  // body 必須在 handler 消化 request 之前先讀完
  const auditInput = auditAction
    ? readAdminActionBody(
        await c.req.raw
          .clone()
          .json()
          .catch(() => null)
      )
    : null
  // 快照要趕在動作生效前取：remove-user 之後查不到人，set-role 之後拿不到原角色
  const auditTarget = auditInput?.userId ? await findAuditUserTarget(c.env, auditInput.userId) : null

  const auth = createAuth(c.env)
  const response = await auth.handler(c.req.raw)

  // 只記真的成功的變更；失敗的請求（403／404／400）不入帳
  if (auditAction && auditInput?.userId && context && response.ok) {
    const detail: AuditDetail =
      auditAction === 'user.role.set' ? { fromRole: auditTarget?.role, toRole: auditInput.role ? resolveRole(auditInput.role) : undefined } : { reason: auditInput.reason ?? undefined }
    await recordAudit(c.env, context.user, auditAction, { type: 'user', id: auditInput.userId, label: auditTarget?.label ?? auditInput.userId }, detail)
  }

  return response
})

// 這裡刻意用會 throw 的 getAuthContext：/api/me 讀不到 session 是「壞掉」而非「未登入」，
// 壓成 401 會讓前端把系統故障誤判成登出。
app.get('/api/me', async c => {
  const context = await getAuthContext(c.env, c.req.raw.headers)
  if (!context) return c.json({ error: 'Unauthorized' }, 401)
  return c.json(context)
})

export default app
