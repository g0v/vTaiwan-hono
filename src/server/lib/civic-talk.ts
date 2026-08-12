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

const ISSUE_COLUMNS = 'id, title, description, status, polis_id, created_at, author_name'
const ISSUE_COUNTS = `
  (SELECT COUNT(*) FROM ct_materials WHERE issue_id = ct_issues.id) AS material_count,
  (SELECT COUNT(*) FROM ct_opinions WHERE issue_id = ct_issues.id) AS opinion_count`

export async function listCivicTalkIssues(db: D1Database): Promise<CivicTalkIssue[]> {
  const { results } = await db.prepare(`SELECT ${ISSUE_COLUMNS}, ${ISSUE_COUNTS} FROM ct_issues ORDER BY created_at DESC`).all<CivicTalkIssue>()
  return results ?? []
}

export async function createCivicTalkIssue(
  db: D1Database,
  input: { title: string; description: string; status: CivicTalkIssueStatus; polisId: string | null; authorId: string; authorName: string }
): Promise<number> {
  const { meta } = await db
    .prepare('INSERT INTO ct_issues (title, description, status, polis_id, author_id, author_name) VALUES (?, ?, ?, ?, ?, ?)')
    .bind(input.title, input.description, input.status, input.polisId, input.authorId, input.authorName)
    .run()
  return meta.last_row_id
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
