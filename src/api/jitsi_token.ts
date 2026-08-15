import { Hono } from 'hono'
import { corsFor } from './cors'
import { generateJaasJwt } from '../lib/jaas-jwt'
import { getAuthContext, hasPermission } from '../server/lib/authorization'
import type { AppEnv } from './types'

export const app = new Hono<AppEnv>()

app.use('/', corsFor(['POST']))
app.post('/', async c => {
  const context = await getAuthContext(c.env, c.req.raw.headers)
  if (!context) return c.json({ error: 'Unauthorized' }, 401)
  if (!hasPermission(context, 'meeting.join')) return c.json({ error: 'Forbidden' }, 403)

  const body = await c.req.json<{ room?: unknown }>().catch(() => null)
  const room = typeof body?.room === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(body.room) ? body.room : 'vtaiwan'
  const userInfo = {
    user_id: context.user.id,
    user_name: context.user.name,
    user_email: context.user.email,
    user_moderator: String(hasPermission(context, 'meeting.moderate')),
  }

  try {
    const token = await generateJaasJwt(room, userInfo, c.env)
    return c.json({ token })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return c.json({ error: message }, 500)
  }
})
export default app
