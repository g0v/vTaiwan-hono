// Discourse 伺服器端存取（僅在 Cloudflare Worker 執行；不進 client bundle，避免瀏覽器端跨網域 CORS）
import { formatTopicData, type DiscourseTopic, type FormattedTopicData } from './discourse-types'

const DISCOURSE_BASE_URL = 'https://talk.vtaiwan.tw'
const DISCOURSE_CACHE_KEY_ORIGIN = 'https://next.vtaiwan.tw'

interface TopicListResponse {
  topic_list?: {
    topics?: DiscourseTopic[]
  }
}

// 清單變動較頻繁；個別議題內容大多穩定，分別使用不同快取時間。
const DISCOURSE_LIST_CACHE_TTL_SECONDS = 900
const DISCOURSE_TOPIC_CACHE_TTL_SECONDS = 86_400
const DISCOURSE_DETAIL_CONCURRENCY = 6

// 同一 isolate 內只合併尚在進行的相同請求；資料快取交由 Cloudflare Cache API 與 TTL 管理。
const inFlightRequests = new Map<string, Promise<unknown>>()

// 只允許相對於 talk.vtaiwan.tw 的路徑：剝除同源 origin，拒絕其他 host
function normalizePath(input: string): string {
  let path = input
  if (path.startsWith('http')) {
    const u = new URL(path)
    if (u.hostname !== 'talk.vtaiwan.tw') {
      throw new Error(`Disallowed discourse host: ${u.hostname}`)
    }
    path = u.pathname + u.search
  }
  return path.startsWith('/') ? path : `/${path}`
}

function cacheKeyFor(path: string): Request {
  return new Request(`${DISCOURSE_CACHE_KEY_ORIGIN}/__cache/discourse${path}`)
}

async function fetchDiscourseJson<T>(path: string, cacheTtlSeconds: number): Promise<T> {
  const url = `${DISCOURSE_BASE_URL}${path}`
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 10000)

  try {
    const requestInit = {
      headers: { Accept: 'application/json' },
      signal: controller.signal,
      cf: {
        cacheEverything: true,
        cacheTtlByStatus: {
          '200-299': cacheTtlSeconds,
          '300-599': 0,
        },
      },
    }
    const response = await fetch(url, requestInit)
    if (!response.ok) {
      throw new Error(`Discourse API error: ${response.status}`)
    }
    return (await response.json()) as T
  } finally {
    clearTimeout(timeoutId)
  }
}

async function cachedValue<T>(path: string, cacheTtlSeconds: number, load: () => Promise<T>): Promise<T> {
  const inFlightRequest = inFlightRequests.get(path)
  if (inFlightRequest) {
    return inFlightRequest as Promise<T>
  }

  const request = (async () => {
    const cacheKey = cacheKeyFor(path)
    const cache = await caches.open('discourse')
    const cachedResponse = await cache.match(cacheKey)
    if (cachedResponse) {
      return (await cachedResponse.json()) as T
    }

    const value = await load()
    await cache.put(
      cacheKey,
      new Response(JSON.stringify(value), {
        headers: {
          'Cache-Control': `public, max-age=${cacheTtlSeconds}`,
          'Content-Type': 'application/json',
        },
      })
    )
    return value
  })()

  inFlightRequests.set(path, request)
  try {
    return await request
  } finally {
    inFlightRequests.delete(path)
  }
}

async function cachedGet<T>(path: string, cacheTtlSeconds: number): Promise<T> {
  return cachedValue(path, cacheTtlSeconds, () => fetchDiscourseJson<T>(path, cacheTtlSeconds))
}

async function fetchPaginatedTopics(
  categoryUri: string,
  fetchTopicsPage: (path: string) => Promise<TopicListResponse> = path => cachedGet<TopicListResponse>(path, DISCOURSE_LIST_CACHE_TTL_SECONDS)
): Promise<DiscourseTopic[]> {
  const allTopics: DiscourseTopic[] = []

  const getTopics = async (uri: string, page: number): Promise<DiscourseTopic[]> => {
    try {
      const processedUri = normalizePath(uri)
      const path = processedUri + (processedUri.includes('?') ? '&' : '?') + `include_raw=1&page=${page}`
      const response = await fetchTopicsPage(path)
      const topics = response.topic_list?.topics

      if (!topics) return allTopics

      if (topics.length > 0) {
        allTopics.push(...topics)
        return getTopics(uri, page + 1)
      }
      return allTopics
    } catch (error) {
      if (page === 0) throw error
      console.error('Failed to fetch topics page', page, ':', error)
      return allTopics
    }
  }

  return getTopics(categoryUri, 0)
}

// 全部議題（categoryUri 預設 meta-data 分類；亦用於指定分類）
export function getAllTopics(categoryUri = '/c/meta-data.json'): Promise<DiscourseTopic[]> {
  return fetchPaginatedTopics(categoryUri)
}

// 單一議題（含 raw 內文）
export function getTopic(topicId: string | number): Promise<DiscourseTopic> {
  return cachedGet<DiscourseTopic>(`/t/${topicId}.json?include_raw=1`, DISCOURSE_TOPIC_CACHE_TTL_SECONDS)
}

// 提供列表頁一次取得的完整資料；完整結果以單一 Cache API 項目快取，冷快取時限制並行數保護上游。
export async function getFormattedTopics(categoryUri = '/c/meta-data.json'): Promise<FormattedTopicData[]> {
  const normalizedCategoryUri = normalizePath(categoryUri)
  const cachePath = `/formatted-topics${normalizedCategoryUri}`

  return cachedValue(cachePath, DISCOURSE_LIST_CACHE_TTL_SECONDS, async () => {
    // 完整列表只快取一次；內部請求不重複使用 Cache API，以免大量議題超過每請求的呼叫上限。
    const topics = await fetchPaginatedTopics(normalizedCategoryUri, path => fetchDiscourseJson<TopicListResponse>(path, DISCOURSE_LIST_CACHE_TTL_SECONDS))
    const formattedTopics: FormattedTopicData[] = []

    for (let start = 0; start < topics.length; start += DISCOURSE_DETAIL_CONCURRENCY) {
      const batch = topics.slice(start, start + DISCOURSE_DETAIL_CONCURRENCY)
      const results = await Promise.allSettled(
        batch.map(async topic => formatTopicData(await fetchDiscourseJson<DiscourseTopic>(`/t/${topic.id}.json?include_raw=1`, DISCOURSE_TOPIC_CACHE_TTL_SECONDS)))
      )

      for (const result of results) {
        if (result.status === 'fulfilled') formattedTopics.push(result.value)
      }
    }

    return formattedTopics
  })
}
