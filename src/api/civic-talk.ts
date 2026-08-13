import { isActiveAdminRole, tryGetAuthContext, type AuthContext } from '../server/lib/authorization'
import {
  deleteCivicTalkIssue,
  deleteCivicTalkMaterial,
  deleteCivicTalkOpinion,
  listCivicTalkCreationEvents,
  listCivicTalkIssues,
  listCivicTalkMaterials,
  listCivicTalkOpinions,
  updateCivicTalkIssue,
  type CivicTalkIssueStatus,
} from '../server/lib/civic-talk'
import { sessionNotFreshBody } from '../server/lib/step-up'
import type { App, AppBindings } from './types'

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

export function registerCivicTalkAdminApi(app: App): void {
  app.get('/api/admin/civic-talks/issues', async c => {
    const auth = await requireFreshAdmin(c.env, c.req.raw.headers)
    if (!('context' in auth)) return c.json(auth.body, auth.status)
    return c.json({ issues: await listCivicTalkIssues(c.env.DB_CIVIC_TALKS) })
  })

  app.get('/api/admin/civic-talks/events', async c => {
    const auth = await requireFreshAdmin(c.env, c.req.raw.headers)
    if (!('context' in auth)) return c.json(auth.body, auth.status)
    const page = parseEventPage(c.req.query('page'))
    if (!page) return c.json({ error: 'Invalid event page' }, 400)
    return c.json(await listCivicTalkCreationEvents(c.env.DB_CIVIC_TALKS, page))
  })

  app.put('/api/admin/civic-talks/issues/:id', async c => {
    const auth = await requireFreshAdmin(c.env, c.req.raw.headers)
    if (!('context' in auth)) return c.json(auth.body, auth.status)
    const id = parsePositiveId(c.req.param('id'))
    const input = readIssueInput(await readJson(c.req.raw))
    if (!id || !input) return c.json({ error: 'Invalid issue payload' }, 400)
    if (!(await updateCivicTalkIssue(c.env.DB_CIVIC_TALKS, id, input))) return c.json({ error: 'Issue not found' }, 404)
    return c.json({ ok: true })
  })

  app.delete('/api/admin/civic-talks/issues/:id', async c => {
    const auth = await requireFreshAdmin(c.env, c.req.raw.headers)
    if (!('context' in auth)) return c.json(auth.body, auth.status)
    const id = parsePositiveId(c.req.param('id'))
    if (!id) return c.json({ error: 'Invalid issue id' }, 400)
    await deleteCivicTalkIssue(c.env.DB_CIVIC_TALKS, id)
    return c.json({ ok: true })
  })

  app.get('/api/admin/civic-talks/issues/:id/materials', async c => {
    const auth = await requireFreshAdmin(c.env, c.req.raw.headers)
    if (!('context' in auth)) return c.json(auth.body, auth.status)
    const issueId = parsePositiveId(c.req.param('id'))
    if (!issueId) return c.json({ error: 'Invalid issue id' }, 400)
    return c.json({ materials: await listCivicTalkMaterials(c.env.DB_CIVIC_TALKS, issueId) })
  })

  app.delete('/api/admin/civic-talks/materials/:id', async c => {
    const auth = await requireFreshAdmin(c.env, c.req.raw.headers)
    if (!('context' in auth)) return c.json(auth.body, auth.status)
    const id = parsePositiveId(c.req.param('id'))
    if (!id) return c.json({ error: 'Invalid material id' }, 400)
    await deleteCivicTalkMaterial(c.env.DB_CIVIC_TALKS, id)
    return c.json({ ok: true })
  })

  app.get('/api/admin/civic-talks/issues/:id/opinions', async c => {
    const auth = await requireFreshAdmin(c.env, c.req.raw.headers)
    if (!('context' in auth)) return c.json(auth.body, auth.status)
    const issueId = parsePositiveId(c.req.param('id'))
    if (!issueId) return c.json({ error: 'Invalid issue id' }, 400)
    return c.json({ opinions: await listCivicTalkOpinions(c.env.DB_CIVIC_TALKS, issueId) })
  })

  app.delete('/api/admin/civic-talks/opinions/:id', async c => {
    const auth = await requireFreshAdmin(c.env, c.req.raw.headers)
    if (!('context' in auth)) return c.json(auth.body, auth.status)
    const id = parsePositiveId(c.req.param('id'))
    if (!id) return c.json({ error: 'Invalid opinion id' }, 400)
    await deleteCivicTalkOpinion(c.env.DB_CIVIC_TALKS, id)
    return c.json({ ok: true })
  })
}
