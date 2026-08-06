import { corsFor } from './cors'
import { readAudioToText } from '../lib/transcribe'
import { generateOutline } from '../lib/ai-summarize'
import { splitTranscriptionIntoChunks, TRANSCRIPTION_MAX_BYTES, utf8ByteLength } from '../lib/transcription-storage'
import {
  formatVersionId,
  isValidMeetingId,
  isValidVersionId,
  outlineVersionObjectKey,
  parseVersionId,
  versionIdFromKey,
  versionObjectKey,
  versionsPrefix,
  type TranscriptionVersion,
} from '../lib/transcription-versions'
import { stripHtmlFromMarkdown } from '../lib/html-sanitizer'
import { getAuthContext, hasPermission, tryGetAuthContext } from '../server/lib/authorization'
import { recordAudit } from '../server/lib/audit-log'
import { formatMeetingId } from '../lib/transcription-format'
import { sessionNotFreshBody } from '../server/lib/step-up'
import type { App } from './types'
import type { R2Bucket } from '@cloudflare/workers-types'

// 單場會議的版本上限（R2 list 單次最多 1000）；超過即回報 truncated，不靜默截斷。
const VERSION_LIST_LIMIT = 1000

const LANG_MAP: Record<string, string> = {
  'zh-TW': 'zh',
  en: 'en',
  ja: 'ja',
}

/**
 * 逐字稿版本的核心不變量：**最新的版本永遠等於現行內容**。
 * 因此「變更前的版本」＝寫入新版本之前、R2 裡最新的那一個，變更日誌的
 * 「回復到變更前版本」據此運作。任何改動現行逐字稿的路徑（上傳、回復）
 * 都必須跟著寫一個新版本，否則這個不變量會破、回復會回到錯的內容。
 */
async function newestVersionId(r2: R2Bucket, meetingId: string): Promise<string | null> {
  let newest: string | null = null
  let cursor: string | undefined
  do {
    const listed = await r2.list({ prefix: versionsPrefix(meetingId), limit: VERSION_LIST_LIMIT, cursor })
    for (const object of listed.objects) {
      const versionId = versionIdFromKey(object.key, meetingId)
      if (versionId && (newest === null || versionId > newest)) newest = versionId
    }
    cursor = listed.truncated ? listed.cursor : undefined
  } while (cursor)
  return newest
}

/**
 * #73 上線前上傳的逐字稿在 R2 只有現行物件、沒有任何版本。
 * 覆蓋或刪除它之前先把現行內容保存成一個版本（時間取自物件的 uploaded），
 * 否則那份內容會永久消失、日誌上的「回復到變更前版本」也無從回起。
 */
async function preserveLegacyVersion(r2: R2Bucket, meetingId: string): Promise<string | null> {
  const current = await r2.get(`${meetingId}.txt`)
  if (!current) return null
  const versionId = formatVersionId(current.uploaded.getTime())
  await r2.put(versionObjectKey(meetingId, versionId), current.body, {
    httpMetadata: { contentType: 'text/plain; charset=utf-8' },
    customMetadata: { sourceFilename: `transcript-${meetingId}.txt`, legacy: 'true' },
  })
  return versionId
}

/** 取得「變更前」的逐字稿版本；沒有版本就先補存 legacy 版本 */
async function resolvePreviousVersionId(r2: R2Bucket, meetingId: string): Promise<string | null> {
  return (await newestVersionId(r2, meetingId)) ?? (await preserveLegacyVersion(r2, meetingId))
}

/** 把當下的大綱存成快照並回傳其版本識別碼；空大綱也照存，回復後才會真的變回空的 */
async function snapshotOutline(r2: R2Bucket, meetingId: string, outline: string): Promise<string> {
  const versionId = formatVersionId(Date.now())
  await r2.put(outlineVersionObjectKey(meetingId, versionId), outline, {
    httpMetadata: { contentType: 'text/markdown; charset=utf-8' },
  })
  return versionId
}

