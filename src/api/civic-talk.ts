import { Hono } from 'hono'
import { isActiveAdminRole, isSuperAdminRole, tryGetAuthContext, type AuthContext } from '../server/lib/authorization'
import {
  confirmFlagCivicTalkContent,
  deleteCivicTalkIssue,
  deleteCivicTalkMaterial,
  deleteCivicTalkOpinion,
  getCivicTalkAbuseReport,
  listCivicTalkAbuseReports,
  listCivicTalkCreationEvents,
  listCivicTalkIssues,
  listCivicTalkMaterials,
  listCivicTalkOpinions,
  resolveCivicTalkAbuseReport,
  unflagCivicTalkContent,
  updateCivicTalkIssue,
  type CivicTalkIssueStatus,
} from '../server/lib/civic-talk'
import { createAuth } from '../server/lib/createAuth'
import { sessionNotFreshBody } from '../server/lib/step-up'
import type { AppBindings, AppEnv } from './types'

const issueStatuses = new Set<CivicTalkIssueStatus>(['collecting', 'summarizing', 'published'])

function parsePositiveId(raw: string): number | null {
  const id = Number(raw)
  return Number.isSafeInteger(id) && id > 0 ? id : null
}

function parseEventPage(raw: string | undefined): number | null {
  if (raw === undefined) return 1
  const page = Number(raw)
  return Number.isSafeInteger(page) && page > 0 && page <= 100_000 ? page : null
}

function parseEventSearch(raw: string | undefined): string | null {
  if (raw === undefined) return ''
  return raw.length <= 200 ? raw.trim() : null
}

function parseText(value: unknown, maxLength: number): string | null {
  return typeof value === 'string' && value.length <= maxLength ? value.trim() : null
}

async function requireFreshAdmin(env: AppBindings, headers: Headers): Promise<{ context: AuthContext } | { status: 401 | 403; body: object }> {
  const context = await tryGetAuthContext(env, headers)
  if (!context) return { status: 401, body: { error: 'Unauthorized' } }
  if (!isActiveAdminRole(context.role, context.banned)) return { status: 403, body: { error: 'Forbidden' } }
  if (!context.fresh) return { status: 403, body: sessionNotFreshBody() }
  return { context }
}

async function requireFreshSuperAdmin(env: AppBindings, headers: Headers): Promise<{ context: AuthContext } | { status: 401 | 403; body: object }> {
  const context = await tryGetAuthContext(env, headers)
  if (!context) return { status: 401, body: { error: 'Unauthorized' } }
  if (!isSuperAdminRole(context.role)) return { status: 403, body: { error: 'Forbidden' } }
  if (!context.fresh) return { status: 403, body: sessionNotFreshBody() }
  return { context }
}

function readIssueInput(value: unknown): { title: string; description: string; status: CivicTalkIssueStatus; polisId: string | null } | null {
  if (!value || typeof value !== 'object') return null
  const body = value as Record<string, unknown>
  const title = parseText(body.title, 200)
  const description = parseText(body.description, 10_000)
  if (!title || description === null || typeof body.polisEnabled !== 'boolean' || typeof body.status !== 'string' || !issueStatuses.has(body.status as CivicTalkIssueStatus)) return null
  return {
    title,
    description,
    status: body.status as CivicTalkIssueStatus,
    polisId: body.polisEnabled ? 'enabled' : null,
  }
}

async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json()
  } catch {
    return null
  }
}

const app = new Hono<AppEnv>()

app.get('/issues', async c => {
  const auth = await requireFreshAdmin(c.env, c.req.raw.headers)
  if (!('context' in auth)) return c.json(auth.body, auth.status)
  return c.json({ issues: await listCivicTalkIssues(c.env.DB_CIVIC_TALKS) })
})

app.get('/events', async c => {
  const auth = await requireFreshAdmin(c.env, c.req.raw.headers)
  if (!('context' in auth)) return c.json(auth.body, auth.status)
  const page = parseEventPage(c.req.query('page'))
  const searchQuery = parseEventSearch(c.req.query('q'))
  if (!page || searchQuery === null) return c.json({ error: 'Invalid event search parameters' }, 400)
  return c.json(await listCivicTalkCreationEvents(c.env.DB_CIVIC_TALKS, page, searchQuery))
})

app.put('/issues/:id', async c => {
  const auth = await requireFreshAdmin(c.env, c.req.raw.headers)
  if (!('context' in auth)) return c.json(auth.body, auth.status)
  const id = parsePositiveId(c.req.param('id'))
  const input = readIssueInput(await readJson(c.req.raw))
  if (!id || !input) return c.json({ error: 'Invalid issue payload' }, 400)
  if (!(await updateCivicTalkIssue(c.env.DB_CIVIC_TALKS, id, input))) return c.json({ error: 'Issue not found' }, 404)
  return c.json({ ok: true })
})

