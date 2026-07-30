import { corsFor } from './cors'
import { generateJaasJwt } from '../lib/jaas-jwt'
import { getAuthContext, hasPermission, hasSameOrigin } from '../server/lib/authorization'
import type { App } from './types'

export function registerJitsiTokenApi(app: App) {
  app.use('/api/jitsi-token', corsFor(['POST']))
  app.post('/api/jitsi-token', async c => {
    if (!hasSameOrigin(c.req.url, c.req.header('Origin'))) return c.json({ error: 'Forbidden' }, 403)
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
}
