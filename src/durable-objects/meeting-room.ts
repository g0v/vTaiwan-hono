import { DurableObject } from 'cloudflare:workers'
import { capturersFromMetas, decodeUserName } from '../lib/capture-list'
import type { Capturer } from '../lib/capture-list'

/**
 * MeetingRoom Durable Object — 即時會議資料的單一來源（#81）
 *
 * 一個 DO 實例對應一個會議日期（`meeting-YYYYMMDD`）。
 * 職責：
 *   - 管理 WebSocket 連線（任何人可連、僅認證用戶可寫）
 *   - 把寫入廣播給所有連線客戶端
 *   - 把所有變更持久化到 D1（meeting_sessions / meeting_transcript_entries）
 *   - 聚合「轉錄中名單」並廣播（#153 步驟 2）：名單不落 D1，只活在各連線的 attachment
 *
 * 架構決策：
 *   - 使用 WebSocket Hibernation API（ctx.acceptWebSocket），讓 DO 在無活躍連線時可被休眠
 *   - 每次訊息都從 D1 讀取狀態（無全域 in-memory 快取），以避免 DO 休眠後狀態遺失
 *   - 例外：初次 `fetch()` 時把完整快照送給新連線的客戶端，之後只廣播差量
 *   - 認證由 Worker 在 WebSocket Upgrade 時完成，結果以 serializeAttachment 綁定至各連線
 *   - 名單的唯一真相是 attachment：改 `capturing` 後必須重新 serializeAttachment，
 *     因為 deserializeAttachment 回的是副本；不另養 in-memory 名單（休眠會清掉）
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
  /** 本連線的錄音狀態（#153 步驟 2）。身分一律取自 attachment，不採信訊息內容 */
  | { type: 'capture_status'; capturing: boolean }

/** 伺服器 → 客戶端的訊息 */
export type ServerMessage =
  | { type: 'init'; meeting: MeetingSession; transcripts: Record<string, TranscriptEntry>; capturers: Capturer[] }
  | { type: 'entry_saved'; entry: TranscriptEntry }
  | { type: 'entry_deleted'; timestamp: number }
  | { type: 'meeting_updated'; recorder_uid: string | null }
  | { type: 'recording_synced'; recording_speaker: string | null; recording_start_time: number | null }
  /** 轉錄中名單（#153 步驟 2）：任何連線的 capturing 改變或斷線時全體廣播 */
  | { type: 'capture_list'; capturers: Capturer[] }
  | { type: 'error'; message: string }

/**
 * 每個 WebSocket 連線附帶的中繼資料（attachment／「名牌」）。
 * `name`／`capturing` 由 #153 步驟 2 新增；舊連線的 attachment 可能沒有這兩欄，讀取時一律補預設值。
 */
interface ConnectionMeta {
  isAuthenticated: boolean
  userId: string | null
  name: string | null
  capturing: boolean
}

/** 實際存進 attachment 的形狀：ConnectionMeta 加上連線所屬日期 */
type StoredMeta = ConnectionMeta & { date: string }

/** WebSocket.readyState 的 OPEN；close() 後 getWebSockets() 仍可能回傳 CLOSING 連線，聚合名單時要排除 */
const WS_OPEN = 1

