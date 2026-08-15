import { describe, expect, it } from 'vite-plus/test'
import app from '../index'

// /api/* 的跨站防護統一由 index.ts 的 hono/csrf 把關（不再逐端點自行做同源檢查）。
// 這裡以真實 Hono app 驗證中介層確實掛在所有 /api 路徑上：
// 測試環境沒有 Cloudflare 綁定，因此「通過 csrf」的請求會落到端點後因缺 env 回 401／500——
// 關鍵是它不是 403（沒被 csrf 擋），而被擋下的請求根本進不到端點。
const FORM_HEADERS = { 'content-type': 'multipart/form-data; boundary=x' }
const BODY = '--x--'
const CROSS_SITE = { ...FORM_HEADERS, origin: 'https://attacker.example', 'sec-fetch-site': 'cross-site' }
const SAME_ORIGIN = { ...FORM_HEADERS, origin: 'https://vtaiwan.tw', 'sec-fetch-site': 'same-origin' }

// 每個以 app.route() 掛載、且真的有非安全方法（非 GET／HEAD）的子 app 各取一條**真實存在**的路由。
// 「真實存在」是重點：只有命中 handler 的路徑才能證明子 app 的 handler 不會搶先回應而跳過
// 全域中介層——打不存在的路徑會落到 SSR fallback，即使中介層失效也測不出來。
// csrf **依設計不擋 GET／HEAD**：跨站 GET 是網頁平台的既有能力（<img>、<script>、<iframe> 都能發），
// 擋不住也不該擋——GET 必須是安全方法（不改狀態），攻擊者也讀不到回應。跨站「讀」的把關是
// 同源政策：不回 CORS 標頭就讀不到；本站的 corsFor 一律不帶 credentials，
// 即使呼叫端要求帶 cookie，瀏覽器也不會把 credentialed response 暴露給跨來源 script。
// 詳見 AGENTS.md「API 模組掛載規則」。純 GET 的掛載由 api-routing.test.ts 的註冊順序測試涵蓋。
const MOUNTED_WRITE_ENDPOINTS = [
  { mount: '/api/auth', method: 'POST', path: '/api/auth/admin/set-role' },
  { mount: '/api/jitsi-token', method: 'POST', path: '/api/jitsi-token' },
  { mount: '/api/transcription', method: 'POST', path: '/api/transcription/upload' },
  { mount: '/api/admin/civic-talks', method: 'PUT', path: '/api/admin/civic-talks/issues/1' },
  { mount: '/api/meeting', method: 'POST', path: '/api/meeting/20260803/transcript' },
] as const

describe('/api/* 全域 csrf 防護', () => {
  for (const { mount, method, path } of MOUNTED_WRITE_ENDPOINTS) {
    it(`${mount}：跨站 ${method} 一律 403（進不到端點）`, async () => {
      const res = await app.request(`https://vtaiwan.tw${path}`, { method, headers: CROSS_SITE, body: BODY })
      expect(res.status).toBe(403)
    })

    it(`${mount}：同源 ${method} 放行（交由端點自己驗身分／權限）`, async () => {
      const res = await app.request(`https://vtaiwan.tw${path}`, { method, headers: SAME_ORIGIN, body: BODY })
      expect(res.status).not.toBe(403)
      // 404 代表這條路由根本沒掛上，上面那條「跨站 403」就失去鑑別力
      //（任何 /api/* 路徑都會被 csrf 擋，包含不存在的）。
      expect(res.status).not.toBe(404)
    })
  }

  it('無 Origin 也無 Sec-Fetch-Site 的表單 POST 一律 403（非瀏覽器請求不再豁免）', async () => {
    const res = await app.request('https://vtaiwan.tw/api/transcription/zh-TW', {
      method: 'POST',
      headers: FORM_HEADERS,
      body: BODY,
    })
    expect(res.status).toBe(403)
  })

  it('GET 等安全方法不受影響', async () => {
    const res = await app.request('https://vtaiwan.tw/api/hello', { headers: { origin: 'https://attacker.example' } })
    expect(res.status).not.toBe(403)
  })

  it('寫入端點的跨來源 preflight 不回 CORS 放行標頭', async () => {
    const res = await app.request('https://next.vtaiwan.tw/api/transcription/upload', {
      method: 'OPTIONS',
      headers: {
        origin: 'https://vtaiwan.tw',
        'access-control-request-method': 'POST',
        'access-control-request-headers': 'content-type',
      },
    })
    expect(res.headers.get('access-control-allow-origin')).toBeNull()
    expect(res.headers.get('access-control-allow-methods')).toBeNull()
  })
})

// GET 的跨站防線不是 csrf，而是同源政策：能不能讀到回應由 CORS 標頭決定。
// 這裡釘住「不開放 credentialed response」——沒有 Access-Control-Allow-Credentials，
// 瀏覽器就不會把帶 cookie 的跨來源讀取結果交給呼叫端。這不代表 request 一定沒帶 cookie；
// cookie 是否送出由 Fetch credentials mode 與 cookie policy 決定，CORS 管的是 response 能否交給 script。
// 若哪天在 corsFor 加上 credentials: true，這條會紅——那等於把 session 資料開放給白名單上的每個網域。
describe('CORS 白名單不開放 credentialed response', () => {
  it('白名單來源拿得到 Allow-Origin，但拿不到 Allow-Credentials', async () => {
    const res = await app.request('https://next.vtaiwan.tw/api/hello', {
      headers: { origin: 'https://vtaiwan.tw', 'sec-fetch-site': 'cross-site' },
    })
    expect(res.headers.get('access-control-allow-origin')).toBe('https://vtaiwan.tw')
    expect(res.headers.get('access-control-allow-credentials')).toBeNull()
  })

  it('白名單外的來源連 Allow-Origin 都沒有', async () => {
    const res = await app.request('https://next.vtaiwan.tw/api/hello', {
      headers: { origin: 'https://attacker.example', 'sec-fetch-site': 'cross-site' },
    })
    expect(res.headers.get('access-control-allow-origin')).toBeNull()
  })
})

describe('WebSocket 升級的同源防護', () => {
  const websocketHeaders = { upgrade: 'websocket' }

  for (const origin of ['https://attacker.example', 'https://evil.vtaiwan.tw']) {
    it(`拒絕來自 ${origin} 的瀏覽器握手`, async () => {
      const res = await app.request('https://vtaiwan.tw/api/meeting/ws/20260803', {
        headers: { ...websocketHeaders, origin },
      })
      expect(res.status).toBe(403)
    })
  }

  it('同源瀏覽器握手通過 Origin 守衛', async () => {
    const res = await app.request('https://vtaiwan.tw/api/meeting/ws/20260803', {
      headers: { ...websocketHeaders, origin: 'https://vtaiwan.tw' },
    })
    // 測試環境沒有 DO 綁定，通過 Origin 守衛後會在後續綁定檢查回 500。
    expect(res.status).toBe(500)
  })
})
