import type { D1Database } from '@cloudflare/workers-types'
import { describe, expect, it } from 'vite-plus/test'
import { CIVIC_TALK_EVENT_PAGE_SIZE, listCivicTalkCreationEvents } from '../server/lib/civic-talk'

interface RecordedStatement {
  query: string
  values: unknown[]
}

function createEventDatabase(total: number): { db: D1Database; statements: RecordedStatement[] } {
  const statements: RecordedStatement[] = []
  const db = {
    prepare(query: string) {
      return {
        bind(...values: unknown[]) {
          statements.push({ query, values })
          return { query, values }
        },
      }
    },
    async batch() {
      return [{ results: [{ total }] }, { results: [] }]
    },
  }

  return { db: db as unknown as D1Database, statements }
}

describe('Civic Talk 事件記錄搜尋', () => {
  it('以議題標題與各類事件內容搜尋，並保留分頁', async () => {
    const { db, statements } = createEventDatabase(16)

    const result = await listCivicTalkCreationEvents(db, 2, '年金%_\\')

    expect(result).toMatchObject({ page: 2, pageSize: CIVIC_TALK_EVENT_PAGE_SIZE, total: 16, totalPages: 2, events: [] })
    expect(statements).toHaveLength(2)
    expect(statements[0].query).toContain("issue_title LIKE ? ESCAPE '\\'")
    expect(statements[0].query).toContain("summary LIKE ? ESCAPE '\\'")
    expect(statements[0].values).toEqual(Array.from({ length: 8 }, () => '%年金\\%\\_\\\\%'))
    expect(statements[1].values).toEqual([...Array.from({ length: 8 }, () => '%年金\\%\\_\\\\%'), CIVIC_TALK_EVENT_PAGE_SIZE, CIVIC_TALK_EVENT_PAGE_SIZE])
  })
})