/** 從 attachment 讀名牌，缺欄位（舊連線）補預設值 */
function readMeta(ws: WebSocket): StoredMeta {
  const raw = ws.deserializeAttachment() as Partial<StoredMeta> | null
  return {
    isAuthenticated: raw?.isAuthenticated === true,
    userId: raw?.userId ?? null,
    name: raw?.name ?? null,
    capturing: raw?.capturing === true,
    date: raw?.date ?? '',
  }
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
    const meta = readMeta(ws)

    // 讀取操作不走 WebSocket 訊息（只有 init 由 fetch 時推送）；
    // 所有訊息都是寫入，必須有認證。capture_status 也在這道門之後——未登入連線改不了名牌。
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

    await this.handleClientMessage(msg, meta.date, ws)
  }

  async webSocketClose(ws: WebSocket, code: number, reason: string): Promise<void> {
    // 先把名牌改成「沒在錄」並存回：close() 後 getWebSockets() 仍可能回傳這條 CLOSING 連線，
    // 之後任何人觸發的重算都不能再把它納入。
    const changed = this.setCapturing(ws, false)
    try {
      ws.close(code, reason)
    } catch {
      // 已關閉時忽略
    }
    if (changed) this.broadcastCaptureList()
  }

  async webSocketError(ws: WebSocket, error: unknown): Promise<void> {
    console.error('[MeetingRoom] WebSocket error:', error)
    // 錯誤也是一種斷線：比照 webSocketClose 把這條連線移出名單
    if (this.setCapturing(ws, false)) this.broadcastCaptureList()
  }

  // ─── 私有：WebSocket 升級 ────────────────────────────────────────────────────

  private async handleWebSocketUpgrade(request: Request, date: string): Promise<Response> {
    // 三個身分標頭都由 Worker 的 buildForwardHeaders 依 session 覆寫過，這裡可以直接信
    const isAuthenticated = request.headers.get('X-Authenticated') === 'true'
    const userId = request.headers.get('X-User-Id') || null
    const name = decodeUserName(request.headers.get('X-User-Name'))

    const pair = new WebSocketPair()
    const client = pair[0]
    const server = pair[1]

    this.ctx.acceptWebSocket(server)

    // 綁定連線中繼資料（認證狀態 + 身分 + 日期）；新連線一律從「沒在錄」開始
    const meta: StoredMeta = { isAuthenticated, userId, name, capturing: false, date }
    server.serializeAttachment(meta)

    // 把當下的完整快照推給新連線的客戶端（含現有名單，中途加入者不必等別人再送一次）
    try {
      server.send(JSON.stringify(await this.initMessage(date)))
    } catch (err) {
      console.error('[MeetingRoom] Failed to load initial state:', err)
      server.send(JSON.stringify({ type: 'error', message: '載入會議資料失敗' } satisfies ServerMessage))
    }

    return new Response(null, { status: 101, webSocket: client })
  }

  /**
   * 新連線的第一則訊息：D1 快照 + 目前名單。
   * 名單與 capture_list 走同一個 currentCapturers()，中途加入者看到的和現場廣播的一致。
   * 抽成公開方法是為了讓測試能直接驗證（Node 建不出 101 的 Response，升級路徑無法在測試中跑）。
   */
  async initMessage(date: string): Promise<ServerMessage> {
    const data = await this.loadFromD1(date)
    return { type: 'init', ...data, capturers: this.currentCapturers() }
  }

  // ─── 私有：業務邏輯 ──────────────────────────────────────────────────────────

  private async handleClientMessage(msg: ClientMessage, date: string, ws: WebSocket): Promise<void> {
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
        // 相容橋（#153 步驟 2）：舊版頁面只會送這則訊息。只更新「送出者自己」的名牌，
        // 不拿全房間的 recording_speaker 反推名單；新版名單只以 init／capture_list 為準。
        if (this.setCapturing(ws, msg.recording_speaker !== null)) this.broadcastCaptureList()
        break
      }

      case 'capture_status': {
        if (typeof msg.capturing !== 'boolean') return
        if (this.setCapturing(ws, msg.capturing)) this.broadcastCaptureList()
        break
      }
    }
  }

  // ─── 私有：轉錄中名單（#153 步驟 2）────────────────────────────────────────

  /**
   * 改這條連線名牌上的 capturing 並存回 attachment。
   * 回傳是否真的改了——沒變就不用廣播（每 30 秒換段重送的舊訊息不會造成名單抖動）。
   */
  private setCapturing(ws: WebSocket, capturing: boolean): boolean {
    let meta: StoredMeta
    try {
      meta = readMeta(ws)
    } catch {
      return false // attachment 讀不到（連線已被回收）就當沒事
    }
    if (meta.capturing === capturing) return false
    ws.serializeAttachment({ ...meta, capturing } satisfies StoredMeta)
    return true
  }

  /** 從所有「仍開啟」連線的名牌算出目前名單 */
  private currentCapturers(): Capturer[] {
    const metas = []
    for (const ws of this.ctx.getWebSockets()) {
      if (ws.readyState !== WS_OPEN) continue
      try {
        metas.push(readMeta(ws))
      } catch {
        // 讀不到名牌的連線不列入
      }
    }
    return capturersFromMetas(metas)
  }

  private broadcastCaptureList(): void {
    this.broadcast({ type: 'capture_list', capturers: this.currentCapturers() })
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
