import { Hono } from 'hono'
import { createAuth } from '../server/lib/createAuth'
import { getAuthContext, tryGetAuthContext } from '../server/lib/authorization'
import { requiresStepUp, sessionNotFreshBody } from '../server/lib/step-up'
import type { AppEnv } from './types'

export const app = new Hono<AppEnv>()

app.on(['GET', 'POST'], '/api/auth/*', async c => {
  const pathname = new URL(c.req.url).pathname

  // 管理端點屬敏感操作，需二次驗證（見 step-up.ts）。角色授權仍交還 Better Auth admin
  // plugin（單一來源為 createAuth.ts 的 adminRoleAccess），此處只多加一道 session 新鮮度。
  if (requiresStepUp(pathname)) {
    const context = await tryGetAuthContext(c.env, c.req.raw.headers)
    if (!context) return c.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, 401)
    if (context.banned) return c.json({ error: 'Account banned', code: 'ACCOUNT_BANNED' }, 403)
    if (!context.fresh) return c.json(sessionNotFreshBody(), 403)
  }

  return createAuth(c.env).handler(c.req.raw)
})

// 這裡刻意用會 throw 的 getAuthContext：/api/me 讀不到 session 是「壞掉」而非「未登入」，
// 壓成 401 會讓前端把系統故障誤判成登出。
app.get('/api/me', async c => {
  const context = await getAuthContext(c.env, c.req.raw.headers)
  if (!context) return c.json({ error: 'Unauthorized' }, 401)
  return c.json(context)
})

export default app