app.delete('/issues/:id', async c => {
  const auth = await requireFreshAdmin(c.env, c.req.raw.headers)
  if (!('context' in auth)) return c.json(auth.body, auth.status)
  const id = parsePositiveId(c.req.param('id'))
  if (!id) return c.json({ error: 'Invalid issue id' }, 400)
  await deleteCivicTalkIssue(c.env.DB_CIVIC_TALKS, id)
  return c.json({ ok: true })
})

app.get('/issues/:id/materials', async c => {
  const auth = await requireFreshAdmin(c.env, c.req.raw.headers)
  if (!('context' in auth)) return c.json(auth.body, auth.status)
  const issueId = parsePositiveId(c.req.param('id'))
  if (!issueId) return c.json({ error: 'Invalid issue id' }, 400)
  return c.json({ materials: await listCivicTalkMaterials(c.env.DB_CIVIC_TALKS, issueId) })
})

app.delete('/materials/:id', async c => {
  const auth = await requireFreshAdmin(c.env, c.req.raw.headers)
  if (!('context' in auth)) return c.json(auth.body, auth.status)
  const id = parsePositiveId(c.req.param('id'))
  if (!id) return c.json({ error: 'Invalid material id' }, 400)
  await deleteCivicTalkMaterial(c.env.DB_CIVIC_TALKS, id)
  return c.json({ ok: true })
})

app.get('/issues/:id/opinions', async c => {
  const auth = await requireFreshAdmin(c.env, c.req.raw.headers)
  if (!('context' in auth)) return c.json(auth.body, auth.status)
  const issueId = parsePositiveId(c.req.param('id'))
  if (!issueId) return c.json({ error: 'Invalid issue id' }, 400)
  return c.json({ opinions: await listCivicTalkOpinions(c.env.DB_CIVIC_TALKS, issueId) })
})

app.delete('/opinions/:id', async c => {
  const auth = await requireFreshAdmin(c.env, c.req.raw.headers)
  if (!('context' in auth)) return c.json(auth.body, auth.status)
  const id = parsePositiveId(c.req.param('id'))
  if (!id) return c.json({ error: 'Invalid opinion id' }, 400)
  await deleteCivicTalkOpinion(c.env.DB_CIVIC_TALKS, id)
  return c.json({ ok: true })
})

app.get('/abuse-reports', async c => {
  const auth = await requireFreshSuperAdmin(c.env, c.req.raw.headers)
  if (!('context' in auth)) return c.json(auth.body, auth.status)
  return c.json({ reports: await listCivicTalkAbuseReports(c.env.DB_CIVIC_TALKS) })
})

app.patch('/abuse-reports/:id/resolve', async c => {
  const auth = await requireFreshSuperAdmin(c.env, c.req.raw.headers)
  if (!('context' in auth)) return c.json(auth.body, auth.status)

  const id = parsePositiveId(c.req.param('id'))
  if (!id) return c.json({ error: 'Invalid report id' }, 400)

  let body: { action?: unknown }
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'Invalid JSON' }, 400)
  }
  if (body.action !== 'false_report' && body.action !== 'confirmed_abuse') {
    return c.json({ error: 'action must be "false_report" or "confirmed_abuse"' }, 400)
  }

  const report = await getCivicTalkAbuseReport(c.env.DB_CIVIC_TALKS, id)
  if (!report) return c.json({ error: 'Report not found' }, 404)
  if (report.review_status !== 'pending') return c.json({ error: 'Report already resolved' }, 409)

  const targetUserId = body.action === 'false_report' ? report.reporter_id : report.target_author_id
  const banReason = body.action === 'false_report' ? '濫用回報：誤報，已停權' : '發布違規內容：已確認濫用'

  // ban 先做——確保失敗時 review_status 保持 pending，前端拿到真實錯誤碼。
  // targetUserId 不存在時跳過 ban（目標已刪除）。
  if (targetUserId) {
    try {
      await createAuth(c.env).api.banUser({
        body: { userId: targetUserId, banReason },
        headers: c.req.raw.headers,
      })
    } catch (banErr) {
      const apiErr = banErr as { statusCode?: number; body?: { message?: string } }
      const status = typeof apiErr.statusCode === 'number' ? apiErr.statusCode : 500
      const message = apiErr.body?.message ?? 'Ban failed'
      console.error('banUser failed', { reportId: id, action: body.action, caught: banErr })
      return c.json({ error: message }, status as 400 | 403 | 404 | 500)
    }
  }

  // ban 成功（或無須 ban）才寫業務 DB
  if (body.action === 'false_report') {
    await resolveCivicTalkAbuseReport(c.env.DB_CIVIC_TALKS, id, 'resolved_false')
    await unflagCivicTalkContent(c.env.DB_CIVIC_TALKS, report)
  } else {
    await resolveCivicTalkAbuseReport(c.env.DB_CIVIC_TALKS, id, 'resolved_abuse')
    await confirmFlagCivicTalkContent(c.env.DB_CIVIC_TALKS, report)
  }

  return c.json({ ok: true })
})
export default app
