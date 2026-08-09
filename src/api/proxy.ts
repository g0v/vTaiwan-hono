import { corsFor } from './cors'
import type { App } from './types'

const allowedHosts = ['medium.com', 'vtaiwantw.substack.com']

// RSS feed 快取 TTL（秒）— 10 分鐘足以吸收突發流量，不至於內容落後太多。
// 與 discourse-server.ts 的 DISCOURSE_CACHE_TTL_SECONDS 命名慣例一致。
const PROXY_CACHE_TTL_SECONDS = 600

export function registerProxyApi(app: App) {
  app.use('/api/proxy', corsFor(['GET']))
  app.get('/api/proxy', async c => {
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

    const isAllowed = allowedHosts.some(host => targetUrl.hostname === host || targetUrl.hostname.endsWith(`.${host}`))
    if (!isAllowed) {
      return c.json({ error: 'Target host not allowed', hostname: targetUrl.hostname }, 403)
    }

    try {
      // cf.cacheEverything：強制 Cloudflare edge 快取此回應（即使上游沒有設 Cache-Control）。
      // cf.cacheTtlByStatus：成功回應快取 PROXY_CACHE_TTL_SECONDS 秒；
      //   3xx–5xx（含上游的 429）TTL=0，不快取，避免暫時性錯誤被固定下來。
      // 此模式與 discourse-server.ts 的 cachedGet 一致。
      const upstream = await fetch(targetUrl.toString(), {
        headers: { Accept: 'application/rss+xml, application/xml, text/xml, */*' },
        redirect: 'follow',
        cf: {
          cacheEverything: true,
          cacheTtlByStatus: {
            '200-299': PROXY_CACHE_TTL_SECONDS,
            '300-599': 0,
          },
        },
      })
      const contentType = upstream.headers.get('Content-Type') || 'text/xml'
      const body = await upstream.arrayBuffer()
      return new Response(body, {
        status: upstream.status,
        headers: { 'Content-Type': contentType },
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      return c.json({ error: 'Upstream request failed', message }, 502)
    }
  })
}
