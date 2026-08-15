import { Hono } from 'hono'
import { isSuperAdminRole, tryGetAuthContext } from '../server/lib/authorization'
import { listAudit } from '../server/lib/audit-log'
import { AUDIT_LOG_LIMIT } from '../lib/audit-log'
import { sessionNotFreshBody } from '../server/lib/step-up'
import civicTalk from './civic-talk'
import type { AppEnv } from './types'

const app = new Hono<AppEnv>()

// GET /audit-log — 管理後台變更日誌（#71）
//
// 僅 super-admin：日誌含成員姓名／信箱與角色異動，敏感度等同成員列表，
// 授權範圍刻意與 /api/auth/admin/list-users 對齊。
// 另要求 session 新鮮度——進入後台本身即為敏感操作（見 step-up.ts）。
// 不掛 corsFor：這是後台自家頁面用的端點，沒有跨來源使用情境。
app.get('/audit-log', async c => {
  const context = await tryGetAuthContext(c.env, c.req.raw.headers)
  if (!context) return c.json({ error: 'Unauthorized' }, 401)
  if (context.banned) return c.json({ error: 'Forbidden' }, 403)
  if (!isSuperAdminRole(context.role)) return c.json({ error: 'Forbidden' }, 403)
  if (!context.fresh) return c.json(sessionNotFreshBody(), 403)

  const db = c.env.DB
  if (!db) return c.json({ error: 'DB binding not configured' }, 500)

  try {
    return c.json({ entries: await listAudit(c.env, AUDIT_LOG_LIMIT) })
  } catch (error) {
    // 最常見的原因是 admin_audit_log 這張表還沒建（migrations/0002 未套用，
    // 或該 D1 只用 /api/transcription/create-table bootstrap 過）——前端只看得到「載入失敗」，
    // 這行 log 是唯一能分辨「表不存在」與「真的壞了」的線索。
    console.error('Failed to list audit log (是否已套用 migrations/0002_add_admin_audit_log.sql？):', error)
    return c.json({ error: 'Failed to read audit log', code: 'AUDIT_LOG_UNAVAILABLE' }, 500)
  }
})

// 全民對談後台（/api/admin/civic-talks/*）掛在這裡而非 index.ts，
// 讓「它是 /api/admin 底下的一組端點」這件事在程式碼結構上是顯性的——
// 兩個重疊前綴各自掛載時，admin 之後若加入動態路徑就會靜默蓋掉它。
app.route('/civic-talks', civicTalk)

export default app
