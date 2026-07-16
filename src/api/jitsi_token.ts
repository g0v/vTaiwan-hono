import { corsFor } from './cors'
import { generateJaasJwt } from '../lib/jaas-jwt'
import type { App } from './types'

export function registerJitsiTokenApi(app: App) {
  app.use('/api/jitsi-token', corsFor(['GET']))
  app.get('/api/jitsi-token', async c => {
    const room = c.req.query('room') ?? 'default-room'
    const userInfo = {
      user_id: c.req.query('user_id') ?? 'user123',
      user_name: c.req.query('user_name') ?? 'Your User',
      user_email: c.req.query('user_email') ?? 'user@example.com',
      user_moderator: c.req.query('user_moderator') ?? 'true',
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
