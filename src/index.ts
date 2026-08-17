import { Hono } from 'hono'
import { csrf } from 'hono/csrf'
import { NONCE, secureHeaders } from 'hono/secure-headers'
import admin from './server/api/admin'
import discourseTopicId from './server/api/discourse_topic_id'
import discourseTopics from './server/api/discourse_topics'
import hello from './server/api/hello'
import jitsiToken from './server/api/jitsi_token'
import mastodon from './server/api/mastodon'
import proxy from './server/api/proxy'
import transcription from './server/api/transcription'
import type { AppEnv } from './server/api/types'
import auth from './server/api/auth'
import meeting from './server/api/meeting'
export { MeetingRoom } from './durable-objects/meeting-room'
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

const securityHeaders = secureHeaders({
  contentSecurityPolicy: {
    defaultSrc: ["'self'"],
    baseUri: ["'self'"],
    objectSrc: ["'none'"],
    scriptSrc: ["'self'", "'sha256-3bzWVxQE32IZQKH9eh8KzyHuhXOlMrboDVVBRd0fWTU='", 'https://www.googletagmanager.com', 'https://static.cloudflareinsights.com', 'https://8x8.vc'],
    styleSrc: ["'self'", NONCE, 'https://fonts.googleapis.com'],
    fontSrc: ["'self'", 'https://fonts.gstatic.com'],
    imgSrc: ["'self'", 'https:'],
    connectSrc: ["'self'", 'https://www.googletagmanager.com', 'https://*.google-analytics.com', 'https://*.analytics.google.com', 'https://8x8.vc', 'wss://8x8.vc'],
    frameSrc: [
      'https://accounts.google.com',
      'https://pol.is',
      'https://app.sli.do',
      'https://livehouse.in',
      'https://embed.livehouse.in',
      'https://form.typeform.com',
      'https://docs.google.com',
      'https://calendar.google.com',
      'https://8x8.vc',
    ],
    frameAncestors: ["'self'"],
    formAction: ["'self'"],
  },
  referrerPolicy: 'strict-origin-when-cross-origin',
  xContentTypeOptions: true,
  xFrameOptions: 'SAMEORIGIN',
  // 不啟用 middleware 的其他預設標頭，維持目前跨來源與登入流程行為。
  crossOriginResourcePolicy: false,
  crossOriginOpenerPolicy: false,
  originAgentCluster: false,
  strictTransportSecurity: true,
  xDnsPrefetchControl: false,
  xDownloadOptions: false,
  xPermittedCrossDomainPolicies: false,
  xXssProtection: true,
  removePoweredBy: true,
})

app.use('*', async (c, next) => {
  await securityHeaders(c, next)
  // WebSocket Upgrade（101）不加安全標頭：101 回應只需升級相關標頭，
  // 附加 CSP 等欄位在不同 runtime 下行為不確定，也無實際防護作用。
  if (c.res.status !== 101) return

  c.res.headers.delete('Content-Security-Policy')
  c.res.headers.delete('Referrer-Policy')
  c.res.headers.delete('X-Content-Type-Options')
  c.res.headers.delete('X-Frame-Options')
  c.res.headers.delete('Strict-Transport-Security')
  c.res.headers.delete('X-XSS-Protection')
})

// ⚠️ 全域 /api/* 中介層一律寫在下面的 app.route() 區塊之前。
// Hono 依註冊順序組出 handler chain，而子 app 的 handler 一旦回應就結束整條 chain——
// 寫在 app.route() 之後的 /api/* 中介層對所有掛載的子 app 都會靜默失效（不會有任何錯誤）。
// 這是本站授權模型的第一道閘，api-routing.test.ts 釘住這個順序。
app.use('/api/*', csrf())

// 純 JSON / 文字 API：直接回傳，不走 SSR
app.route('/api/auth', auth)
app.route('/api/hello', hello)
app.route('/api/proxy', proxy)
app.route('/api/mastodon', mastodon)
app.route('/api/discourse/topics', discourseTopics)
app.route('/api/discourse/topic', discourseTopicId)
app.route('/api/jitsi-token', jitsiToken)
app.route('/api/transcription', transcription)
app.route('/api/admin', admin)
app.route('/api/meeting', meeting)

// 其他 GET 請求：靜態檔交給 ASSETS，其餘交給 Vue SSR + vue-router。
app.get('*', async c => {
  const url = new URL(c.req.url)
  // 如果是靜態檔案請求（有副檔名，如 .css, .js, .svg, .png, .ico），則交給 ASSETS 處理
  const hasExtension = /\.[a-zA-Z0-9]+$/.test(url.pathname)
  if (hasExtension) {
    if (!c.env.ASSETS) return c.notFound()
    return c.env.ASSETS.fetch(c.req.raw)
  }

  const rendered = await renderPage(`${url.pathname}${url.search}${url.hash}`, url.origin, c.get('secureHeadersNonce'))

  // /admin 路由守衛：非管理員一律回 403（HTML 殼不變，僅覆寫狀態碼，避免 hydration mismatch；
  // 前端 AdminView 於 client 端顯示 403／二次驗證畫面）。
  if (isAdminPath(url.pathname) && !(await isAdminRequest(c.env, c.req.raw.headers))) {
    return c.html(rendered.html, 403)
  }

  return c.html(rendered.html, rendered.status)
})

export default app
