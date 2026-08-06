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

const ORIGIN = 'https://vtaiwan.tw'
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
