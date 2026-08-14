import { describe, expect, it } from 'vite-plus/test'
import app from '../index'

// Civic Talk 管理端會回傳投稿者快照，故所有讀寫都必須先通過管理員與二次驗證邊界。
// 測試環境沒有 Better Auth／D1 綁定，正常的同源請求會在身份檢查處回 401。
describe('Civic Talk 管理端點的授權關卡', () => {
  it('未登入不得讀取含投稿者的議題資料', async () => {
    const response = await app.request('https://vtaiwan.tw/api/admin/civic-talks/issues', {
      headers: { origin: 'https://vtaiwan.tw' },
    })

    expect(response.status).toBe(401)
  })

  it('未登入不得刪除素材', async () => {
    const response = await app.request('https://vtaiwan.tw/api/admin/civic-talks/materials/1', {
      method: 'DELETE',
      headers: { origin: 'https://vtaiwan.tw', 'content-type': 'application/json' },
    })

    expect(response.status).toBe(401)
  })

  it('未登入不得讀取含投稿者與內容的建立事件', async () => {
    const response = await app.request('https://vtaiwan.tw/api/admin/civic-talks/events?page=1', {
      headers: { origin: 'https://vtaiwan.tw' },
    })

    expect(response.status).toBe(401)
  })

  it('未登入不得讀取濫用回報', async () => {
    const response = await app.request('https://vtaiwan.tw/api/admin/civic-talks/abuse-reports', {
      headers: { origin: 'https://vtaiwan.tw' },
    })

    expect(response.status).toBe(401)
  })

  it('未登入不得解決濫用回報', async () => {
    const response = await app.request('https://vtaiwan.tw/api/admin/civic-talks/abuse-reports/1/resolve', {
      method: 'PATCH',
      headers: { origin: 'https://vtaiwan.tw', 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'false_report' }),
    })

    expect(response.status).toBe(401)
  })
})
