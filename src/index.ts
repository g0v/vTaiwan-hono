import { Hono } from 'hono'
import { csrf } from 'hono/csrf'
import { registerDiscourseTopicIdApi } from './api/discourse_topic_id'
import { registerDiscourseTopicsApi } from './api/discourse_topics'
import { registerHelloApi } from './api/hello'
import { registerJitsiTokenApi } from './api/jitsi_token'
import { registerMastodonApi } from './api/mastodon'
import { registerProxyApi } from './api/proxy'
import { registerTranscriptionApi } from './api/transcription'
import type { AppEnv } from './api/types'
import auth from './api/auth'
import { getAuthContext, isAdminRole } from './server/lib/authorization'
import { renderPage } from './ssr/render'

// /admin（含子路徑）需管理員以上；此為真正的授權邊界（robots.txt 只是 crawler 提示）。
// 前端 NavBar/AdminView 的顯示守衛只是 UX，直接打 /admin 一律在 Worker 端把關。
function isAdminPath(pathname: string): boolean {
  return pathname === '/admin' || pathname.startsWith('/admin/')
}

// 回傳非管理員是否應被擋下。session 讀取失敗（例如綁定缺失）時保守視為未授權。
async function isAdminRequest(env: AppEnv['Bindings'], headers: Headers): Promise<boolean> {
  try {
    const context = await getAuthContext(env, headers)
    return context !== null && isAdminRole(context.role)
  } catch (error) {
    console.error('Failed to resolve admin auth context:', error)
    return false
  }
}

const app = new Hono<AppEnv>()

// 防禦縱深：即使清洗器發生回歸，也禁止未授權的內嵌 script、style 與事件處理器執行。
// Vite 開發伺服器注入的 Vue SFC <style> 以逐請求 nonce 精確放行，不使用
// 'unsafe-inline'。script-src 額外允許 GA、Firebase Auth 的 gapi、Realtime
// Database 的 long-poll script，以及第三方套件產生的固定 inline script
//（僅放行瀏覽器回報的 SHA-256）。connect-src 則允許 Firebase API/WebSocket
// 與 GA4 beacon。
export function contentSecurityPolicyFor(nonce: string): string {
  return `default-src 'self'; base-uri 'self'; object-src 'none'; script-src 'self' 'sha256-3bzWVxQE32IZQKH9eh8KzyHuhXOlMrboDVVBRd0fWTU=' https://www.googletagmanager.com https://apis.google.com https://*.firebaseio.com; style-src 'self' 'nonce-${nonce}' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' https:; connect-src 'self' https://*.firebaseio.com wss://*.firebaseio.com https://identitytoolkit.googleapis.com https://securetoken.googleapis.com https://firebasestorage.googleapis.com https://*.googleapis.com https://www.googletagmanager.com https://*.google-analytics.com https://*.analytics.google.com; frame-src https://*.firebaseapp.com https://accounts.google.com https://pol.is https://app.sli.do https://livehouse.in https://embed.livehouse.in https://form.typeform.com https://docs.google.com https://calendar.google.com; frame-ancestors 'self'; form-action 'self'`
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

// 跨站請求偽造防護：所有 /api/* 端點統一由 hono/csrf 把關（取代先前逐端點自行做的
// 同源檢查）。csrf() 針對非安全方法、且屬瀏覽器表單可直接送出的 content-type
//（x-www-form-urlencoded／multipart/form-data／text/plain）比對 Sec-Fetch-Site
// 與 Origin，非同源一律 403。application/json 請求不在其列，但跨站送不出預檢通過的
// 帶憑證請求（corsFor 未開 credentials、session cookie 為 SameSite=Lax），到端點時
// 一律無 session → 401。/api/auth/* 另有 Better Auth 自己的 trustedOrigins 檢查。
// 必須註冊在下方各 API 之前。
//
// ⚠️ 行為變更：缺 Content-Type 的請求會被當成 text/plain 檢查，且無 Origin／無
// Sec-Fetch-Site 一律視為不通過——即「非瀏覽器請求豁免」已取消。受影響的是
// /api/create-table 與 /api/test-ai 這兩個腳本／curl 用的端點（見 transcription.ts）。
// ⚠️ 未來新增 OAuth provider 時注意：Better Auth 的 /callback/:id 同時收 GET 與 POST，
// 走 form_post 回傳模式的 provider（如 Apple）其跨站 POST callback 會被這道 csrf 擋下；
// 目前的 Google／GitHub 是 GET query 模式，不受影響。
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
  // 前端 AdminView 於 client 端顯示對應的 403 畫面）。
  if (isAdminPath(url.pathname) && !(await isAdminRequest(c.env, c.req.raw.headers))) {
    return c.html(rendered.html, 403)
  }

  return c.html(rendered.html, rendered.status)
})

export default app
