import { Hono } from 'hono'
import { createAuth } from '../server/lib/createAuth'
import { getAuthContext } from '../server/lib/authorization'
import type { AppEnv } from './types'

export const app = new Hono<AppEnv>()

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
