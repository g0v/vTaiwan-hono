import { Hono } from 'hono'
import { csrf } from 'hono/csrf'
import { registerDiscourseTopicIdApi } from './api/discourse_topic_id'
import { registerDiscourseTopicsApi } from './api/discourse_topics'
import { registerHelloApi } from './api/hello'
import { registerJitsiTokenApi } from './api/jitsi_token'
import { registerMastodonApi } from './api/mastodon'
import { registerProxyApi } from './api/proxy'
import { registerTranscriptionApi } from './api/transcription'
import { registerAdminApi } from './api/admin'
import type { AppEnv } from './api/types'
import auth from './api/auth'
import { isActiveAdminRole, tryGetAuthContext } from './server/lib/authorization'
import { renderPage } from './ssr/render'

// /admin（含子路徑）需管理員以上；此為真正的授權邊界（robots.txt 只是 crawler 提示）。
// 前端 NavBar/AdminView 的顯示守衛只是 UX，直接打 /admin 一律在 Worker 端把關。
function isAdminPath(pathname: string): boolean {
  return pathname === '/admin' || pathname.startsWith('/admin/')
}

// session 讀取失敗（例如綁定缺失）時保守視為未授權。
// 此處只看角色、不看 session 新鮮度：管理員但 session 已不新鮮時仍回 200，
// 讓 /admin 能顯示二次驗證畫面（回 403 會連重新登入的入口都看不到）。
// 後台真正的資料與寫入端點（/api/auth/admin/*、逐字稿寫入）另有新鮮度把關，見 step-up.ts。
async function isAdminRequest(env: AppEnv['Bindings'], headers: Headers): Promise<boolean> {
  const context = await tryGetAuthContext(env, headers)
  return context !== null && isActiveAdminRole(context.role, context.banned)
}

const app = new Hono<AppEnv>()

// 防禦縱深：即使清洗器發生回歸，也禁止未授權的內嵌 script、style 與事件處理器執行。
// Vite 開發伺服器注入的 Vue SFC <style> 以逐請求 nonce 精確放行，不使用
// 'unsafe-inline'。script-src 額外允許 GA、Firebase Auth 的 gapi、Realtime
// Database 的 long-poll script、JaaS（8x8.vc）external_api.js，以及第三方套件
// 產生的固定 inline script（僅放行瀏覽器回報的 SHA-256）。connect-src 則允許
// Firebase API/WebSocket、GA4 beacon 與 JaaS API／WebSocket。frame-src 另放行
// JaaS 會議 iframe。
export function contentSecurityPolicyFor(nonce: string): string {
  return `default-src 'self'; base-uri 'self'; object-src 'none'; script-src 'self' 'sha256-3bzWVxQE32IZQKH9eh8KzyHuhXOlMrboDVVBRd0fWTU=' https://www.googletagmanager.com https://apis.google.com https://*.firebaseio.com https://8x8.vc; style-src 'self' 'nonce-${nonce}' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' https:; connect-src 'self' https://*.firebaseio.com wss://*.firebaseio.com https://identitytoolkit.googleapis.com https://securetoken.googleapis.com https://firebasestorage.googleapis.com https://*.googleapis.com https://www.googletagmanager.com https://*.google-analytics.com https://*.analytics.google.com https://8x8.vc wss://8x8.vc; frame-src https://*.firebaseapp.com https://accounts.google.com https://pol.is https://app.sli.do https://livehouse.in https://embed.livehouse.in https://form.typeform.com https://docs.google.com https://calendar.google.com https://8x8.vc; frame-ancestors 'self'; form-action 'self'`
}

function generateCspNonce(): string {
  const randomBytes = crypto.getRandomValues(new Uint8Array(16))
  const binary = Array.from(randomBytes, byte => String.fromCharCode(byte)).join('')
  return btoa(binary)
}

app.use('*', async (c, next) => {
  const nonce = generateCspNonce()
  c.set('cspNonce', nonce)
  await next()
  c.header('Content-Security-Policy', contentSecurityPolicyFor(nonce))
  c.header('Referrer-Policy', 'strict-origin-when-cross-origin')
  c.header('X-Content-Type-Options', 'nosniff')
  c.header('X-Frame-Options', 'SAMEORIGIN')
})

app.use('/api/*', csrf())

// 純 JSON / 文字 API：直接回傳，不走 SSR
app.route('/', auth)
registerHelloApi(app)
registerProxyApi(app)
registerMastodonApi(app)
registerDiscourseTopicsApi(app)
registerDiscourseTopicIdApi(app)
registerJitsiTokenApi(app)
registerTranscriptionApi(app)
registerAdminApi(app)

// 其他 GET 請求：靜態檔交給 ASSETS，其餘交給 Vue SSR + vue-router。
app.get('*', async c => {
  const url = new URL(c.req.url)
  // 如果是靜態檔案請求（有副檔名，如 .css, .js, .svg, .png, .ico），則交給 ASSETS 處理
  const hasExtension = /\.[a-zA-Z0-9]+$/.test(url.pathname)
  if (hasExtension) {
    if (!c.env.ASSETS) return c.notFound()
    return c.env.ASSETS.fetch(c.req.raw)
  }

  const rendered = await renderPage(`${url.pathname}${url.search}${url.hash}`, url.origin, c.get('cspNonce'))

  // /admin 路由守衛：非管理員一律回 403（HTML 殼不變，僅覆寫狀態碼，避免 hydration mismatch；
  // 前端 AdminView 於 client 端顯示 403／二次驗證畫面）。
  if (isAdminPath(url.pathname) && !(await isAdminRequest(c.env, c.req.raw.headers))) {
    return c.html(rendered.html, 403)
  }

  return c.html(rendered.html, rendered.status)
})

export default app
