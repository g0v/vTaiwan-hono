/**
 * 測試用的假 D1：只模擬 meeting_transcript_entries 的主鍵 (meeting_date, ts) 行為，
 * 供 meeting-entries.test.ts 與 meeting-room.test.ts 共用。
 *
 * 只實作 `src/server/lib/meeting-entries.ts` 會發出的兩句 SQL；其餘一律拋錯，避免測試悄悄略過。
 */

export type FakeEntryRow = { entry_id: string | null; speaker: string | null; text: string; speaker_uid: string | null; source: string | null }

export class FakeD1 {
  rows = new Map<string, FakeEntryRow>()
  executed: string[] = []

  prepare(sql: string) {
    return {
      bind: (...values: unknown[]) => ({
        run: async () => {
          this.executed.push(sql)
          if (sql.startsWith('INSERT OR IGNORE INTO meeting_transcript_entries')) {
            const [date, ts, entry_id, speaker, text, speaker_uid, source] = values as [string, number, string | null, string | null, string, string | null, string | null]
            const key = `${date}:${ts}`
            if (this.rows.has(key)) return { meta: { changes: 0 } }
            this.rows.set(key, { entry_id, speaker, text, speaker_uid, source })
            return { meta: { changes: 1 } }
          }
          if (sql.startsWith('UPDATE meeting_transcript_entries')) {
            const [entry_id, speaker, text, date, ts] = values as [string | null, string | null, string, string, number]
            const row = this.rows.get(`${date}:${ts}`)
            if (!row) return { meta: { changes: 0 } }
            Object.assign(row, { entry_id, speaker, text })
            return { meta: { changes: 1 } }
          }
          throw new Error(`FakeD1 不支援的 SQL：${sql}`)
        },
      }),
    }
  }

  asD1(): D1Database {
    return this as unknown as D1Database
  }
}
