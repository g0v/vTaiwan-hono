import type { MiddlewareHandler } from 'hono'
import type { AppEnv } from '../../api/types'
import { evaluateAdminAccess, getAuthContext } from './authorization'

// 管理專用 API 的 Worker 端守衛：GET 取資料、POST 做變更都要先通過
// 「同源 → 已登入 → 管理員」這一道關卡，一般使用者一律回 401/403。
// 這是真正的授權邊界（前端 NavBar/AdminView 顯示守衛只是 UX）；即使下游
// 套件（如 Better Auth admin plugin）自身也有檢查，這裡仍做縱深防禦，
// 確保設定回歸時一般人也打不進管理端點。
//
// 注意：此守衛以「當前 session 的角色」判定，會一併擋下 Better Auth 的
// stop-impersonating（假冒中的 session 角色可能非管理員）；本專案未啟用
// impersonation，故無影響，日後若啟用需另行豁免該端點。
export function requireAdmin(): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    const context = await getAuthContext(c.env, c.req.raw.headers)
    const outcome = evaluateAdminAccess({
      method: c.req.method,
      url: c.req.url,
      origin: c.req.header('Origin'),
      context,
    })
    if (!outcome.ok) {
      return c.json({ error: outcome.status === 401 ? 'Unauthorized' : 'Forbidden' }, outcome.status)
    }
    await next()
  }
}
