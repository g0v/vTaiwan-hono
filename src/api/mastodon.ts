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

    // cf.cacheEverything：請求 Cloudflare edge 強制快取此回應（包括覆蓋上游 cache-control）。
    // timeline 資料為公開內容，與呼叫者身分無關，所有請求共用同一份快取是安全的。
    // ⚠️ Authorization header 是否影響 Cloudflare 實際快取行為，需上線後以
    // 回應的 `cf-cache-status: HIT` header 確認（本機測試環境不可驗）。
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
