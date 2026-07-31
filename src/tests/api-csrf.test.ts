import { describe, expect, it } from 'vite-plus/test'
import app from '../index'

// /api/* 的跨站防護統一由 index.ts 的 hono/csrf 把關（不再逐端點自行做同源檢查）。
// 這裡以真實 Hono app 驗證中介層確實掛在所有 /api 路徑上：
// 測試環境沒有 Cloudflare 綁定，因此「通過 csrf」的請求會落到端點後因缺 env 回 500——
// 關鍵是它不是 403（沒被 csrf 擋），而被擋下的請求根本進不到端點。
const FORM_HEADERS = { 'content-type': 'multipart/form-data; boundary=x' }
const BODY = '--x--'

describe('/api/* 全域 csrf 防護', () => {
  it('跨站表單 POST 一律 403（進不到端點）', async () => {
    const res = await app.request('https://vtaiwan.tw/api/upload-transcription', {
      method: 'POST',
      headers: { ...FORM_HEADERS, origin: 'https://attacker.example', 'sec-fetch-site': 'cross-site' },
      body: BODY,
    })
    expect(res.status).toBe(403)
  })

  it('同源表單 POST 放行（交由端點自己驗身分／權限）', async () => {
    const res = await app.request('https://vtaiwan.tw/api/upload-transcription', {
      method: 'POST',
      headers: { ...FORM_HEADERS, origin: 'https://vtaiwan.tw', 'sec-fetch-site': 'same-origin' },
      body: BODY,
    })
    expect(res.status).not.toBe(403)
  })

  it('無 Origin 也無 Sec-Fetch-Site 的表單 POST 一律 403（非瀏覽器請求不再豁免）', async () => {
    const res = await app.request('https://vtaiwan.tw/api/transcription/zh-TW', {
      method: 'POST',
      headers: FORM_HEADERS,
      body: BODY,
    })
    expect(res.status).toBe(403)
  })

  // /api/auth/* 是以 app.route('/', auth) 掛載的子 app，路徑組成方式與上面直接註冊的
  // 端點不同——這是最需要保護的一段，單獨驗一次全域中介層確實也蓋到它。
  it('掛載的 /api/auth/* 子 app 同樣受保護', async () => {
    const res = await app.request('https://vtaiwan.tw/api/auth/admin/set-role', {
      method: 'POST',
      headers: { ...FORM_HEADERS, origin: 'https://attacker.example', 'sec-fetch-site': 'cross-site' },
      body: BODY,
    })
    expect(res.status).toBe(403)
  })

  it('GET 等安全方法不受影響', async () => {
    const res = await app.request('https://vtaiwan.tw/api/hello', { headers: { origin: 'https://attacker.example' } })
    expect(res.status).not.toBe(403)
  })
})
