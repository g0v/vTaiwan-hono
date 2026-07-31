import { Hono } from 'hono'
import { createAuth } from '../server/lib/createAuth'
import { getAuthContext } from '../server/lib/authorization'
import { requireAdmin } from '../server/lib/admin-guard'
import type { AppEnv } from './types'

export const app = new Hono<AppEnv>()

// Better Auth admin plugin 的管理端點（/api/auth/admin/*：list-users、set-role、
// ban-user、create-user、remove-user…）一律先過 Worker 端管理員守衛，擋掉一般人
// 打 GET 取得所有用戶資料、或打 POST 做變更。務必註冊在下方 catch-all handler 之前。
app.use('/api/auth/admin/*', requireAdmin())

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
