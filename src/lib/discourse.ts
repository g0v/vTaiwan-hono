// Discourse client：透過本站 /api/discourse/* 代理取得資料（不直接跨網域打 talk.vtaiwan.tw，
// 實際抓取與分頁邏輯在 Worker 端 discourse-server.ts；此檔僅薄封裝 + 型別轉出，體積極小）。
import { formatTopicData, type DiscourseTopic, type FormattedTopicData } from './discourse-types'

export type { DiscoursePost, DiscourseTopic, FormattedTopicData } from './discourse-types'

// 依 path 合併進行中的請求；資料快取統一由 Worker 端的 Cache API 管理。
const inFlightRequests = new Map<string, Promise<unknown>>()

// 契約：依 path 合併進行中的請求；請求結束後移除，避免 client 端無期限保留舊資料。
// （回傳 Promise 且含多敘述 lambda，LemmaScript 不可建模，故不做標注）
function getJson<T>(path: string): Promise<T> {
  const inFlightRequest = inFlightRequests.get(path)
  if (inFlightRequest) return inFlightRequest as Promise<T>

  const promise = fetch(path, { headers: { Accept: 'application/json' } })
    .then(response => {
      if (!response.ok) throw new Error(`Discourse proxy error: ${response.status}`)
      return response.json() as Promise<T>
    })
    .finally(() => inFlightRequests.delete(path))
  inFlightRequests.set(path, promise)
  return promise
}

export interface DiscourseAPI {
  getAllTopics(): Promise<DiscourseTopic[]>
  getFormattedTopics(): Promise<FormattedTopicData[]>
  getAllCategoryTopics(categoryUri: string): Promise<DiscourseTopic[]>
  getTopic(topicId: string | number): Promise<DiscourseTopic>
  formatTopicData(topicData: DiscourseTopic): FormattedTopicData
}

const discourseAPI: DiscourseAPI = {
  getAllTopics() {
    return getJson<DiscourseTopic[]>('/api/discourse/topics')
  },

  getFormattedTopics() {
    return getJson<FormattedTopicData[]>('/api/discourse/topics?detailed=1')
  },

  getAllCategoryTopics(categoryUri: string) {
    return getJson<DiscourseTopic[]>(`/api/discourse/topics?category=${encodeURIComponent(categoryUri)}`)
  },

  getTopic(topicId: string | number) {
    return getJson<DiscourseTopic>(`/api/discourse/topic/${encodeURIComponent(String(topicId))}`)
  },

  formatTopicData,
}

export default discourseAPI
