// Discourse 伺服器端存取（僅在 Cloudflare Worker 執行；不進 client bundle，避免瀏覽器端跨網域 CORS）
import type { DiscourseTopic } from './discourse-types'

const DISCOURSE_BASE_URL = 'https://talk.vtaiwan.tw'

interface TopicListResponse {
  topic_list?: {
    topics?: DiscourseTopic[]
  }
}

const DISCOURSE_CACHE_TTL_SECONDS = 300

// 同一 isolate 內只合併尚在進行的相同請求；資料快取交由 Cloudflare edge cache 與 TTL 管理。
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

async function cachedGet<T>(path: string): Promise<T> {
  const inFlightRequest = inFlightRequests.get(path)
  if (inFlightRequest) {
    return inFlightRequest as Promise<T>
  }

  const request = (async () => {
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
            '200-299': DISCOURSE_CACHE_TTL_SECONDS,
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
  })()

  inFlightRequests.set(path, request)
  try {
    return await request
  } finally {
    inFlightRequests.delete(path)
  }
}

async function fetchPaginatedTopics(categoryUri: string): Promise<DiscourseTopic[]> {
  const allTopics: DiscourseTopic[] = []

  const getTopics = async (uri: string, page: number): Promise<DiscourseTopic[]> => {
    try {
      const processedUri = normalizePath(uri)
      const path = processedUri + (processedUri.includes('?') ? '&' : '?') + `include_raw=1&page=${page}`
      const data = await cachedGet<TopicListResponse>(path)

      const topics = data?.topic_list?.topics
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
  return cachedGet<DiscourseTopic>(`/t/${topicId}.json?include_raw=1`)
}
