import { corsFor } from './cors'
import { generateJaasJwt } from '../lib/jaas-jwt'
import { getAuthContext, hasPermission } from '../server/lib/authorization'
import type { App } from './types'

export function registerJitsiTokenApi(app: App) {
  app.use('/api/jitsi-token', corsFor(['POST']))
  // 同源檢查由 index.ts 的全域 csrf() 統一負責（不再逐端點自行檢查）。
  // 本端點吃 application/json，不屬於 csrf() 涵蓋的表單型簡單請求，但跨站也拿不到
  // token：corsFor 未開 credentials、Better Auth session cookie 預設 SameSite=Lax，
  // 跨站請求帶不到 session，走到下面就是 401。
  app.post('/api/jitsi-token', async c => {
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
