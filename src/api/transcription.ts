import { corsFor } from './cors'
import { readAudioToText } from '../lib/transcribe'
import { generateOutline } from '../lib/ai-summarize'
import { splitTranscriptionIntoChunks, TRANSCRIPTION_MAX_BYTES, utf8ByteLength } from '../lib/transcription-storage'
import { formatVersionId, isValidMeetingId, isValidVersionId, parseVersionId, versionIdFromKey, versionObjectKey, versionsPrefix, type TranscriptionVersion } from '../lib/transcription-versions'
import { stripHtmlFromMarkdown } from '../lib/html-sanitizer'
import { getAuthContext, hasPermission, tryGetAuthContext } from '../server/lib/authorization'
import { sessionNotFreshBody } from '../server/lib/step-up'
import type { App } from './types'

// 單場會議的版本上限（R2 list 單次最多 1000）；超過即回報 truncated，不靜默截斷。
const VERSION_LIST_LIMIT = 1000

const LANG_MAP: Record<string, string> = {
  'zh-TW': 'zh',
  en: 'en',
  ja: 'ja',
}

export function registerTranscriptionApi(app: App) {
  // POST /api/transcription/:lang — 音頻檔轉文字（分軌本地錄音端點）
  app.use('/api/transcription/*', corsFor(['POST']))
  app.post('/api/transcription/:lang', async c => {
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
    if (c.env.R2) {
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
    await db.prepare('UPDATE transcriptions SET outline = ? WHERE meeting_id = ?').bind(stripHtmlFromMarkdown(outline), meeting_id).run()
    return c.json({ message: 'Outline updated successfully' })
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
