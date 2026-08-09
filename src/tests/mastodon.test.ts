/**
 * /api/mastodon 快取選項驗證
 *
 * vi.stubGlobal 替換全域 fetch，驗證 cf.cacheEverything 選項確實有傳入，
 * 這是本次修正（#94）的核心行為。
 *
 * 注意：cf 選項實際是否讓 Cloudflare edge 快取 Authorization 請求，
 * 需上線後以 `cf-cache-status: HIT` 回應 header 確認（本機不可驗）。
 */

import { describe, expect, it, vi } from 'vite-plus/test'
import app from '../index'

describe('/api/mastodon 上游請求帶 cf 快取選項', () => {
  it('傳 MASTODON_TOKEN 後上游請求帶 cf.cacheEverything，回 200', async () => {
    const fetchSpy = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => new Response('[]', { headers: { 'Content-Type': 'application/json' } }))
    vi.stubGlobal('fetch', fetchSpy)
    try {
      const res = await app.request('/api/mastodon', {}, { MASTODON_TOKEN: 'test-token' })
      expect(res.status).toBe(200)
      // 驗證 Cloudflare edge 快取選項確實有傳入 fetch
      expect(fetchSpy.mock.calls[0]?.[1]).toMatchObject({
        cf: { cacheEverything: true, cacheTtlByStatus: { '200-299': 300, '300-599': 0 } },
      })
    } finally {
      vi.unstubAllGlobals()
    }
  })

  it('未設 MASTODON_TOKEN → 500，不打上游', async () => {
    const fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)
    try {
      // 不傳 env，MASTODON_TOKEN 為 undefined
      const res = await app.request('/api/mastodon')
      expect(res.status).toBe(500)
      expect(fetchSpy).not.toHaveBeenCalled()
    } finally {
      vi.unstubAllGlobals()
    }
  })
})
