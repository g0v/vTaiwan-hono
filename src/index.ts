import { Hono } from 'hono'
import { registerDiscourseTopicIdApi } from './api/discourse_topic_id'
import { registerDiscourseTopicsApi } from './api/discourse_topics'
import { registerHelloApi } from './api/hello'
import { registerJitsiTokenApi } from './api/jitsi_token'
import { registerMastodonApi } from './api/mastodon'
import { registerProxyApi } from './api/proxy'
import { registerTranscriptionApi } from './api/transcription'
import type { AppEnv } from './api/types'
import { renderPage } from './ssr/render'

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

// 純 JSON / 文字 API：直接回傳，不走 SSR
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
  return c.html(rendered.html, rendered.status)
})

export default app
