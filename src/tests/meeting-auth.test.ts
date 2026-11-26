/**
 * meeting API 授權測試（#81）
 *
 * 驗證四個寫入路徑都在 CSRF → 認證 → 權限（meeting.join）三道關卡後才執行 DB 操作。
 *
 * 測試環境沒有 Cloudflare 綁定（BETTER_AUTH_SECRET 等為 undefined），
 * 因此 tryGetAuthContext 會捕捉例外並回傳 null → 端點回 401。
 * 這正是「三道關卡」中認證關卡的可觀察行為。
 */

import { describe, expect, it } from 'vite-plus/test'
import app from '../index'

const ORIGIN = 'https://www.vtaiwan.tw'
const SAME_ORIGIN = { origin: ORIGIN, 'sec-fetch-site': 'same-origin' }
const DATE = '20260806'

describe('meeting API 寫入端點：未認證一律 401', () => {
  it('POST /api/meeting/:date/transcript 無 session → 401', async () => {
    const res = await app.request(`${ORIGIN}/api/meeting/${DATE}/transcript`, {
      method: 'POST',
      headers: { ...SAME_ORIGIN, 'content-type': 'application/json' },
      body: JSON.stringify({ timestamp: Date.now(), text: 'hello', speaker: 'test' }),
    })
    expect(res.status).toBe(401)
  })

  it('DELETE /api/meeting/:date/transcript/:ts 無 session → 401', async () => {
    const res = await app.request(`${ORIGIN}/api/meeting/${DATE}/transcript/1234567890`, {
      method: 'DELETE',
      headers: SAME_ORIGIN,
    })
    expect(res.status).toBe(401)
  })

  it('PATCH /api/meeting/:date 無 session → 401', async () => {
    const res = await app.request(`${ORIGIN}/api/meeting/${DATE}`, {
      method: 'PATCH',
      headers: { ...SAME_ORIGIN, 'content-type': 'application/json' },
      body: JSON.stringify({ recorder_uid: 'some-user' }),
    })
    expect(res.status).toBe(401)
  })

  it('GET /api/meeting/:date 無須認證（任何人可讀） → 非 401', async () => {
    const res = await app.request(`${ORIGIN}/api/meeting/${DATE}`, {
      headers: SAME_ORIGIN,
    })
    // 公開讀取端點：可能 200 或 500（無 DB 綁定），但絕不是 401
    expect(res.status).not.toBe(401)
  })
})

// ─── WebSocket 升級：轉送給 DO 的身分標頭一律由 Worker 覆寫（#153 步驟 2）────────

import { buildForwardHeaders } from '../server/api/meeting'
import { decodeUserName } from '../lib/capture-list'
import type { AuthContext } from '../server/lib/authorization'

function authContext(overrides: Partial<AuthContext> = {}): AuthContext {
  return {
    user: { id: 'uid-wang', name: '王小明', email: 'wang@example.com', image: null },
    role: 'user',
    banned: false,
    permissions: ['meeting.join'],
    fresh: false,
    stepUpExpiresAt: null,
    nameChangeCooldownDays: null,
    ...overrides,
  }
}

/** 攻擊者在握手請求自帶的身分標頭：三個都必須被 Worker 蓋掉 */
const SPOOFED = {
  'X-Authenticated': 'true',
  'X-User-Id': 'uid-admin',
  'X-User-Name': encodeURIComponent('bestian'),
}

describe('WebSocket 升級：身分標頭由 Worker 依 session 無條件覆寫', () => {
  it('未登入：外部自帶的 X-Authenticated / X-User-Id / X-User-Name 全部被清空', () => {
    const forwarded = buildForwardHeaders(new Headers(SPOOFED), null)
    expect(forwarded.get('X-Authenticated')).toBe('false')
    expect(forwarded.get('X-User-Id')).toBe('')
    expect(forwarded.get('X-User-Name')).toBe('')
  })

  it('已登入：三個標頭改為 session 的身分，外部自帶的值不會留下', () => {
    const forwarded = buildForwardHeaders(new Headers(SPOOFED), authContext())
    expect(forwarded.get('X-Authenticated')).toBe('true')
    expect(forwarded.get('X-User-Id')).toBe('uid-wang')
    expect(decodeUserName(forwarded.get('X-User-Name'))).toBe('王小明')
  })

  it('中文名稱經編碼後可放進標頭，DO 端解碼還原', () => {
    const forwarded = buildForwardHeaders(new Headers(), authContext({ user: { id: 'u', name: '林 Lin／測試', email: 'l@example.com', image: null } }))
    expect(forwarded.get('X-User-Name')).not.toContain('林')
    expect(decodeUserName(forwarded.get('X-User-Name'))).toBe('林 Lin／測試')
  })

  it('停權帳號（permissions 為空）：X-Authenticated 為 false，不得寫入', () => {
    const forwarded = buildForwardHeaders(new Headers(SPOOFED), authContext({ banned: true, permissions: [] }))
    expect(forwarded.get('X-Authenticated')).toBe('false')
  })

  it('其他標頭（Cookie、Upgrade）原樣保留', () => {
    const incoming = new Headers({ Cookie: 'session=abc', Upgrade: 'websocket', ...SPOOFED })
    const forwarded = buildForwardHeaders(incoming, null)
    expect(forwarded.get('Cookie')).toBe('session=abc')
    expect(forwarded.get('Upgrade')).toBe('websocket')
  })
})
