// Discourse 伺服器端存取（僅在 Cloudflare Worker 執行；不進 client bundle，避免瀏覽器端跨網域 CORS）
import type { DiscourseTopic } from './discourse-types'

const DISCOURSE_BASE_URL = 'https://talk.vtaiwan.tw'

interface TopicListResponse {
  topic_list?: {
    topics?: DiscourseTopic[]
  }
}

// per-isolate 快取（盡力而為；Worker isolate 存活期間有效）
const cache = new Map<string, unknown>()

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
  if (cache.has(path)) {
    return cache.get(path) as T
  }

  const url = `${DISCOURSE_BASE_URL}${path}`
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 10000)

  try {
    const response = await fetch(url, {
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    })
    if (!response.ok) {
      throw new Error(`Discourse API error: ${response.status}`)
    }
    const data = (await response.json()) as T
    cache.set(path, data)
    return data
  } finally {
    clearTimeout(timeoutId)
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
