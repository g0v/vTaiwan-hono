/**
 * /api/proxy 參數驗證測試
 *
 * 驗證路徑：
 * 1. 400/403 的早期回傳（在 fetch 之前，不需要網路）
 * 2. 白名單主機通過驗證後，上游請求帶有 cf 快取選項（vi.stubGlobal 替代真實 fetch）
 *
 * 快取行為（cf.cacheEverything）只在 Cloudflare edge runtime 生效，
 * 不在本機測試環境驗證；但 cf 選項有否被傳入 fetch 是可觀察的。
 */

import { describe, expect, it, vi } from 'vite-plus/test'
import app from '../index'

describe('/api/proxy 參數驗證', () => {
  it('缺少 url 參數 → 400', async () => {
    const res = await app.request('/api/proxy')
    expect(res.status).toBe(400)
    const body = (await res.json()) as { error: string }
    expect(body.error).toBe('Missing url parameter')
  })

  it('無效的 URL 字串 → 400', async () => {
    const res = await app.request('/api/proxy?url=not-a-valid-url')
    expect(res.status).toBe(400)
    const body = (await res.json()) as { error: string }
    expect(body.error).toBe('Invalid url')
  })

  it('非 http(s) 協定 → 400', async () => {
    const res = await app.request('/api/proxy?url=ftp%3A%2F%2Fexample.com%2Ffeed')
    expect(res.status).toBe(400)
    const body = (await res.json()) as { error: string }
    expect(body.error).toBe('Only http(s) URLs are allowed')
  })

  it('不在白名單的主機 → 403', async () => {
    const res = await app.request('/api/proxy?url=https%3A%2F%2Fevil.example.com%2Ffeed')
    expect(res.status).toBe(403)
    const body = (await res.json()) as { error: string; hostname: string }
    expect(body.error).toBe('Target host not allowed')
    expect(body.hostname).toBe('evil.example.com')
  })
})

describe('/api/proxy 上游請求帶 cf 快取選項', () => {
  // 用 vi.stubGlobal 替換 fetch，避免真實網路請求（也避免打到已在 429 的 Substack）。
  // 同時驗證 cf.cacheEverything 選項確實有被傳入，這是本次修正的核心行為。
  it('vtaiwantw.substack.com 請求帶 cf cache 選項，回 200', async () => {
    const fetchSpy = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => new Response('<rss/>', { headers: { 'Content-Type': 'application/xml' } }))
    vi.stubGlobal('fetch', fetchSpy)
    try {
      const res = await app.request('/api/proxy?url=https%3A%2F%2Fvtaiwantw.substack.com%2Ffeed')
      expect(res.status).toBe(200)
      expect(fetchSpy.mock.calls[0]?.[1]).toMatchObject({
        cf: { cacheEverything: true, cacheTtlByStatus: { '200-299': 600, '300-599': 0 } },
      })
    } finally {
      vi.unstubAllGlobals()
    }
  })

  it('medium.com 請求帶 cf cache 選項，回 200', async () => {
    const fetchSpy = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => new Response('<rss/>', { headers: { 'Content-Type': 'application/xml' } }))
    vi.stubGlobal('fetch', fetchSpy)
    try {
      const res = await app.request('/api/proxy?url=https%3A%2F%2Fmedium.com%2Fsome-feed')
      expect(res.status).toBe(200)
      expect(fetchSpy.mock.calls[0]?.[1]).toMatchObject({
        cf: { cacheEverything: true, cacheTtlByStatus: { '200-299': 600, '300-599': 0 } },
      })
    } finally {
      vi.unstubAllGlobals()
    }
  })
})
