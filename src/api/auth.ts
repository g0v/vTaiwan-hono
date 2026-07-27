import { Hono } from 'hono'
import { createAuth } from '../server/lib/createAuth'
import type { AppEnv } from './types'

export const app = new Hono<AppEnv>()

app.on(['GET', 'POST'], '/api/auth/*', c => {
  const auth = createAuth(c.env)
  return auth.handler(c.req.raw)
})

app.get('/api/me', async c => {
  const auth = createAuth(c.env)
  const session = await auth.api.getSession({ headers: c.req.raw.headers })

  if (!session) return c.json({ error: 'Unauthorized' }, 401)
  return c.json({ user: session.user })
})

export default app
