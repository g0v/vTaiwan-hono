import type { AppBindings } from '../../api/types'
import { resolveRole, type AuthContext } from './authorization'
import { AUDIT_LOG_LIMIT, parseAuditDetail, serializeAuditDetail, type AuditAction, type AuditDetail, type AuditEntry, type AuditTargetType } from '../../lib/audit-log'

export interface AuditTarget {
  type: AuditTargetType
  id: string
  /** 寫入當下的顯示名稱快照（跨資料庫無法 JOIN，見 migrations/0002） */
  label: string
}

/**
 * 寫一筆變更日誌。
 * **絕不 throw**：日誌寫失敗不該把一個已經成功的管理操作變成 500，
 * 也不該讓使用者以為改角色／上傳逐字稿失敗而重做一次。
 */
export async function recordAudit(env: AppBindings, actor: AuthContext['user'], action: AuditAction, target: AuditTarget, detail: AuditDetail = {}): Promise<void> {
  try {
    const db = env.DB
    if (!db) return
    await db
      .prepare('INSERT INTO admin_audit_log (created_at, actor_id, actor_name, actor_email, action, target_type, target_id, target_label, detail) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .bind(Date.now(), actor.id, actor.name, actor.email, action, target.type, target.id, target.label, serializeAuditDetail(detail))
      .run()
  } catch (error) {
    console.error('Failed to record admin audit entry:', error)
  }
}

interface AuditRow {
  id: number
  created_at: number
  actor_id: string
  actor_name: string
  actor_email: string
  action: string
  target_type: string
  target_id: string
  target_label: string
  detail: string | null
}

function rowToEntry(row: AuditRow): AuditEntry {
  return {
    id: row.id,
    createdAt: row.created_at,
    actor: { id: row.actor_id, name: row.actor_name, email: row.actor_email },
    action: row.action as AuditAction,
    target: { type: row.target_type as AuditTargetType, id: row.target_id, label: row.target_label },
    detail: parseAuditDetail(row.detail),
  }
}

/** 近期變更，新的在前 */
export async function listAudit(env: AppBindings, limit: number = AUDIT_LOG_LIMIT): Promise<AuditEntry[]> {
  const db = env.DB
  if (!db) return []
  const result = await db.prepare('SELECT * FROM admin_audit_log ORDER BY created_at DESC, id DESC LIMIT ?').bind(limit).all<AuditRow>()
  return result.results.map(rowToEntry)
}

/**
 * 取操作對象的快照（姓名／角色）——必須在動作執行**之前**呼叫：
 * remove-user 之後使用者就查不到了，set-role 之後也拿不到原角色。
 */
export async function findAuditUserTarget(env: AppBindings, userId: string): Promise<{ label: string; role: string } | null> {
  try {
    const db = env.DB_AUTH
    if (!db) return null
    const row = await db.prepare('SELECT "name", "email", "role" FROM "user" WHERE "id" = ?').bind(userId).first<{ name: string | null; email: string | null; role: string | null }>()
    if (!row) return null
    return { label: row.name || row.email || userId, role: resolveRole(row.role) }
  } catch (error) {
    console.error('Failed to snapshot audit target:', error)
    return null
  }
}
