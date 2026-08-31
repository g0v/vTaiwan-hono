// 議題書籤的純資料操作；瀏覽器儲存由 View 在 mounted 後處理，避免 SSR 存取 browser API。
export const TOPIC_BOOKMARKS_STORAGE_KEY = 'bookmarkedTopics'

export function parseBookmarkedTopicIds(value: string | null): number[] {
  if (!value) return []

  try {
    const parsed: unknown = JSON.parse(value)
    if (!Array.isArray(parsed)) return []

    return [...new Set(parsed.filter((id): id is number => typeof id === 'number' && Number.isSafeInteger(id) && id > 0))]
  } catch {
    return []
  }
}

export function toggleBookmarkedTopicId(bookmarkedIds: number[], topicId: number): number[] {
  if (!Number.isSafeInteger(topicId) || topicId <= 0) return bookmarkedIds

  return bookmarkedIds.includes(topicId) ? bookmarkedIds.filter(id => id !== topicId) : [...bookmarkedIds, topicId]
}
