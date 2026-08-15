import { Hono } from 'hono'
import { generateJaasJwt } from '../lib/jaas-jwt'
import { getAuthContext, hasPermission } from '../server/lib/authorization'
import type { AppEnv } from './types'

const app = new Hono<AppEnv>()

// 不掛 corsFor：這是本站 JitsiView 自己用的寫入端點，沒有跨來源使用情境，
// 且跨來源請求本來就過不了全域 csrf()（連 preflight 都會 403），CORS 標頭永遠送不出去。
// 同 transcription.ts 的「CORS 政策」，寫入端點一律不宣告 CORS。
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
