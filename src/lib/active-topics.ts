import type { FormattedTopicData } from './discourse-types'

const inactiveStatuses = new Set(['歷史案件', '研擬草案', '送交院會'])

export function selectActiveTopics(topics: FormattedTopicData[], limit = 3): FormattedTopicData[] {
  return topics
    .filter(topic => topic.title !== '網站基本設定' && !inactiveStatuses.has(topic.status))
    .sort((a, b) => new Date(b.last_posted_at || b.created_at).getTime() - new Date(a.last_posted_at || a.created_at).getTime())
    .slice(0, limit)
}
