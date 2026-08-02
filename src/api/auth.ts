import { Hono } from 'hono'
import { createAuth } from '../server/lib/createAuth'
import { getAuthContext } from '../server/lib/authorization'
import { requiresStepUp, sessionNotFreshBody } from '../server/lib/step-up'
import type { AppEnv } from './types'

export const app = new Hono<AppEnv>()

// session 讀取失敗（例如綁定缺失）時保守視為未登入——與 index.ts 的 /admin 守衛一致。
async function readAuthContext(env: AppEnv['Bindings'], headers: Headers) {
  try {
    return await getAuthContext(env, headers)
  } catch (error) {
    console.error('Failed to resolve auth context for admin endpoint:', error)
    return null
  }
}

app.on(['GET', 'POST'], '/api/auth/*', async c => {
  // 管理端點屬敏感操作，需二次驗證（見 step-up.ts）。角色授權仍交還 Better Auth admin
  // plugin（單一來源為 createAuth.ts 的 adminRoleAccess），此處只多加一道 session 新鮮度。
  if (requiresStepUp(new URL(c.req.url).pathname)) {
    const context = await readAuthContext(c.env, c.req.raw.headers)
    if (!context) return c.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, 401)
    if (!context.fresh) return c.json(sessionNotFreshBody(), 403)
  }

  const auth = createAuth(c.env)
  return auth.handler(c.req.raw)
})

app.get('/api/me', async c => {
  const context = await getAuthContext(c.env, c.req.raw.headers)
  if (!context) return c.json({ error: 'Unauthorized' }, 401)
  return c.json(context)
})

export default app
