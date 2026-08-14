import type { D1Database } from '@cloudflare/workers-types'

export type CivicTalkIssueStatus = 'collecting' | 'summarizing' | 'published'

export interface CivicTalkIssue {
  id: number
  title: string
  description: string | null
  status: CivicTalkIssueStatus
  polis_id: string | null
  created_at: string
  material_count: number
  opinion_count: number
  author_name: string | null
}

export interface CivicTalkMaterial {
  id: number
  issue_id: number
  source_name: string | null
  source_url: string | null
  stance: 'pro' | 'con' | 'neutral' | 'unknown'
  content: string
  verified_count: number
  created_at: string
  author_name: string | null
}

export interface CivicTalkOpinion {
  id: number
  issue_id: number
  summary: string
  created_at: string
  author_name: string | null
}

export const CIVIC_TALK_EVENT_PAGE_SIZE = 15

export type CivicTalkCreationEventType = 'material' | 'briefing' | 'opinion'

export interface CivicTalkCreationEvent {
  id: number
  type: CivicTalkCreationEventType
  issueId: number
  issueTitle: string
  authorName: string | null
  createdAt: string
  material: { sourceName: string | null; sourceUrl: string | null; stance: CivicTalkMaterial['stance']; content: string; verifiedCount: number } | null
  briefing: { consensus: string | null; disputes: string | null; positions: string | null; narrative: string | null; opinionPrompt: string | null; version: number } | null
  opinion: { summary: string } | null
}

export interface CivicTalkCreationEventPage {
  events: CivicTalkCreationEvent[]
  page: number
  pageSize: number
  total: number
  totalPages: number
}

interface CivicTalkCreationEventRow {
  id: number
  type: CivicTalkCreationEventType
  issue_id: number
  issue_title: string
  author_name: string | null
  created_at: string
  source_name: string | null
  source_url: string | null
  stance: CivicTalkMaterial['stance'] | null
  content: string | null
  verified_count: number | null
  consensus: string | null
  disputes: string | null
  positions: string | null
  narrative: string | null
  opinion_prompt: string | null
  version: number | null
  summary: string | null
}

const ISSUE_COLUMNS = 'id, title, description, status, polis_id, created_at, author_name'
const ISSUE_COUNTS = `
  (SELECT COUNT(*) FROM ct_materials WHERE issue_id = ct_issues.id) AS material_count,
  (SELECT COUNT(*) FROM ct_opinions WHERE issue_id = ct_issues.id) AS opinion_count`

const CREATION_EVENT_ROWS = `
  SELECT
    ct_materials.id,
    'material' AS type,
    ct_materials.issue_id,
    ct_issues.title AS issue_title,
    ct_materials.author_name,
    ct_materials.created_at,
    ct_materials.source_name,
    ct_materials.source_url,
    ct_materials.stance,
    ct_materials.content,
    ct_materials.verified_count,
    NULL AS consensus,
    NULL AS disputes,
    NULL AS positions,
    NULL AS narrative,
    NULL AS opinion_prompt,
    NULL AS version,
    NULL AS summary
  FROM ct_materials
  INNER JOIN ct_issues ON ct_issues.id = ct_materials.issue_id
  UNION ALL
  SELECT
    ct_briefings.id,
    'briefing' AS type,
    ct_briefings.issue_id,
    ct_issues.title AS issue_title,
    ct_briefings.author_name,
    ct_briefings.created_at,
    NULL AS source_name,
    NULL AS source_url,
    NULL AS stance,
    NULL AS content,
    NULL AS verified_count,
    ct_briefings.consensus,
    ct_briefings.disputes,
    ct_briefings.positions,
    ct_briefings.narrative,
    ct_briefings.opinion_prompt,
    ct_briefings.version,
    NULL AS summary
  FROM ct_briefings
  INNER JOIN ct_issues ON ct_issues.id = ct_briefings.issue_id
  UNION ALL
  SELECT
    ct_opinions.id,
    'opinion' AS type,
    ct_opinions.issue_id,
    ct_issues.title AS issue_title,
    ct_opinions.author_name,
    ct_opinions.created_at,
    NULL AS source_name,
    NULL AS source_url,
    NULL AS stance,
    NULL AS content,
    NULL AS verified_count,
    NULL AS consensus,
    NULL AS disputes,
    NULL AS positions,
    NULL AS narrative,
    NULL AS opinion_prompt,
    NULL AS version,
    ct_opinions.summary
  FROM ct_opinions
  INNER JOIN ct_issues ON ct_issues.id = ct_opinions.issue_id`

