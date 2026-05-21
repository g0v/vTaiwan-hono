import { Hono } from 'hono'
import { renderPage } from './ssr/render'

// Cloudflare Worker 綁定型別；ASSETS 在 wrangler.jsonc 對應到 ./public/
type Bindings = {
  ASSETS?: {
    fetch: (request: RequestInfo | URL, init?: RequestInit) => Promise<Response>
  }
}

const app = new Hono<{ Bindings: Bindings }>()

// 純 JSON / 文字 API：直接回傳，不走 SSR
app.get('/api/hello', (c) => c.text('Hello World!'))

// 其他 GET 請求：靜態檔交給 ASSETS，其餘交給 Vue SSR + vue-router。
app.get('*', async (c) => {
  const url = new URL(c.req.url)
  // 如果是靜態檔案請求（有副檔名，如 .css, .js, .svg, .png, .ico），則交給 ASSETS 處理
  const hasExtension = /\.[a-zA-Z0-9]+$/.test(url.pathname)
  if (hasExtension) {
    if (!c.env.ASSETS) return c.notFound()
    return c.env.ASSETS.fetch(c.req.raw)
  }

  const rendered = await renderPage(`${url.pathname}${url.search}${url.hash}`, url.origin)
  return c.html(rendered.html, rendered.status)
})

export default app
