import { describe, expect, it, vi } from 'vite-plus/test'
import app from '../index'
import discourseApi from '../lib/discourse'

describe('/api/discourse Cache API', () => {
  it('client 只合併進行中的相同請求，不保留無期限快取', async () => {
    const fetchSpy = vi.fn(async () => new Response('[]', { headers: { 'Content-Type': 'application/json' } }))
    vi.stubGlobal('fetch', fetchSpy)

    try {
      await Promise.all([discourseApi.getFormattedTopics(), discourseApi.getFormattedTopics()])
      await discourseApi.getFormattedTopics()

      expect(fetchSpy).toHaveBeenCalledTimes(2)
    } finally {
      vi.unstubAllGlobals()
    }
  })

  it('單一議題後續請求命中 Cache API，不再發出上游請求', async () => {
    const entries = new Map<string, Response>()
    const cache = {
      match: vi.fn(async (request: Request) => entries.get(request.url)?.clone()),
      put: vi.fn(async (request: Request, response: Response) => {
        entries.set(request.url, response.clone())
      }),
    }
    const fetchSpy = vi.fn(
      async () =>
        new Response(JSON.stringify({ id: 42 }), {
          headers: { 'Content-Type': 'application/json' },
        })
    )
    vi.stubGlobal('caches', { open: vi.fn(async () => cache) })
    vi.stubGlobal('fetch', fetchSpy)

    try {
      const firstResponse = await app.request('/api/discourse/topic/42')
      const secondResponse = await app.request('/api/discourse/topic/42')

      expect(firstResponse.status).toBe(200)
      await expect(firstResponse.json()).resolves.toEqual({ id: 42 })
      expect(fetchSpy).toHaveBeenCalledTimes(1)
      expect(cache.put.mock.calls[0]?.[1]?.headers.get('Cache-Control')).toBe('public, max-age=86400')
      await expect(secondResponse.json()).resolves.toEqual({ id: 42 })
    } finally {
      vi.unstubAllGlobals()
    }
  })

  it('完整議題清單只快取 aggregate response，不因大量 topic 超過 Cache API 上限', async () => {
    const entries = new Map<string, Response>()
    let cacheOperations = 0
    const cache = {
      match: vi.fn(async (request: Request) => {
        cacheOperations += 1
        if (cacheOperations > 50) throw new Error('Cache API call limit exceeded')
        return entries.get(request.url)?.clone()
      }),
      put: vi.fn(async (request: Request, response: Response) => {
        cacheOperations += 1
        if (cacheOperations > 50) throw new Error('Cache API call limit exceeded')
        entries.set(request.url, response.clone())
      }),
    }
    const fetchSpy = vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url
      const body =
        url.includes('/c/meta-data.json') && url.includes('page=0')
          ? { topic_list: { topics: Array.from({ length: 30 }, (_, index) => ({ id: index + 1 })) } }
          : url.includes('/c/meta-data.json')
            ? { topic_list: { topics: [] } }
            : {
                id: Number(/\/t\/(\d+)\.json/.exec(url)?.[1]),
                title: '議題名稱 topic-name',
                posts_count: 3,
                views: 4,
                participant_count: 5,
                last_posted_at: '2026-08-10T00:00:00.000Z',
                created_at: '2026-08-01T00:00:00.000Z',
                tags: [],
                pinned: false,
                post_stream: {
                  posts: [{ id: 1, raw: 'slogan : 測試標語', cooked: '', username: '', avatar_template: '', created_at: '', post_number: 1 }],
                },
              }
      return new Response(JSON.stringify(body), { headers: { 'Content-Type': 'application/json' } })
    })
    vi.stubGlobal('caches', { open: vi.fn(async () => cache) })
    vi.stubGlobal('fetch', fetchSpy)

    try {
      const response = await app.request('/api/discourse/topics?detailed=1')
      const cachedResponse = await app.request('/api/discourse/topics?detailed=1')

      expect(response.status).toBe(200)
      expect(cachedResponse.status).toBe(200)
      await expect(response.json()).resolves.toEqual(
        expect.arrayContaining([expect.objectContaining({ id: 1, routeName: 'topic-name', slogan: '測試標語' }), expect.objectContaining({ id: 30, routeName: 'topic-name', slogan: '測試標語' })])
      )
      await expect(cachedResponse.json()).resolves.toHaveLength(30)
      expect(fetchSpy).toHaveBeenCalledTimes(32)
      expect(cacheOperations).toBe(3)
      expect(cache.put.mock.calls.map(([, response]) => response.headers.get('Cache-Control'))).toEqual(['public, max-age=900'])
    } finally {
      vi.unstubAllGlobals()
    }
  })
})
