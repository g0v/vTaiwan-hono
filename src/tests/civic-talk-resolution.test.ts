import { DatabaseSync, type SQLInputValue } from 'node:sqlite'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import type { AppBindings } from '../server/api/types'
import type { AuthContext } from '../server/lib/authorization'
import type * as Authorization from '../server/lib/authorization'

const auth = vi.hoisted(() => ({ context: null as AuthContext | null, banUser: vi.fn() }))
vi.mock('../server/lib/authorization', async importOriginal => ({
  ...(await importOriginal<typeof Authorization>()),
  tryGetAuthContext: async () => auth.context,
}))
vi.mock('../server/lib/createAuth', () => ({ createAuth: () => ({ api: { banUser: auth.banUser } }) }))

import app from '../server/api/civic-talk'

let db: DatabaseSync
let env: AppBindings

beforeEach(() => {
  db = new DatabaseSync(':memory:')
  // 真正執行查詢與更新；只以 SQLite adapter 取代 D1 transport。
  db.exec(`
    CREATE TABLE users (id TEXT PRIMARY KEY, banned INTEGER DEFAULT 0);
    INSERT INTO users (id) VALUES ('reporter'), ('poster');
    CREATE TABLE ct_materials (id INTEGER PRIMARY KEY, issue_id INTEGER, author_id TEXT, source_name TEXT, source_url TEXT, stance TEXT, content TEXT, verified_count INTEGER, abuse_flagged INTEGER);
    CREATE TABLE ct_briefings (id INTEGER PRIMARY KEY, issue_id INTEGER, author_id TEXT, consensus TEXT, disputes TEXT, positions TEXT, narrative TEXT, opinion_prompt TEXT, version INTEGER, abuse_flagged INTEGER);
    CREATE TABLE ct_opinions (id INTEGER PRIMARY KEY, issue_id INTEGER, author_id TEXT, summary TEXT, abuse_flagged INTEGER);
    CREATE TABLE ct_abuse_reports (id INTEGER PRIMARY KEY, reporter_id TEXT, reporter_name TEXT, reporter_email TEXT, reason TEXT, description TEXT, material_id INTEGER, briefing_id INTEGER, opinion_id INTEGER, review_status TEXT, created_at TEXT);
    INSERT INTO ct_materials (id, issue_id, author_id, stance, content, verified_count, abuse_flagged) VALUES (1, 1, 'poster', 'neutral', 'material', 0, 1);
    INSERT INTO ct_briefings (id, issue_id, author_id, version, abuse_flagged) VALUES (1, 1, 'poster', 1, 1);
    INSERT INTO ct_opinions (id, issue_id, author_id, summary, abuse_flagged) VALUES (1, 1, 'poster', 'opinion', 1);
    INSERT INTO ct_abuse_reports (id, reporter_id, material_id, review_status) VALUES (1, 'reporter', 1, 'pending');
  `)
  env = {
    DB_CIVIC_TALKS: {
      prepare(sql: string) {
        const statement = db.prepare(sql)
        return {
          bind(...values: SQLInputValue[]) {
            return {
              async first() {
                return statement.get(...values) ?? null
              },
              async run() {
                return statement.run(...values)
              },
            }
          },
        }
      },
    },
  } as unknown as AppBindings
  auth.context = {
    user: { id: 'reviewer', name: 'Reviewer', email: 'reviewer@example.com', image: null },
    role: 'super-admin',
    banned: false,
    permissions: [],
    fresh: true,
    stepUpExpiresAt: null,
    nameChangeCooldownDays: null,
  }
  auth.banUser.mockReset()
  auth.banUser.mockImplementation(async ({ body }: { body: { userId: string } }) => {
    db.prepare('UPDATE users SET banned = 1 WHERE id = ?').run(body.userId)
  })
})

afterEach(() => db.close())

function resolve(body: object) {
  return app.request(
    'https://www.vtaiwan.tw/abuse-reports/1/resolve',
    {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    },
    env
  )
}

function accountState() {
  return db
    .prepare('SELECT id, banned FROM users ORDER BY id')
    .all()
    .map(row => ({ ...row }))
}

function reviewStatus() {
  return db.prepare('SELECT review_status FROM ct_abuse_reports WHERE id = 1').get()?.review_status
}

describe('Civic Talk 不停權裁判', () => {
  for (const target of ['material', 'briefing', 'opinion'] as const) {
    for (const action of ['false_report', 'confirmed_abuse'] as const) {
      it(`${target}：${action} 不停權，但仍結案並更新內容標記`, async () => {
        db.prepare(`UPDATE ct_abuse_reports SET material_id = NULL, ${target}_id = 1 WHERE id = 1`).run()
        // 不停權不應解除既有停權。
        db.prepare('UPDATE users SET banned = 1 WHERE id = ?').run(action === 'false_report' ? 'poster' : 'reporter')
        const before = accountState()
        const response = await resolve({ action, banUser: false })
        expect(response.status).toBe(200)
        expect(accountState()).toEqual(before)
        expect(reviewStatus()).toBe(action === 'false_report' ? 'resolved_false' : 'resolved_abuse')
        expect(db.prepare(`SELECT abuse_flagged FROM ct_${target === 'briefing' ? 'briefings' : target === 'material' ? 'materials' : 'opinions'} WHERE id = 1`).get()?.abuse_flagged).toBe(
          action === 'false_report' ? 0 : 2
        )
      })
    }
  }

  for (const action of ['false_report', 'confirmed_abuse'] as const) {
    it(`${action} 原操作仍停權正確對象`, async () => {
      const response = await resolve({ action })
      expect(response.status).toBe(200)
      expect(accountState()).toEqual([
        { id: 'poster', banned: action === 'confirmed_abuse' ? 1 : 0 },
        { id: 'reporter', banned: action === 'false_report' ? 1 : 0 },
      ])
    })
  }

  it('拒絕非布林的停權選項，避免意外停權', async () => {
    const response = await resolve({ action: 'confirmed_abuse', banUser: 'false' })
    expect(response.status).toBe(400)
    expect(reviewStatus()).toBe('pending')
    expect(accountState().every(row => row.banned === 0)).toBe(true)
  })

  it('已結案不能再次裁判或追加停權', async () => {
    await resolve({ action: 'false_report', banUser: false })
    const response = await resolve({ action: 'confirmed_abuse' })
    expect(response.status).toBe(409)
    expect(reviewStatus()).toBe('resolved_false')
    expect(accountState().every(row => row.banned === 0)).toBe(true)
  })

  it('停權失敗仍保持待審核', async () => {
    auth.banUser.mockRejectedValueOnce({ statusCode: 403, body: { message: 'Cannot ban this user' } })
    const response = await resolve({ action: 'confirmed_abuse' })
    expect(response.status).toBe(403)
    expect(reviewStatus()).toBe('pending')
    expect(db.prepare('SELECT abuse_flagged FROM ct_materials WHERE id = 1').get()?.abuse_flagged).toBe(1)
  })

  for (const access of ['anonymous', 'admin', 'stale'] as const) {
    it(`${access} 不得使用不停權裁判`, async () => {
      if (access === 'anonymous') auth.context = null
      else if (auth.context) {
        if (access === 'admin') auth.context.role = 'admin'
        else auth.context.fresh = false
      }
      const response = await resolve({ action: 'confirmed_abuse', banUser: false })
      expect(response.status).toBe(access === 'anonymous' ? 401 : 403)
      expect(reviewStatus()).toBe('pending')
      expect(accountState().every(row => row.banned === 0)).toBe(true)
    })
  }
})
