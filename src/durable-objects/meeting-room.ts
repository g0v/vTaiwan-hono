import { DurableObject } from 'cloudflare:workers'

/**
 * MeetingRoom Durable Object — 即時會議資料的單一來源（#81）
 *
 * 一個 DO 實例對應一個會議日期（`meeting-YYYYMMDD`）。
 * 職責：
 *   - 管理 WebSocket 連線（任何人可連、僅認證用戶可寫）
 *   - 把寫入廣播給所有連線客戶端
 *   - 把所有變更持久化到 D1（meeting_sessions / meeting_transcript_entries）
 *
 * 架構決策：
 *   - 使用 WebSocket Hibernation API（ctx.acceptWebSocket），讓 DO 在無活躍連線時可被休眠
 *   - 每次訊息都從 D1 讀取狀態（無全域 in-memory 快取），以避免 DO 休眠後狀態遺失
 *   - 例外：初次 `fetch()` 時把完整快照送給新連線的客戶端，之後只廣播差量
 *   - 認證由 Worker 在 WebSocket Upgrade 時完成，結果以 serializeAttachment 綁定至各連線
 */

// ─── D1 行型別 ────────────────────────────────────────────────────────────────

interface MeetingSessionRow {
  date: string
  recorder_uid: string | null
  recording_speaker: string | null
  recording_start_time: number | null
}

interface TranscriptEntryRow {
  meeting_date: string
  ts: number
  entry_id: string | null
  speaker: string | null
  text: string
}

// ─── 公開型別（JitsiView 的資料模型對映） ─────────────────────────────────────

/** 逐字稿條目，對應 JitsiView.transcriptData 的 value 型別 */
export interface TranscriptEntry {
  id: string | null
  timestamp: number
  speaker: string
  text: string
}

/** 會議狀態，對應 JitsiView.meetingData 的欄位 */
export interface MeetingSession {
  recorderUid: string | null
  recordingSpeaker: string | null
  recordingStartTime: number | null
}

// ─── WebSocket 訊息協定 ────────────────────────────────────────────────────────

/** 客戶端 → 伺服器的訊息（僅認證用戶） */
type ClientMessage =
  | { type: 'save_entry'; entry: TranscriptEntry }
  | { type: 'delete_entry'; timestamp: number }
  | { type: 'update_meeting'; recorder_uid: string | null }
  | { type: 'sync_recording'; recording_speaker: string | null; recording_start_time: number | null }

/** 伺服器 → 客戶端的訊息 */
export type ServerMessage =
  | { type: 'init'; meeting: MeetingSession; transcripts: Record<string, TranscriptEntry> }
  | { type: 'entry_saved'; entry: TranscriptEntry }
  | { type: 'entry_deleted'; timestamp: number }
  | { type: 'meeting_updated'; recorder_uid: string | null }
  | { type: 'recording_synced'; recording_speaker: string | null; recording_start_time: number | null }
  | { type: 'error'; message: string }

/** 每個 WebSocket 連線附帶的認證中繼資料 */
interface ConnectionMeta {
  isAuthenticated: boolean
  userId: string | null
}

// ─── DO 環境型別 ───────────────────────────────────────────────────────────────

/** MeetingRoom 只需要 DB 綁定 */
interface MeetingRoomEnv {
  DB: D1Database
}

// ─── Durable Object 實作 ───────────────────────────────────────────────────────

export class MeetingRoom extends DurableObject<MeetingRoomEnv> {
  // ─── HTTP 進入點 ────────────────────────────────────────────────────────────

  /**
   * 所有進來的請求都走這裡：
   * - GET /api/meeting/ws/:date  → WebSocket upgrade（任何人）
   * - GET /api/meeting/:date     → REST 讀取（任何人，供 Worker 代理）
   */
  async fetch(request: Request): Promise<Response> {
    const date = new URL(request.url).pathname.split('/').at(-1) ?? ''

    // WebSocket Upgrade
    const upgradeHeader = request.headers.get('Upgrade')
    if (upgradeHeader?.toLowerCase() === 'websocket') {
      return this.handleWebSocketUpgrade(request, date)
    }

    // REST: 回傳完整快照（供 Worker 代理給 JitsiView 歷史模式使用）
    const data = await this.loadFromD1(date)
    return Response.json(data)
  }

  // ─── WebSocket Hibernation 鉤子 ─────────────────────────────────────────────

  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
    const meta = ws.deserializeAttachment() as ConnectionMeta & { date: string }

    // 讀取操作不走 WebSocket 訊息（只有 init 由 fetch 時推送）；
    // 所有訊息都是寫入，必須有認證。
    if (!meta.isAuthenticated) {
      ws.send(JSON.stringify({ type: 'error', message: '需要登入才能寫入' } satisfies ServerMessage))
      return
    }

    const raw = typeof message === 'string' ? message : new TextDecoder().decode(message)
    let msg: ClientMessage
    try {
      msg = JSON.parse(raw) as ClientMessage
    } catch {
      ws.send(JSON.stringify({ type: 'error', message: '無效的 JSON 格式' } satisfies ServerMessage))
      return
    }