export async function listCivicTalkIssues(db: D1Database): Promise<CivicTalkIssue[]> {
  const { results } = await db.prepare(`SELECT ${ISSUE_COLUMNS}, ${ISSUE_COUNTS} FROM ct_issues ORDER BY created_at DESC`).all<CivicTalkIssue>()
  return results ?? []
}

function toCreationEvent(row: CivicTalkCreationEventRow): CivicTalkCreationEvent {
  return {
    id: row.id,
    type: row.type,
    issueId: row.issue_id,
    issueTitle: row.issue_title,
    authorName: row.author_name,
    createdAt: row.created_at,
    material:
      row.type === 'material'
        ? {
            sourceName: row.source_name,
            sourceUrl: row.source_url,
            stance: row.stance ?? 'unknown',
            content: row.content ?? '',
            verifiedCount: row.verified_count ?? 0,
          }
        : null,
    briefing:
      row.type === 'briefing'
        ? {
            consensus: row.consensus,
            disputes: row.disputes,
            positions: row.positions,
            narrative: row.narrative,
            opinionPrompt: row.opinion_prompt,
            version: row.version ?? 1,
          }
        : null,
    opinion: row.type === 'opinion' ? { summary: row.summary ?? '' } : null,
  }
}

function escapeLikePattern(value: string): string {
  return `%${value.replace(/[\\%_]/g, character => `\\${character}`)}%`
}

export async function listCivicTalkCreationEvents(db: D1Database, page: number, searchQuery: string = ''): Promise<CivicTalkCreationEventPage> {
  const offset = (page - 1) * CIVIC_TALK_EVENT_PAGE_SIZE
  const normalizedSearchQuery = searchQuery.trim()
  const searchWhere = normalizedSearchQuery
    ? ` WHERE issue_title LIKE ? ESCAPE '\\' OR content LIKE ? ESCAPE '\\' OR consensus LIKE ? ESCAPE '\\' OR disputes LIKE ? ESCAPE '\\' OR positions LIKE ? ESCAPE '\\' OR narrative LIKE ? ESCAPE '\\' OR opinion_prompt LIKE ? ESCAPE '\\' OR summary LIKE ? ESCAPE '\\'`
    : ''
  const searchParams = normalizedSearchQuery ? Array.from({ length: 8 }, () => escapeLikePattern(normalizedSearchQuery)) : []
  const [countResult, eventResult] = await db.batch([
    db.prepare(`SELECT COUNT(*) AS total FROM (${CREATION_EVENT_ROWS})${searchWhere}`).bind(...searchParams),
    db.prepare(`SELECT * FROM (${CREATION_EVENT_ROWS})${searchWhere} ORDER BY created_at DESC, id DESC, type ASC LIMIT ? OFFSET ?`).bind(...searchParams, CIVIC_TALK_EVENT_PAGE_SIZE, offset),
  ])
  const total = Number((countResult.results?.[0] as { total?: number } | undefined)?.total ?? 0)

  return {
    events: (eventResult.results as CivicTalkCreationEventRow[] | undefined)?.map(toCreationEvent) ?? [],
    page,
    pageSize: CIVIC_TALK_EVENT_PAGE_SIZE,
    total,
    totalPages: Math.ceil(total / CIVIC_TALK_EVENT_PAGE_SIZE),
  }
}

export async function updateCivicTalkIssue(db: D1Database, id: number, input: { title: string; description: string; status: CivicTalkIssueStatus; polisId: string | null }): Promise<boolean> {
  const exists = await db.prepare('SELECT id FROM ct_issues WHERE id = ?').bind(id).first<{ id: number }>()
  if (!exists) return false
  await db.prepare('UPDATE ct_issues SET title = ?, description = ?, status = ?, polis_id = ? WHERE id = ?').bind(input.title, input.description, input.status, input.polisId, id).run()
  return true
}

export async function deleteCivicTalkIssue(db: D1Database, id: number): Promise<void> {
  await db.batch([
    db.prepare('DELETE FROM ct_opinions WHERE issue_id = ?').bind(id),
    db.prepare('DELETE FROM ct_briefings WHERE issue_id = ?').bind(id),
    db.prepare('DELETE FROM ct_materials WHERE issue_id = ?').bind(id),
    db.prepare('DELETE FROM ct_issues WHERE id = ?').bind(id),
  ])
}

export async function listCivicTalkMaterials(db: D1Database, issueId: number): Promise<CivicTalkMaterial[]> {
  const { results } = await db
    .prepare('SELECT id, issue_id, source_name, source_url, stance, content, verified_count, created_at, author_name FROM ct_materials WHERE issue_id = ? ORDER BY created_at DESC')
    .bind(issueId)
    .all<CivicTalkMaterial>()
  return results ?? []
}