export function registerTranscriptionApi(app: App) {
  // POST /api/transcription/:lang — 音頻檔轉文字（分軌本地錄音端點）
  app.use('/api/transcription/*', corsFor(['POST']))
  app.post('/api/transcription/:lang', async c => {
    const context = await getAuthContext(c.env, c.req.raw.headers)
    if (!context) return c.json({ error: 'Unauthorized' }, 401)
    if (!hasPermission(context, 'meeting.join')) return c.json({ error: 'Forbidden' }, 403)

    const rawLang = c.req.param('lang') || 'zh-TW'
    const language = LANG_MAP[rawLang] ?? rawLang

    let formData: FormData
    try {
      formData = await c.req.formData()
    } catch {
      return c.text('No file uploaded', 400)
    }

    const file = formData.get('file')
    if (!(file instanceof File)) return c.text('No file uploaded', 400)

    try {
      const audioBuffer = await file.arrayBuffer()
      const text = await readAudioToText(audioBuffer, c.env, language)
      return c.text(text)
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error)
      if (message.includes('音檔音量過低')) {
        return c.json({ error: '音檔音量過低', message, code: 'LOW_VOLUME' }, 422)
      }
      return c.json({ error: '轉錄失敗', message, code: 'TRANSCRIPTION_ERROR' }, 400)
    }
  })

  // POST /api/upload-transcription — 上傳逐字稿 .txt 至 D1 + R2，並生成 AI 大綱
  app.use('/api/upload-transcription', corsFor(['POST']))
  app.post('/api/upload-transcription', async c => {
    const context = await getAuthContext(c.env, c.req.raw.headers)
    if (!context) return c.json({ error: 'Unauthorized' }, 401)
    if (!hasPermission(context, 'transcription.update')) return c.json({ error: 'Forbidden' }, 403)

    let formData: FormData
    try {
      formData = await c.req.formData()
    } catch {
      return c.text('No file uploaded', 400)
    }

    const file = formData.get('file')
    if (!(file instanceof File)) return c.text('No file uploaded', 400)

    const meetingIdMatch = /^transcript-(\d{4})-(\d{2})-(\d{2})\.(?:txt|srt|md)$/.exec(file.name)
    if (!meetingIdMatch) {
      return c.json({ error: '檔名格式不正確', code: 'INVALID_TRANSCRIPTION_FILENAME' }, 400)
    }
    const meeting_id = meetingIdMatch.slice(1).join('')
    const transcription = await file.text()
    const transcriptionBytes = utf8ByteLength(transcription)
    if (transcriptionBytes > TRANSCRIPTION_MAX_BYTES) {
      return c.json(
        {
          error: '逐字稿檔案過大',
          code: 'TRANSCRIPTION_TOO_LARGE',
          max_bytes: TRANSCRIPTION_MAX_BYTES,
        },
        413
      )
    }
    const chunks = splitTranscriptionIntoChunks(transcription)
    const isChunked = chunks.length > 1

    const db = c.env.DB
    if (!db) return c.json({ error: 'DB binding not configured' }, 500)

    const existing = await db.prepare('SELECT meeting_id FROM transcriptions WHERE meeting_id = ?').bind(meeting_id).first()
    // 覆蓋已上傳逐字稿屬敏感操作，需二次驗證（新建不要求）；在寫 R2／呼叫 AI 前擋下。
    if (existing && !context.fresh) return c.json(sessionNotFreshBody(), 403)

    // 版本保留（#73）：每次上傳都額外寫一份不會被覆蓋的版本，供管理員下載回復。
    // 刻意排在產生大綱之前——AI 失敗時寧可留下孤兒版本，也不要漏存使用者剛覆蓋掉的內容。
    let version_id: string | null = null
    let previous_version_id: string | null = null
    if (c.env.R2) {
      // 先問「變更前是哪一版」（必要時補存 #73 之前的舊內容），再寫新版本——順序反了就會拿到自己
      previous_version_id = existing ? await resolvePreviousVersionId(c.env.R2, meeting_id) : null
      version_id = formatVersionId(Date.now())
      await c.env.R2.put(versionObjectKey(meeting_id, version_id), transcription, {
        httpMetadata: { contentType: 'text/plain; charset=utf-8' },
        customMetadata: { uploadedBy: context.user.email, sourceFilename: file.name },
      })
      await c.env.R2.put(`${meeting_id}.txt`, transcription, {
        httpMetadata: { contentType: 'text/plain; charset=utf-8' },
      })
    }

    const outline = stripHtmlFromMarkdown(await generateOutline(transcription, c.env))
    const storedTranscription = isChunked ? '' : transcription
    const saveMain = existing
      ? db.prepare('UPDATE transcriptions SET transcription = ?, outline = ? WHERE meeting_id = ?').bind(storedTranscription, outline, meeting_id)
      : db.prepare('INSERT INTO transcriptions (meeting_id, transcription, outline) VALUES (?, ?, ?)').bind(meeting_id, storedTranscription, outline)
    const statements = [saveMain, db.prepare('DELETE FROM transcription_chunks WHERE meeting_id = ?').bind(meeting_id)]

    if (isChunked) {
      statements.push(...chunks.map((chunk, chunkIndex) => db.prepare('INSERT INTO transcription_chunks (meeting_id, chunk_index, content) VALUES (?, ?, ?)').bind(meeting_id, chunkIndex, chunk)))
    }

    await db.batch(statements)

    // 變更日誌（#71）：逐字稿的新增與覆蓋同樣是後台變更事件，與角色變更寫進同一份日誌
    await recordAudit(
      c.env,
      context.user,
      existing ? 'transcription.replace' : 'transcription.create',
      { type: 'transcription', id: meeting_id, label: formatMeetingId(meeting_id) },
      { versionId: version_id ?? undefined, previousVersionId: previous_version_id ?? undefined, bytes: transcriptionBytes }
    )

    return c.json({
      message: existing ? 'Transcription updated successfully' : 'Transcription created successfully',
      meeting_id,
      r2_key: `${meeting_id}.txt`,
      version_id,
      storage: isChunked ? 'chunked' : 'inline',
      chunk_count: isChunked ? chunks.length : 0,
    })
  })

  // POST /api/update-outline — 手動更新大綱
  app.use('/api/update-outline', corsFor(['POST']))
  app.post('/api/update-outline', async c => {
    const context = await getAuthContext(c.env, c.req.raw.headers)
    if (!context) return c.json({ error: 'Unauthorized' }, 401)
    if (!hasPermission(context, 'transcription.update')) return c.json({ error: 'Forbidden' }, 403)
    if (!context.fresh) return c.json(sessionNotFreshBody(), 403)

    const { meeting_id, outline } = await c.req.json<{ meeting_id: unknown; outline: unknown }>()
    if (typeof meeting_id !== 'string' || !/^\d{8}$/.test(meeting_id) || typeof outline !== 'string') {
      return c.json({ error: '大綱資料格式不正確', code: 'INVALID_OUTLINE' }, 400)
    }
    const db = c.env.DB
    if (!db) return c.json({ error: 'DB binding not configured' }, 500)

    // 覆蓋前先把現行大綱存成快照，否則日誌上的「回復到變更前版本」沒有東西可回。
    // 逐字稿是靠版本鏈拿到舊內容，大綱沒有那條鏈，所以在這裡即時快照。
    let previous_version_id: string | null = null
    if (c.env.R2) {
      const current = await db.prepare('SELECT outline FROM transcriptions WHERE meeting_id = ?').bind(meeting_id).first<{ outline: string | null }>()
      if (current) previous_version_id = await snapshotOutline(c.env.R2, meeting_id, current.outline ?? '')
    }

    await db.prepare('UPDATE transcriptions SET outline = ? WHERE meeting_id = ?').bind(stripHtmlFromMarkdown(outline), meeting_id).run()

    // 變更日誌（#71）：大綱是逐字稿頁面對外呈現的內容，改動一律留痕
    await recordAudit(
      c.env,
      context.user,
      'transcription.outline.update',
      { type: 'transcription', id: meeting_id, label: formatMeetingId(meeting_id) },
      { previousVersionId: previous_version_id ?? undefined }
    )

    return c.json({ message: 'Outline updated successfully' })
  })

  // POST /api/restore-transcription — 由變更日誌回復到變更前的版本（#71 × #73）
  app.use('/api/restore-transcription', corsFor(['POST']))
  app.post('/api/restore-transcription', async c => {
    // 用 tryGetAuthContext：session 讀不到（含綁定異常）一律當未登入擋下，寧可 401 也不要放行
    const context = await tryGetAuthContext(c.env, c.req.raw.headers)
    if (!context) return c.json({ error: 'Unauthorized' }, 401)
    if (!hasPermission(context, 'transcription.update')) return c.json({ error: 'Forbidden' }, 403)
    // 覆蓋現行內容屬敏感操作，與上傳覆蓋同一條標準
    if (!context.fresh) return c.json(sessionNotFreshBody(), 403)

    const body = await c.req.json<{ meeting_id: unknown; target: unknown; version_id: unknown; outline_version_id: unknown }>().catch(() => null)
    const meeting_id = body?.meeting_id
    const target = body?.target
    const version_id = body?.version_id
    const outline_version_id = typeof body?.outline_version_id === 'string' ? body.outline_version_id : null
    if (
      typeof meeting_id !== 'string' ||
      !isValidMeetingId(meeting_id) ||
      typeof version_id !== 'string' ||
      !isValidVersionId(version_id) ||
      (target !== 'transcription' && target !== 'outline') ||
      (outline_version_id !== null && !isValidVersionId(outline_version_id))
    ) {
      return c.json({ error: '回復參數格式不正確', code: 'INVALID_RESTORE_REQUEST' }, 400)
    }

    const db = c.env.DB
    if (!db) return c.json({ error: 'DB binding not configured' }, 500)
    if (!c.env.R2) return c.json({ error: 'R2 binding not configured' }, 500)

    const existing = await db.prepare('SELECT meeting_id FROM transcriptions WHERE meeting_id = ?').bind(meeting_id).first()
    const auditTarget = { type: 'transcription' as const, id: meeting_id, label: formatMeetingId(meeting_id) }

    if (target === 'outline') {
      if (!existing) return c.json({ error: '找不到逐字稿', code: 'TRANSCRIPTION_NOT_FOUND' }, 404)
      const snapshot = await c.env.R2.get(outlineVersionObjectKey(meeting_id, version_id))
      if (!snapshot) return c.json({ error: '找不到指定的大綱版本', code: 'VERSION_NOT_FOUND' }, 404)

      // 先快照現行大綱，這次回復本身才回得去
      const current = await db.prepare('SELECT outline FROM transcriptions WHERE meeting_id = ?').bind(meeting_id).first<{ outline: string | null }>()
      const previous_version_id = await snapshotOutline(c.env.R2, meeting_id, current?.outline ?? '')

      const restored = stripHtmlFromMarkdown(await snapshot.text())
      await db.prepare('UPDATE transcriptions SET outline = ? WHERE meeting_id = ?').bind(restored, meeting_id).run()
      await recordAudit(c.env, context.user, 'transcription.outline.restore', auditTarget, { versionId: version_id, previousVersionId: previous_version_id })
      return c.json({ message: 'Outline restored successfully', meeting_id, version_id })
    }

    const snapshot = await c.env.R2.get(versionObjectKey(meeting_id, version_id))
    if (!snapshot) return c.json({ error: '找不到指定的逐字稿版本', code: 'VERSION_NOT_FOUND' }, 404)
    const transcription = await snapshot.text()

    // 變更前的版本＝目前最新的版本（不變量見 newestVersionId 的說明）
    const previous_version_id = await resolvePreviousVersionId(c.env.R2, meeting_id)

    // 回復也要寫一個新版本，維持「最新版本＝現行內容」的不變量
    const restoredVersionId = formatVersionId(Date.now())
    await c.env.R2.put(versionObjectKey(meeting_id, restoredVersionId), transcription, {
      httpMetadata: { contentType: 'text/plain; charset=utf-8' },
      customMetadata: { uploadedBy: context.user.email, sourceFilename: `transcript-${meeting_id}.txt`, restoredFrom: version_id },
    })
    await c.env.R2.put(`${meeting_id}.txt`, transcription, { httpMetadata: { contentType: 'text/plain; charset=utf-8' } })

    // 回復被刪除的逐字稿時要重建資料列；大綱依使用者決定不連動，僅在「救回刪除」時一併還原
    let restoredOutline = ''
    if (!existing && outline_version_id) {
      const outlineSnapshot = await c.env.R2.get(outlineVersionObjectKey(meeting_id, outline_version_id))
      if (outlineSnapshot) restoredOutline = stripHtmlFromMarkdown(await outlineSnapshot.text())
    }

    const chunks = splitTranscriptionIntoChunks(transcription)
    const isChunked = chunks.length > 1
    const storedTranscription = isChunked ? '' : transcription
    const statements = [
      existing
        ? db.prepare('UPDATE transcriptions SET transcription = ? WHERE meeting_id = ?').bind(storedTranscription, meeting_id)
        : db.prepare('INSERT INTO transcriptions (meeting_id, transcription, outline) VALUES (?, ?, ?)').bind(meeting_id, storedTranscription, restoredOutline),
      db.prepare('DELETE FROM transcription_chunks WHERE meeting_id = ?').bind(meeting_id),
    ]
    if (isChunked) {
      statements.push(...chunks.map((chunk, chunkIndex) => db.prepare('INSERT INTO transcription_chunks (meeting_id, chunk_index, content) VALUES (?, ?, ?)').bind(meeting_id, chunkIndex, chunk)))
    }
    await db.batch(statements)

    await recordAudit(c.env, context.user, 'transcription.restore', auditTarget, {
      versionId: version_id,
      previousVersionId: previous_version_id ?? undefined,
      bytes: utf8ByteLength(transcription),
    })
    return c.json({ message: 'Transcription restored successfully', meeting_id, version_id, restored_version_id: restoredVersionId })
  })

  // POST /api/delete-transcription — 刪除現行逐字稿（歷史版本保留，可由日誌回復）
  app.use('/api/delete-transcription', corsFor(['POST']))
  app.post('/api/delete-transcription', async c => {
    const context = await tryGetAuthContext(c.env, c.req.raw.headers)
    if (!context) return c.json({ error: 'Unauthorized' }, 401)
    if (!hasPermission(context, 'transcription.update')) return c.json({ error: 'Forbidden' }, 403)
    if (!context.fresh) return c.json(sessionNotFreshBody(), 403)

    const body = await c.req.json<{ meeting_id: unknown }>().catch(() => null)
    const meeting_id = body?.meeting_id
    if (typeof meeting_id !== 'string' || !isValidMeetingId(meeting_id)) {
      return c.json({ error: '會議 ID 格式不正確', code: 'INVALID_MEETING_ID' }, 400)
    }

    const db = c.env.DB
    if (!db) return c.json({ error: 'DB binding not configured' }, 500)

    const existing = await db.prepare('SELECT outline FROM transcriptions WHERE meeting_id = ?').bind(meeting_id).first<{ outline: string | null }>()
    if (!existing) return c.json({ error: '找不到逐字稿', code: 'TRANSCRIPTION_NOT_FOUND' }, 404)

    // 刪除必須留得住回頭路：內容存成版本、大綱存成快照，兩個 id 都記進日誌
    let previous_version_id: string | null = null
    let previous_outline_version_id: string | null = null
    if (c.env.R2) {
      previous_version_id = await resolvePreviousVersionId(c.env.R2, meeting_id)
      previous_outline_version_id = await snapshotOutline(c.env.R2, meeting_id, existing.outline ?? '')
    }

    await db.batch([db.prepare('DELETE FROM transcriptions WHERE meeting_id = ?').bind(meeting_id), db.prepare('DELETE FROM transcription_chunks WHERE meeting_id = ?').bind(meeting_id)])
    // 只刪現行物件，versions/ 與 outlines/ 一律保留
    if (c.env.R2) await c.env.R2.delete(`${meeting_id}.txt`)

    await recordAudit(
      c.env,
      context.user,
      'transcription.delete',
      { type: 'transcription', id: meeting_id, label: formatMeetingId(meeting_id) },
      { previousVersionId: previous_version_id ?? undefined, previousOutlineVersionId: previous_outline_version_id ?? undefined }
    )
    return c.json({ message: 'Transcription deleted successfully', meeting_id })
  })

  // GET /api/query-table — 取得所有逐字稿列表
  app.use('/api/query-table', corsFor(['GET']))
  app.get('/api/query-table', async c => {
    const db = c.env.DB
    if (!db) return c.json({ error: 'DB binding not configured' }, 500)
    const result = await db.prepare('SELECT * FROM transcriptions').all()
    return c.json(result.results)
  })

  // POST /api/create-table — 建立 D1 資料表（idempotent；本地 D1 bootstrap 用）
  app.use('/api/create-table', corsFor(['POST']))
  app.post('/api/create-table', async c => {
    const db = c.env.DB
    if (!db) return c.json({ error: 'DB binding not configured' }, 500)
    await db.batch([
      db.prepare('CREATE TABLE IF NOT EXISTS transcriptions (meeting_id TEXT, transcription TEXT, outline TEXT)'),
      db.prepare('CREATE TABLE IF NOT EXISTS transcription_chunks (meeting_id TEXT NOT NULL, chunk_index INTEGER NOT NULL, content TEXT NOT NULL, PRIMARY KEY (meeting_id, chunk_index))'),
      // 與 migrations/0002_add_admin_audit_log.sql 同步；改欄位兩邊都要動
      db.prepare(
        'CREATE TABLE IF NOT EXISTS admin_audit_log (id INTEGER PRIMARY KEY AUTOINCREMENT, created_at INTEGER NOT NULL, actor_id TEXT NOT NULL, actor_name TEXT NOT NULL, actor_email TEXT NOT NULL, action TEXT NOT NULL, target_type TEXT NOT NULL, target_id TEXT NOT NULL, target_label TEXT NOT NULL, detail TEXT)'
      ),
      db.prepare('CREATE INDEX IF NOT EXISTS admin_audit_log_created_at_idx ON admin_audit_log (created_at DESC)'),
    ])
    return c.json({ message: 'Table created successfully' })
  })

  // POST /api/test-ai — 測試 AI 摘要（前端未使用；為介面完整性保留）
  app.use('/api/test-ai', corsFor(['POST']))
  app.post('/api/test-ai', async c => {
    let formData: FormData
    try {
      formData = await c.req.formData()
    } catch {
      return c.text('No file uploaded', 400)
    }
    const file = formData.get('file')
    if (!(file instanceof File)) return c.text('No file uploaded', 400)
    const transcription = await file.text()
    const outline = await generateOutline(transcription, c.env)
    return c.text(outline)
  })

  // GET /api/transcriptions/:meeting_id/text — 讀取逐字稿純文字（取代公開 R2 網域）
  app.use('/api/transcriptions/*', corsFor(['GET']))
  app.get('/api/transcriptions/:meeting_id/text', async c => {
    const meeting_id = c.req.param('meeting_id')
    if (!/^\d{8}$/.test(meeting_id)) return c.text('', 400)
    const db = c.env.DB
    if (!db) return c.json({ error: 'DB binding not configured' }, 500)
    const row = await db.prepare('SELECT transcription FROM transcriptions WHERE meeting_id = ?').bind(meeting_id).first<{ transcription: string }>()
    if (!row) return c.text('', 404)
    let transcription = row.transcription
    if (transcription === '') {
      const chunkResult = await db.prepare('SELECT content FROM transcription_chunks WHERE meeting_id = ? ORDER BY chunk_index').bind(meeting_id).all<{ content: string }>()
      if (chunkResult.results.length > 0) {
        transcription = chunkResult.results.map((chunk: { content: string }) => chunk.content).join('')
      }
    }
    return new Response(transcription, {
      status: 200,
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Content-Disposition': `attachment; filename="transcript-${meeting_id}.txt"`,
        'X-Content-Type-Options': 'nosniff',
      },
    })
  })

  // GET /api/transcriptions/:meeting_id/versions — 列出歷史版本（#73）
  // 僅管理員：舊版本可能含後續被修正／下架的內容，不隨現行逐字稿一起公開。
  app.get('/api/transcriptions/:meeting_id/versions', async c => {
    const meeting_id = c.req.param('meeting_id')
    if (!isValidMeetingId(meeting_id)) return c.json({ error: '會議 ID 格式不正確', code: 'INVALID_MEETING_ID' }, 400)

    const context = await tryGetAuthContext(c.env, c.req.raw.headers)
    if (!context) return c.json({ error: 'Unauthorized' }, 401)
    if (!hasPermission(context, 'transcription.update')) return c.json({ error: 'Forbidden' }, 403)
    if (!c.env.R2) return c.json({ error: 'R2 binding not configured' }, 500)

    const listed = await c.env.R2.list({
      prefix: versionsPrefix(meeting_id),
      include: ['customMetadata'],
      limit: VERSION_LIST_LIMIT,
    })

    const versions: TranscriptionVersion[] = listed.objects
      .map(object => {
        const version_id = versionIdFromKey(object.key, meeting_id)
        if (!version_id) return null
        return {
          version_id,
          uploaded_at: parseVersionId(version_id) ?? object.uploaded.getTime(),
          size: object.size,
          uploaded_by: object.customMetadata?.uploadedBy ?? '',
          source_filename: object.customMetadata?.sourceFilename ?? '',
        }
      })
      .filter((version): version is TranscriptionVersion => version !== null)
      .sort((a, b) => b.version_id.localeCompare(a.version_id))

    // R2 list 由舊到新掃描，超過上限時被截掉的是最新的版本——如實回報，不假裝列完了。
    return c.json({ meeting_id, versions, truncated: listed.truncated })
  })

  // GET /api/transcriptions/:meeting_id/versions/:version_id/text — 下載指定版本（#73）
  app.get('/api/transcriptions/:meeting_id/versions/:version_id/text', async c => {
    const meeting_id = c.req.param('meeting_id')
    const version_id = c.req.param('version_id')
    if (!isValidMeetingId(meeting_id) || !isValidVersionId(version_id)) {
      return c.json({ error: '版本識別碼格式不正確', code: 'INVALID_VERSION_ID' }, 400)
    }

    const context = await tryGetAuthContext(c.env, c.req.raw.headers)
    if (!context) return c.json({ error: 'Unauthorized' }, 401)
    if (!hasPermission(context, 'transcription.update')) return c.json({ error: 'Forbidden' }, 403)
    if (!c.env.R2) return c.json({ error: 'R2 binding not configured' }, 500)

    const object = await c.env.R2.get(versionObjectKey(meeting_id, version_id))
    if (!object) return c.json({ error: '找不到指定版本', code: 'VERSION_NOT_FOUND' }, 404)

    // 直接串流回應，不把整份逐字稿讀進 Worker 記憶體；
    // 轉型是為了吸收 @cloudflare/workers-types 與 DOM lib 兩套 ReadableStream 定義的落差。
    return new Response(object.body as unknown as BodyInit, {
      status: 200,
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Content-Disposition': `attachment; filename="transcript-${meeting_id}-${version_id}.txt"`,
        'X-Content-Type-Options': 'nosniff',
        'Cache-Control': 'no-store',
      },
    })
  })
}