    await this.handleClientMessage(msg, meta.date)
  }

  async webSocketClose(ws: WebSocket, code: number, reason: string): Promise<void> {
    try {
      ws.close(code, reason)
    } catch {
      // 已關閉時忽略
    }
  }

  async webSocketError(_ws: WebSocket, error: unknown): Promise<void> {
    console.error('[MeetingRoom] WebSocket error:', error)
  }

  // ─── 私有：WebSocket 升級 ────────────────────────────────────────────────────

  private async handleWebSocketUpgrade(request: Request, date: string): Promise<Response> {
    const isAuthenticated = request.headers.get('X-Authenticated') === 'true'
    const userId = request.headers.get('X-User-Id') || null

    const pair = new WebSocketPair()
    const client = pair[0]
    const server = pair[1]

    this.ctx.acceptWebSocket(server)

    // 綁定連線中繼資料（認證狀態 + 日期）
    const meta: ConnectionMeta & { date: string } = { isAuthenticated, userId, date }
    server.serializeAttachment(meta)

    // 把當下的完整快照推給新連線的客戶端
    try {
      const data = await this.loadFromD1(date)
      server.send(JSON.stringify({ type: 'init', ...data } satisfies ServerMessage))
    } catch (err) {
      console.error('[MeetingRoom] Failed to load initial state:', err)
      server.send(JSON.stringify({ type: 'error', message: '載入會議資料失敗' } satisfies ServerMessage))
    }

    return new Response(null, { status: 101, webSocket: client })
  }

  // ─── 私有：業務邏輯 ──────────────────────────────────────────────────────────

  private async handleClientMessage(msg: ClientMessage, date: string): Promise<void> {
    switch (msg.type) {
      case 'save_entry': {
        const { entry } = msg
        if (!entry || typeof entry.timestamp !== 'number' || !entry.text) return
        await this.env.DB.prepare('INSERT OR REPLACE INTO meeting_transcript_entries (meeting_date, ts, entry_id, speaker, text) VALUES (?, ?, ?, ?, ?)')
          .bind(date, entry.timestamp, entry.id ?? null, entry.speaker ?? null, entry.text)
          .run()
        this.broadcast({ type: 'entry_saved', entry })
        break
      }

      case 'delete_entry': {
        const { timestamp } = msg
        if (typeof timestamp !== 'number') return
        await this.env.DB.prepare('DELETE FROM meeting_transcript_entries WHERE meeting_date = ? AND ts = ?').bind(date, timestamp).run()
        this.broadcast({ type: 'entry_deleted', timestamp })
        break
      }

      case 'update_meeting': {
        await this.upsertSession(date, { recorder_uid: msg.recorder_uid })
        this.broadcast({ type: 'meeting_updated', recorder_uid: msg.recorder_uid })
        break
      }

      case 'sync_recording': {
        await this.upsertSession(date, {
          recording_speaker: msg.recording_speaker,
          recording_start_time: msg.recording_start_time,
        })
        this.broadcast({
          type: 'recording_synced',
          recording_speaker: msg.recording_speaker,
          recording_start_time: msg.recording_start_time,
        })
        break
      }
    }
  }

  // ─── 私有：廣播 ─────────────────────────────────────────────────────────────

  private broadcast(message: ServerMessage): void {
    const payload = JSON.stringify(message)
    for (const ws of this.ctx.getWebSockets()) {
      try {
        ws.send(payload)
      } catch {
        // 忽略已關閉的連線
      }
    }
  }

  // ─── 私有：D1 讀寫 ───────────────────────────────────────────────────────────

  /** 從 D1 讀取指定日期的完整會議快照 */
  async loadFromD1(date: string): Promise<{ meeting: MeetingSession; transcripts: Record<string, TranscriptEntry> }> {
    const [sessionRow, entriesResult] = await Promise.all([
      this.env.DB.prepare('SELECT * FROM meeting_sessions WHERE date = ?').bind(date).first<MeetingSessionRow>(),
      this.env.DB.prepare('SELECT * FROM meeting_transcript_entries WHERE meeting_date = ? ORDER BY ts ASC').bind(date).all<TranscriptEntryRow>(),
    ])

    const meeting: MeetingSession = {
      recorderUid: sessionRow?.recorder_uid ?? null,
      recordingSpeaker: sessionRow?.recording_speaker ?? null,
      recordingStartTime: sessionRow?.recording_start_time ?? null,
    }

    const transcripts: Record<string, TranscriptEntry> = {}
    for (const row of entriesResult.results) {
      transcripts[String(row.ts)] = {
        id: row.entry_id,
        timestamp: row.ts,
        speaker: row.speaker ?? '',
        text: row.text,
      }
    }

    return { meeting, transcripts }
  }

  /** UPSERT meeting_sessions 的部分欄位 */
  private async upsertSession(
    date: string,
    updates: Partial<{
      recorder_uid: string | null
      recording_speaker: string | null
      recording_start_time: number | null
    }>
  ): Promise<void> {
    await this.env.DB.prepare('INSERT OR IGNORE INTO meeting_sessions (date) VALUES (?)').bind(date).run()

    const setClauses: string[] = []
    const values: unknown[] = []

    if ('recorder_uid' in updates) {
      setClauses.push('recorder_uid = ?')
      values.push(updates.recorder_uid ?? null)
    }
    if ('recording_speaker' in updates) {
      setClauses.push('recording_speaker = ?')
      values.push(updates.recording_speaker ?? null)
    }
    if ('recording_start_time' in updates) {
      setClauses.push('recording_start_time = ?')
      values.push(updates.recording_start_time ?? null)
    }

    if (setClauses.length === 0) return

    await this.env.DB.prepare(`UPDATE meeting_sessions SET ${setClauses.join(', ')} WHERE date = ?`)
      .bind(...values, date)
      .run()
  }
}
