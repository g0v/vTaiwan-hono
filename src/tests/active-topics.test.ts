import { describe, expect, it } from 'vite-plus/test'
import { selectActiveTopics } from '../lib/active-topics'
import type { FormattedTopicData } from '../lib/discourse-types'

function makeTopic(id: number, status: string, date: string): FormattedTopicData {
  return {
    id,
    title: `議題 ${id}`,
    routeName: `topic-${id}`,
    status,
    slogan: `說明 ${id}`,
    owner: '',
    cover: '',
    tags: [],
    views: id,
    posts_count: id,
    participant_count: id,
    last_posted_at: date,
    created_at: date,
  }
}

describe('首頁進行中議題', () => {
  it('排除非進行中狀態並依更新時間顯示前三筆', () => {
    const topics = [
      makeTopic(1, '意見徵集', '2026-08-01T00:00:00.000Z'),
      makeTopic(2, '研擬草案', '2026-08-04T00:00:00.000Z'),
      makeTopic(3, '歷史案件', '2026-08-10T00:00:00.000Z'),
      makeTopic(4, '送交院會', '2026-08-03T00:00:00.000Z'),
      makeTopic(5, '即將開始', '2026-08-02T00:00:00.000Z'),
      makeTopic(6, '意見徵集', '2026-08-05T00:00:00.000Z'),
      makeTopic(7, '即將開始', '2026-07-31T00:00:00.000Z'),
      { ...makeTopic(8, '即將開始', '2026-08-12T00:00:00.000Z'), title: '網站基本設定' },
    ]

    expect(selectActiveTopics(topics).map(topic => topic.id)).toEqual([6, 5, 1])
  })

  it('不改動原始議題順序', () => {
    const topics = [makeTopic(1, '意見徵集', '2026-08-01T00:00:00.000Z'), makeTopic(2, '即將開始', '2026-08-02T00:00:00.000Z')]

    selectActiveTopics(topics)

    expect(topics.map(topic => topic.id)).toEqual([1, 2])
  })
})
