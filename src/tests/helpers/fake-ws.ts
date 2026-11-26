/**
 * MeetingRoom DO 測試用的替身（#153 步驟 2）：假 WebSocket、假 DurableObjectState、假 D1。
 *
 * 每個替身都是「我們猜 Cloudflare 會這樣行為」的模型，所以只模仿測試真正依賴的語意：
 *   - attachment 是**副本**：serializeAttachment / deserializeAttachment 都 structuredClone。
 *     這是刻意的——若回傳同一個物件，DO 忘記 serializeAttachment 的 bug 會被測試遮掉。
 *   - close() 後 readyState 變 CLOSING，但連線**仍留在** getWebSockets() 裡，
 *     對應官方文件「close() 後 getWebSockets() 仍可能回傳 CLOSING 連線」。
 *   - D1 只實作 MeetingRoom 會發的那幾句 SQL，其餘一律拋錯，避免測試悄悄略過。
 */

import type { ServerMessage } from '../../durable-objects/meeting-room'

export const WS_OPEN = 1
export const WS_CLOSING = 2

export interface FakeMeta {
  isAuthenticated: boolean
  userId: string | null
  name: string | null
  capturing: boolean
  date: string
}

export class FakeWebSocket {
  readyState = WS_OPEN
  sent: ServerMessage[] = []
  private attachment: unknown

  constructor(meta: unknown) {
    this.attachment = structuredClone(meta)
  }

  serializeAttachment(value: unknown): void {
    this.attachment = structuredClone(value)
  }

  deserializeAttachment(): unknown {
    return structuredClone(this.attachment)
  }

  send(payload: string): void {
    this.sent.push(JSON.parse(payload) as ServerMessage)
  }

  close(_code?: number, _reason?: string): void {
    this.readyState = WS_CLOSING
  }

  /** 最後一則 capture_list 的名單；沒收過回 undefined */
  get lastCaptureList() {
    const msg = [...this.sent].reverse().find(m => m.type === 'capture_list')
    return msg && msg.type === 'capture_list' ? msg.capturers : undefined
  }

  get captureListCount(): number {
    return this.sent.filter(m => m.type === 'capture_list').length
  }

  get errors(): string[] {
    return this.sent.flatMap(m => (m.type === 'error' ? [m.message] : []))
  }

  asWebSocket(): WebSocket {
    return this as unknown as WebSocket
  }
}

/** 假 DurableObjectState：只提供 getWebSockets／acceptWebSocket */
export function fakeCtx(sockets: FakeWebSocket[]): DurableObjectState {
  return {
    getWebSockets: () => sockets,
    acceptWebSocket: (ws: FakeWebSocket) => {
      sockets.push(ws)
    },
  } as unknown as DurableObjectState
}

type SessionRow = { date: string; recorder_uid: string | null; recording_speaker: string | null; recording_start_time: number | null }

/** 假 D1：只模擬 meeting_sessions 的 upsert 與讀取，逐字稿一律空 */
export class FakeD1 {
  sessions = new Map<string, SessionRow>()
  executed: string[] = []

  prepare(sql: string) {
    const statement = (values: unknown[]) => ({
      run: async () => {
        this.executed.push(sql)
        if (sql.startsWith('INSERT OR IGNORE INTO meeting_sessions')) {
          const [date] = values as [string]
          if (!this.sessions.has(date)) this.sessions.set(date, { date, recorder_uid: null, recording_speaker: null, recording_start_time: null })
          return { meta: { changes: 1 } }
        }
        if (sql.startsWith('UPDATE meeting_sessions SET')) {
          const date = values.at(-1) as string
          const row = this.sessions.get(date)
          if (!row) return { meta: { changes: 0 } }
          const columns = [...sql.matchAll(/(\w+) = \?/g)].map(m => m[1] as keyof SessionRow)
          columns.forEach((column, i) => {
            ;(row as Record<string, unknown>)[column] = values[i] ?? null
          })
          return { meta: { changes: 1 } }
        }
        throw new Error(`FakeD1 不支援的 SQL：${sql}`)
      },
      first: async () => {
        this.executed.push(sql)
        if (sql.startsWith('SELECT * FROM meeting_sessions')) return this.sessions.get(values[0] as string) ?? null
        throw new Error(`FakeD1 不支援的 SQL：${sql}`)
      },
      all: async () => {
        this.executed.push(sql)
        if (sql.startsWith('SELECT * FROM meeting_transcript_entries')) return { results: [] }
        throw new Error(`FakeD1 不支援的 SQL：${sql}`)
      },
    })
    return { bind: (...values: unknown[]) => statement(values) }
  }

  asD1(): D1Database {
    return this as unknown as D1Database
  }
}
