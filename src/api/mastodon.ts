import { corsFor } from './cors'
import type { App } from './types'

// Mastodon timeline 快取 TTL（秒）— 5 分鐘；與 Discourse 相同頻率。
// 避免同一個 #vtaiwan tag 的 timeline 被頻繁重複拉取。
const MASTODON_CACHE_TTL_SECONDS = 300

export function registerMastodonApi(app: App) {
  app.use('/api/mastodon', corsFor(['GET']))
  app.get('/api/mastodon', async c => {
    const token = c.env.MASTODON_TOKEN
    if (!token) return c.json({ error: 'MASTODON_TOKEN not configured' }, 500)

    // cf.cacheEverything：強制 Cloudflare edge 快取此回應。
    // 帶 Authorization header 的請求，Cloudflare 預設不快取；
    // cacheEverything: true 明確覆寫此行為，讓所有 Worker 實例共用同一份快取。
    // timeline 資料與呼叫者身分無關，快取同一份公開結果是安全的。
    const response = await fetch('https://g0v.social/api/v1/timelines/tag/vtaiwan?limit=20&local=true', {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      cf: {
        cacheEverything: true,
        cacheTtlByStatus: {
          '200-299': MASTODON_CACHE_TTL_SECONDS,
          '300-599': 0,
        },
      },
    })
    const data = await response.json()
    return c.json(data, response.status as Parameters<typeof c.json>[1])
  })
}
