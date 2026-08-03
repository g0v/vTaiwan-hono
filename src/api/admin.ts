import { isSuperAdminRole, tryGetAuthContext } from '../server/lib/authorization'
import { listAudit } from '../server/lib/audit-log'
import { AUDIT_LOG_LIMIT } from '../lib/audit-log'
import { sessionNotFreshBody } from '../server/lib/step-up'
import type { App } from './types'

export function registerAdminApi(app: App) {
  // GET /api/admin/audit-log — 管理後台變更日誌（#71）
  //
  // 僅 super-admin：日誌含成員姓名／信箱與角色異動，敏感度等同成員列表，
  // 授權範圍刻意與 /api/auth/admin/list-users 對齊。
  // 另要求 session 新鮮度——進入後台本身即為敏感操作（見 step-up.ts）。
  // 不掛 corsFor：這是後台自家頁面用的端點，沒有跨來源使用情境。
  app.get('/api/admin/audit-log', async c => {
    const context = await tryGetAuthContext(c.env, c.req.raw.headers)
    if (!context) return c.json({ error: 'Unauthorized' }, 401)
    if (!isSuperAdminRole(context.role)) return c.json({ error: 'Forbidden' }, 403)
    if (!context.fresh) return c.json(sessionNotFreshBody(), 403)

    const db = c.env.DB
    if (!db) return c.json({ error: 'DB binding not configured' }, 500)

    return c.json({ entries: await listAudit(c.env, AUDIT_LOG_LIMIT) })
  })
}
