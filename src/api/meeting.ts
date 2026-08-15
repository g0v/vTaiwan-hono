import { Hono } from 'hono'

/**
 * 即時會議 API（#81）
 *
 * WebSocket 端點（今日即時）：
 *   GET /api/meeting/ws/:date   → 轉交給 MeetingRoom DO，不需認證即可訂閱；
 *                                  Worker 在 Upgrade 時把認證狀態寫入請求標頭。
 *
 * REST 端點（歷史校對）：
 *   GET    /api/meeting/:date               → 讀取指定日期的完整快照（任何人）
 *   POST   /api/meeting/:date/transcript    → 新增／覆寫逐字稿條目（需 meeting.join）
 *   DELETE /api/meeting/:date/transcript/:ts → 刪除條目（需 meeting.join）
 *   PATCH  /api/meeting/:date               → 更新會議 session 欄位（需 meeting.join）
 */

import { tryGetAuthContext, hasPermission } from '../server/lib/authorization'
import type { AppEnv } from './types'

/** YYYYMMDD 格式驗證（八位數字） */
function isValidDate(date: string): boolean {
  return /^\d{8}$/.test(date)
}

export const app = new Hono<AppEnv>()

// ─── WebSocket Upgrade ─────────────────────────────────────────────────────

/**
 * 把 WebSocket 升級請求轉給 MeetingRoom DO。
 * - 任何人皆可連線（read-only 觀察）
 * - 認證狀態由此處解析後寫入 X-Authenticated / X-User-Id 標頭，
 *   DO 在 webSocketMessage 中利用 serializeAttachment 把關寫入
 */
app.get('/ws/:date', async c => {
  const date = c.req.param('date')
  if (!isValidDate(date)) return c.text('Invalid date', 400)

  const upgradeHeader = c.req.header('Upgrade')
  if (!upgradeHeader || upgradeHeader.toLowerCase() !== 'websocket') {
    return c.text('Expected WebSocket upgrade', 426)
  }

  // 解析認證（非強制；失敗視為未登入）
  // isAuthenticated = 有效 session 且擁有 meeting.join（停權帳號 permissions=[]，視為未授權）
  const authCtx = await tryGetAuthContext(c.env, c.req.raw.headers)
  const isAuthenticated = authCtx !== null && hasPermission(authCtx, 'meeting.join')
  const userId = authCtx?.user.id ?? ''

  // 建立指向該日期 DO 實例的 stub
  if (!c.env.MEETING_ROOM) return c.text('DO binding not available', 500)
  const doId = c.env.MEETING_ROOM.idFromName(`meeting-${date}`)
  const stub = c.env.MEETING_ROOM.get(doId)

  // 轉發請求，帶上認證標頭（WebSocket 升級為 GET，無 body）
  const forwardHeaders = new Headers(c.req.raw.headers)
  forwardHeaders.set('X-Authenticated', isAuthenticated ? 'true' : 'false')
  forwardHeaders.set('X-User-Id', userId)

  return stub.fetch(new Request(c.req.raw.url, { headers: forwardHeaders }))
})

// ─── REST: 讀取快照 ────────────────────────────────────────────────────────

/**
 * 從 D1 讀取指定日期的全量快照。
 * 用於歷史日期的初始載入（不建 WebSocket）。
 */
app.get('/:date', async c => {
  const date = c.req.param('date')
  if (!isValidDate(date)) return c.text('Invalid date', 400)

  const sessionRow = await c.env.DB.prepare('SELECT * FROM meeting_sessions WHERE date = ?').bind(date).first<{
    recorder_uid: string | null
    recording_speaker: string | null
    recording_start_time: number | null
  }>()

  const entriesResult = await c.env.DB.prepare('SELECT * FROM meeting_transcript_entries WHERE meeting_date = ? ORDER BY ts ASC')
    .bind(date)
    .all<{ ts: number; entry_id: string | null; speaker: string | null; text: string }>()

  const transcripts: Record<string, { id: string | null; timestamp: number; speaker: string; text: string }> = {}
  for (const row of entriesResult.results) {
    transcripts[String(row.ts)] = {
      id: row.entry_id,
      timestamp: row.ts,
      speaker: row.speaker ?? '',
      text: row.text,
    }
  }

  return c.json({
    meeting: {
      recorderUid: sessionRow?.recorder_uid ?? null,
      recordingSpeaker: sessionRow?.recording_speaker ?? null,
      recordingStartTime: sessionRow?.recording_start_time ?? null,
    },
    transcripts,
  })
})

