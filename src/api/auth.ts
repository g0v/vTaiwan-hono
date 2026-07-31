import { Hono } from 'hono'
import { createAuth } from '../server/lib/createAuth'
import { getAuthContext } from '../server/lib/authorization'
import type { AppEnv } from './types'

export const app = new Hono<AppEnv>()

// Better Auth admin plugin 的管理端點（/api/auth/admin/*：list-users、set-role、
// ban-user…）的授權由 plugin 自己強制：未登入 → 401、角色權限不足 → 403。
// 權限設定的單一來源是 createAuth.ts 的 adminRoleAccess，這裡不再疊一層 Worker 端
// 守衛（規則分散會漂移、互相衝突）。同源檢查則由 index.ts 的全域 csrf() 統一負責。
app.on(['GET', 'POST'], '/api/auth/*', c => {
  const auth = createAuth(c.env)
  return auth.handler(c.req.raw)
})

app.get('/api/me', async c => {
  const context = await getAuthContext(c.env, c.req.raw.headers)
  if (!context) return c.json({ error: 'Unauthorized' }, 401)
  return c.json(context)
})

export default app
