import { Hono, type Context } from 'hono'
import { createAuth } from '../server/lib/createAuth'
import { getAuthContext, tryGetAuthContext } from '../server/lib/authorization'
import { requiresStepUp, sessionNotFreshBody } from '../server/lib/step-up'
import { nameChangeCooldownExpiresAt, NAME_CHANGE_COOLDOWN_CODE } from '../lib/profile-name'
import type { AppEnv } from './types'

export const app = new Hono<AppEnv>()

type UserNameChangeRow = {
  name: string
  nameChangedAt: string | null
}

async function requestedDisplayName(request: Request): Promise<string | null> {
  try {
    const body = (await request.clone().json()) as unknown
    if (!body || typeof body !== 'object' || Array.isArray(body)) return null
    return typeof (body as { name?: unknown }).name === 'string' ? (body as { name: string }).name : null
  } catch {
    // 格式錯誤交給 Better Auth 依既有行為回應。
    return null
  }
}

/**
 * 在交給 Better Auth 更新前先提供可辨識的 429；D1 trigger 仍是併發與繞過
 * 應用程式時的最終防線（migrations/auth/20260811_add_name_change_cooldown.sql）。
 */
async function enforceNameChangeCooldown(c: Context<AppEnv>): Promise<Response | null> {
  const requestedName = await requestedDisplayName(c.req.raw)
  if (requestedName === null) return null

  const context = await getAuthContext(c.env, c.req.raw.headers)
  if (!context) return null

  const user = await c.env.DB_AUTH.prepare('SELECT "name", "nameChangedAt" FROM "user" WHERE "id" = ?').bind(context.user.id).first<UserNameChangeRow>()

  if (user && user.name !== requestedName && nameChangeCooldownExpiresAt(user.nameChangedAt) !== null) {
    return c.json({ code: NAME_CHANGE_COOLDOWN_CODE }, 429)
  }

  return null
}

app.on(['GET', 'POST'], '/api/auth/*', async c => {
  const pathname = new URL(c.req.url).pathname

  if (pathname === '/api/auth/update-user' && c.req.method === 'POST') {
    const cooldownResponse = await enforceNameChangeCooldown(c)
    if (cooldownResponse) return cooldownResponse
  }

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