// ─── REST: 新增／覆寫逐字稿條目 ────────────────────────────────────────────

app.post('/:date/transcript', async c => {
  const date = c.req.param('date')
  if (!isValidDate(date)) return c.text('Invalid date', 400)

  const authCtx = await tryGetAuthContext(c.env, c.req.raw.headers)
  if (!authCtx) return c.text('Unauthorized', 401)
  if (!hasPermission(authCtx, 'meeting.join')) return c.text('Forbidden', 403)

  const body = await c.req.json<{ id?: string | null; timestamp: number; speaker?: string; text: string }>()
  if (typeof body.timestamp !== 'number' || !body.text) return c.text('Invalid body', 400)

  await c.env.DB.prepare('INSERT OR REPLACE INTO meeting_transcript_entries (meeting_date, ts, entry_id, speaker, text) VALUES (?, ?, ?, ?, ?)')
    .bind(date, body.timestamp, body.id ?? null, body.speaker ?? null, body.text)
    .run()

  return c.json({ ok: true })
})

// ─── REST: 刪除逐字稿條目 ─────────────────────────────────────────────────

app.delete('/:date/transcript/:ts', async c => {
  const date = c.req.param('date')
  const ts = Number(c.req.param('ts'))
  if (!isValidDate(date) || !Number.isFinite(ts)) return c.text('Invalid params', 400)

  const authCtx = await tryGetAuthContext(c.env, c.req.raw.headers)
  if (!authCtx) return c.text('Unauthorized', 401)
  if (!hasPermission(authCtx, 'meeting.join')) return c.text('Forbidden', 403)

  await c.env.DB.prepare('DELETE FROM meeting_transcript_entries WHERE meeting_date = ? AND ts = ?').bind(date, ts).run()

  return c.json({ ok: true })
})

// ─── REST: 更新會議 session ────────────────────────────────────────────────

app.patch('/:date', async c => {
  const date = c.req.param('date')
  if (!isValidDate(date)) return c.text('Invalid date', 400)

  const authCtx = await tryGetAuthContext(c.env, c.req.raw.headers)
  if (!authCtx) return c.text('Unauthorized', 401)
  if (!hasPermission(authCtx, 'meeting.join')) return c.text('Forbidden', 403)

  const body = await c.req.json<{
    recorder_uid?: string | null
    recording_speaker?: string | null
    recording_start_time?: number | null
  }>()

  // UPSERT
  await c.env.DB.prepare('INSERT OR IGNORE INTO meeting_sessions (date) VALUES (?)').bind(date).run()

  const setClauses: string[] = []
  const values: unknown[] = []

  if ('recorder_uid' in body) {
    setClauses.push('recorder_uid = ?')
    values.push(body.recorder_uid ?? null)
  }
  if ('recording_speaker' in body) {
    setClauses.push('recording_speaker = ?')
    values.push(body.recording_speaker ?? null)
  }
  if ('recording_start_time' in body) {
    setClauses.push('recording_start_time = ?')
    values.push(body.recording_start_time ?? null)
  }

  if (setClauses.length > 0) {
    await c.env.DB.prepare(`UPDATE meeting_sessions SET ${setClauses.join(', ')} WHERE date = ?`)
      .bind(...values, date)
      .run()
  }

  return c.json({ ok: true })
})
export default app