export async function deleteCivicTalkMaterial(db: D1Database, id: number): Promise<void> {
  await db.prepare('DELETE FROM ct_materials WHERE id = ?').bind(id).run()
}

export async function listCivicTalkOpinions(db: D1Database, issueId: number): Promise<CivicTalkOpinion[]> {
  const { results } = await db.prepare('SELECT id, issue_id, summary, created_at, author_name FROM ct_opinions WHERE issue_id = ? ORDER BY created_at DESC').bind(issueId).all<CivicTalkOpinion>()
  return results ?? []
}

export async function deleteCivicTalkOpinion(db: D1Database, id: number): Promise<void> {
  await db.prepare('DELETE FROM ct_opinions WHERE id = ?').bind(id).run()
}

export type CivicTalkAbuseReportReason = 'spam' | 'hate_speech' | 'defamation' | 'misinformation' | 'other'
export type CivicTalkAbuseReportStatus = 'pending' | 'resolved_false' | 'resolved_abuse'

export interface CivicTalkAbuseReport {
  id: number
  reporter_id: string
  reporter_name: string | null
  reporter_email: string
  reason: CivicTalkAbuseReportReason
  description: string | null
  material_id: number | null
  briefing_id: number | null
  opinion_id: number | null
  review_status: CivicTalkAbuseReportStatus
  created_at: string
  target_issue_id: number | null
  target_author_id: string | null
}

const ABUSE_REPORT_SELECT = `SELECT
  r.id, r.reporter_id, r.reporter_name, r.reporter_email,
  r.reason, r.description,
  r.material_id, r.briefing_id, r.opinion_id,
  r.review_status, r.created_at,
  COALESCE(m.issue_id, b.issue_id, o.issue_id)    AS target_issue_id,
  COALESCE(m.author_id, b.author_id, o.author_id) AS target_author_id
FROM ct_abuse_reports r
LEFT JOIN ct_materials m ON r.material_id = m.id
LEFT JOIN ct_briefings b ON r.briefing_id = b.id
LEFT JOIN ct_opinions  o ON r.opinion_id  = o.id`

export async function listCivicTalkAbuseReports(db: D1Database): Promise<CivicTalkAbuseReport[]> {
  const { results } = await db.prepare(`${ABUSE_REPORT_SELECT} ORDER BY r.created_at DESC`).all<CivicTalkAbuseReport>()
  return results ?? []
}

export async function getCivicTalkAbuseReport(db: D1Database, id: number): Promise<CivicTalkAbuseReport | null> {
  return db.prepare(`${ABUSE_REPORT_SELECT} WHERE r.id = ?`).bind(id).first<CivicTalkAbuseReport>()
}

export async function resolveCivicTalkAbuseReport(db: D1Database, id: number, status: 'resolved_false' | 'resolved_abuse'): Promise<void> {
  await db.prepare('UPDATE ct_abuse_reports SET review_status = ? WHERE id = ?').bind(status, id).run()
}

export async function unflagCivicTalkContent(db: D1Database, report: Pick<CivicTalkAbuseReport, 'material_id' | 'briefing_id' | 'opinion_id'>): Promise<void> {
  if (report.material_id != null) {
    await db.prepare('UPDATE ct_materials SET abuse_flagged = 0 WHERE id = ?').bind(report.material_id).run()
  } else if (report.briefing_id != null) {
    await db.prepare('UPDATE ct_briefings SET abuse_flagged = 0 WHERE id = ?').bind(report.briefing_id).run()
  } else if (report.opinion_id != null) {
    await db.prepare('UPDATE ct_opinions SET abuse_flagged = 0 WHERE id = ?').bind(report.opinion_id).run()
  }
}

export async function confirmFlagCivicTalkContent(db: D1Database, report: Pick<CivicTalkAbuseReport, 'material_id' | 'briefing_id' | 'opinion_id'>): Promise<void> {
  if (report.material_id != null) {
    await db.prepare('UPDATE ct_materials SET abuse_flagged = 2 WHERE id = ?').bind(report.material_id).run()
  } else if (report.briefing_id != null) {
    await db.prepare('UPDATE ct_briefings SET abuse_flagged = 2 WHERE id = ?').bind(report.briefing_id).run()
  } else if (report.opinion_id != null) {
    await db.prepare('UPDATE ct_opinions SET abuse_flagged = 2 WHERE id = ?').bind(report.opinion_id).run()
  }
}
