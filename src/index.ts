import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { renderPage } from './ssr/render'
import { getAllTopics, getTopic } from './lib/discourse-server'

// Cloudflare Worker 綁定型別；ASSETS 在 wrangler.jsonc 對應到 ./public/
type Bindings = {
  ASSETS?: {
    fetch: (request: RequestInfo | URL, init?: RequestInit) => Promise<Response>
  }
  MASTODON_TOKEN?: string
}

const app = new Hono<{ Bindings: Bindings }>()

// CORS 允許網域（同 vtaiwan-transcription-worker，加上本站）
const CORS_ORIGINS = [
  'https://vtaiwan.tw',
  'https://vue.vtaiwan.tw',
  'https://vtaiwan-hono.audreyt.workers.dev',
  'http://localhost:5173',
  'http://localhost:4321',
]

app.use('/api/*', cors({
  origin: (origin) => (CORS_ORIGINS.includes(origin) ? origin : null),
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
  maxAge: 86400,
}))

// 純 JSON / 文字 API：直接回傳，不走 SSR
app.get('/api/hello', (c) => c.text('Hello World!'))

// RSS / Substack proxy（Medium、Substack 白名單）
app.get('/api/proxy', async (c) => {
  const rawUrl = c.req.query('url')
  if (!rawUrl) return c.json({ error: 'Missing url parameter' }, 400)

  let targetUrl: URL
  try {
    targetUrl = new URL(rawUrl)
  } catch {
    return c.json({ error: 'Invalid url' }, 400)
  }

  if (targetUrl.protocol !== 'https:' && targetUrl.protocol !== 'http:') {
    return c.json({ error: 'Only http(s) URLs are allowed' }, 400)
  }

  const ALLOWED_HOSTS = ['medium.com', 'vtaiwantw.substack.com']
  const isAllowed = ALLOWED_HOSTS.some(
    h => targetUrl.hostname === h || targetUrl.hostname.endsWith('.' + h)
  )
  if (!isAllowed) return c.json({ error: 'Target host not allowed', hostname: targetUrl.hostname }, 403)

  try {
    const upstream = await fetch(targetUrl.toString(), {
      headers: { Accept: 'application/rss+xml, application/xml, text/xml, */*' },
      redirect: 'follow',
    })
    const contentType = upstream.headers.get('Content-Type') || 'text/xml'
    const body = await upstream.arrayBuffer()
    return new Response(body, {
      status: upstream.status,
      headers: { 'Content-Type': contentType },
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return c.json({ error: 'Upstream request failed', message }, 502)
  }
})

// Mastodon 貼文（g0v.social/tags/vtaiwan）
app.get('/api/mastodon', async (c) => {
  const token = c.env.MASTODON_TOKEN
  if (!token) return c.json({ error: 'MASTODON_TOKEN not configured' }, 500)

  const response = await fetch(
    'https://g0v.social/api/v1/timelines/tag/vtaiwan?limit=20&local=true',
    {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    }
  )
  const data = await response.json()
  return c.json(data, response.status as Parameters<typeof c.json>[1])
})

// Discourse 議題資料代理（實際抓取在 Worker 端，避免瀏覽器跨網域 CORS）
app.get('/api/discourse/topics', async (c) => {
  const category = c.req.query('category')
  try {
    const topics = await getAllTopics(category || undefined)
    return c.json(topics)
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return c.json({ error: 'Discourse request failed', message }, 502)
  }
})

app.get('/api/discourse/topic/:id', async (c) => {
  try {
    const topic = await getTopic(c.req.param('id'))
    return c.json(topic)
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return c.json({ error: 'Discourse request failed', message }, 502)
  }
})

// vtaiwan-transcription-worker 代理（避免瀏覽器直接跨域存取）
const TRANSCRIPTION_WORKER = 'https://vtaiwan-transcription-worker.bestian123.workers.dev'

app.get('/api/transcriptions/query-table', async (c) => {
  try {
    const res = await fetch(`${TRANSCRIPTION_WORKER}/api/query-table`)
    const data = await res.json()
    return c.json(data, res.status as Parameters<typeof c.json>[1])
  } catch (e) {
    return c.json({ error: 'Transcription worker unavailable' }, 502)
  }
})

app.post('/api/transcriptions/upload-transcription', async (c) => {
  try {
    const body = await c.req.raw.arrayBuffer()
    const contentType = c.req.header('content-type') ?? 'multipart/form-data'
    const res = await fetch(`${TRANSCRIPTION_WORKER}/api/upload-transcription`, {
      method: 'POST',
      headers: { 'Content-Type': contentType },
      body,
    })
    const data = await res.json()
    return c.json(data, res.status as Parameters<typeof c.json>[1])
  } catch (e) {
    return c.json({ error: 'Transcription worker unavailable' }, 502)
  }
})

app.post('/api/transcriptions/update-outline', async (c) => {
  try {
    const body = await c.req.json()
    const res = await fetch(`${TRANSCRIPTION_WORKER}/api/update-outline`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const data = await res.json()
    return c.json(data, res.status as Parameters<typeof c.json>[1])
  } catch (e) {
    return c.json({ error: 'Transcription worker unavailable' }, 502)
  }
})

// vtaiwan-jaas-jwt-worker 代理（Jitsi Meet 取得 JWT）
const JAAS_WORKER = 'https://vtaiwan-jaas-jwt-worker.bestian123.workers.dev'

app.get('/api/jitsi/token', async (c) => {
  try {
    const qs = c.req.url.split('?')[1] ?? ''
    const res = await fetch(`${JAAS_WORKER}/api/jitsi-token?${qs}`)
    const data = await res.json()
    return c.json(data, res.status as Parameters<typeof c.json>[1])
  } catch (e) {
    return c.json({ error: 'JAAS worker unavailable' }, 502)
  }
})

// vtaiwan-transcription-worker 音訊轉錄代理
app.post('/api/transcriptions/transcription/:date', async (c) => {
  try {
    const date = c.req.param('date')
    const body = await c.req.raw.arrayBuffer()
    const contentType = c.req.header('content-type') ?? 'application/octet-stream'
    const res = await fetch(`${TRANSCRIPTION_WORKER}/api/transcription/${date}`, {
      method: 'POST',
      headers: { 'Content-Type': contentType },
      body,
    })
    const data = await res.json()
    return c.json(data, res.status as Parameters<typeof c.json>[1])
  } catch (e) {
    return c.json({ error: 'Transcription worker unavailable' }, 502)
  }
})

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
