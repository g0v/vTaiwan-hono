import { describe, expect, it } from 'vite-plus/test'
import app from '../index'

// 各 /api 模組改以 app.route(prefix, subApp) 掛載後，兩件原本「自然成立」的事變成了需要維護的契約。
// 這個檔案就是釘住那兩件事——它們壞掉時不會有任何錯誤訊息，只會靜默失去防護／改走錯的 handler。

// index.ts 只有這兩條是全域中介層路徑：'*'（CSP／安全標頭）與 '/api/*'（csrf）。
// 子 app 掛進來後也會有以 * 結尾的路徑（例如 /api/transcription/:meeting_id/*），
// 那些是模組內部的路由，不該被當成全域中介層。
const GLOBAL_MIDDLEWARE_PATHS = ['/*', '/api/*']

// app.use() 註冊的是 ALL；同樣掛在 '/*' 的 SSR fallback 是 GET，不是中介層。
const isGlobalMiddleware = (route: { method: string; path: string }) => route.method === 'ALL' && GLOBAL_MIDDLEWARE_PATHS.includes(route.path)

describe('全域中介層的註冊順序', () => {
  it('/api/* 的 csrf 守衛確實存在', () => {
    expect(app.routes.some(route => route.method === 'ALL' && route.path === '/api/*')).toBe(true)
  })

  // Hono 依註冊順序組出 handler chain，而子 app 的 handler 一旦回應就結束整條 chain：
  // 寫在 app.route() 之後的 /api/* 中介層，對所有掛載的子 app 都會靜默失效。
  // refactor 前所有端點註冊在同一個 app 上，這個順序是必然；改用 app.route() 之後要主動維護。
  it('全域中介層全部排在具體 /api 路由之前', () => {
    const lastGlobal = app.routes.reduce((last, route, index) => (isGlobalMiddleware(route) ? index : last), -1)
    const firstApiRoute = app.routes.findIndex(route => route.path.startsWith('/api/') && !GLOBAL_MIDDLEWARE_PATHS.includes(route.path))

    expect(firstApiRoute).toBeGreaterThan(-1)
    expect(lastGlobal).toBeGreaterThan(-1)
    expect(lastGlobal).toBeLessThan(firstApiRoute)
  })

  it('所有 API 路由都掛在 /api/ 之下（否則會落在 csrf 守備範圍外）', () => {
    const outsideApi = app.routes.filter(route => !GLOBAL_MIDDLEWARE_PATHS.includes(route.path) && !route.path.startsWith('/api/'))
    expect(outsideApi.map(route => `${route.method} ${route.path}`)).toEqual([])
  })
})

describe('動態路徑不得攔截同層的固定名稱端點', () => {
  const SAME_ORIGIN = { origin: 'https://vtaiwan.tw', 'sec-fetch-site': 'same-origin', 'content-type': 'multipart/form-data; boundary=x' }
  const post = (path: string) => app.request(`https://vtaiwan.tw${path}`, { method: 'POST', headers: SAME_ORIGIN, body: '--x--' })

  // /api/transcription/:lang 與 /upload、/outline… 同層。:lang 收窄成 LANG_MAP 的精確清單後，
  // 「固定名稱必須先註冊」不再是正確性的前提；這裡驗證收窄本身沒有鬆掉。
  it('/api/transcription/:lang 只接受 LANG_MAP 列出的語言碼', async () => {
    for (const lang of ['zh-TW', 'en', 'ja']) {
      expect((await post(`/api/transcription/${lang}`)).status, lang).not.toBe(404)
    }
    // 固定端點名稱不在清單裡，因此不會落進 :lang
    for (const name of ['upload', 'outline', 'restore', 'delete', 'create-table', 'test-ai']) {
      expect((await post(`/api/transcription/${name}`)).status, name).not.toBe(404)
    }
    // 清單外的字串一律找不到路由（而不是被當成語音辨識的語言碼直接送出去）
    for (const unknown of ['zh-CN', 'fr', 'not-a-language-code']) {
      expect((await post(`/api/transcription/${unknown}`)).status, unknown).toBe(404)
    }
  })

  // /api/auth/* 是 Better Auth 的 catch-all，/api/auth/me 是本站自己的 session 端點；
  // 順序反了會被 Better Auth 接走並回 404，登入態就整站讀不到。
  it('/api/auth/me 優先於 Better Auth 的 catch-all', async () => {
    const res = await app.request('https://vtaiwan.tw/api/auth/me', { headers: { origin: 'https://vtaiwan.tw' } })
    expect(res.status).not.toBe(404)
  })
})

// 寫入端點一律不宣告 CORS：它們只給本站自己的頁面用，不應回應跨來源 preflight。
// 表單型實際請求另由全域 csrf() 把關；兩層責任不能混為一談。
// 這裡以回應標頭驗：同源請求若帶回 Access-Control-Allow-Origin，就代表該端點又掛上了 corsFor。
describe('寫入端點不對外宣告 CORS', () => {
  const WRITE_ENDPOINTS = [
    { routePath: '/api/auth/*', method: 'POST', path: '/api/auth/admin/set-role' },
    { routePath: '/api/jitsi-token', method: 'POST', path: '/api/jitsi-token' },
    { routePath: '/api/transcription/upload', method: 'POST', path: '/api/transcription/upload' },
    { routePath: '/api/transcription/outline', method: 'POST', path: '/api/transcription/outline' },
    { routePath: '/api/transcription/restore', method: 'POST', path: '/api/transcription/restore' },
    { routePath: '/api/transcription/delete', method: 'POST', path: '/api/transcription/delete' },
    { routePath: '/api/transcription/create-table', method: 'POST', path: '/api/transcription/create-table' },
    { routePath: '/api/transcription/test-ai', method: 'POST', path: '/api/transcription/test-ai' },
    { routePath: '/api/transcription/:lang{zh-TW|en|ja}', method: 'POST', path: '/api/transcription/zh-TW' },
    { routePath: '/api/admin/civic-talks/issues/:id', method: 'PUT', path: '/api/admin/civic-talks/issues/1' },
    { routePath: '/api/admin/civic-talks/issues/:id', method: 'DELETE', path: '/api/admin/civic-talks/issues/1' },
    { routePath: '/api/admin/civic-talks/materials/:id', method: 'DELETE', path: '/api/admin/civic-talks/materials/1' },
    { routePath: '/api/admin/civic-talks/opinions/:id', method: 'DELETE', path: '/api/admin/civic-talks/opinions/1' },
    { routePath: '/api/admin/civic-talks/abuse-reports/:id/resolve', method: 'PATCH', path: '/api/admin/civic-talks/abuse-reports/1/resolve' },
    { routePath: '/api/meeting/:date/transcript', method: 'POST', path: '/api/meeting/20260803/transcript' },
    { routePath: '/api/meeting/:date/transcript/:ts', method: 'DELETE', path: '/api/meeting/20260803/transcript/1' },
    { routePath: '/api/meeting/:date', method: 'PATCH', path: '/api/meeting/20260803' },
  ] as const

  it('測試案例完整涵蓋目前註冊的所有寫入路由', () => {
    const registered = app.routes
      .filter(route => route.method !== 'ALL' && !['GET', 'HEAD', 'OPTIONS'].includes(route.method))
      .map(route => `${route.method} ${route.path}`)
      .sort()
    const covered = WRITE_ENDPOINTS.map(route => `${route.method} ${route.routePath}`).sort()
    expect(covered).toEqual(registered)
  })

  for (const { method, path } of WRITE_ENDPOINTS) {
    it(`${method} ${path} 不回 Access-Control-Allow-Origin`, async () => {
      const res = await app.request(`https://vtaiwan.tw${path}`, {
        method,
        headers: { origin: 'https://vtaiwan.tw', 'sec-fetch-site': 'same-origin', 'content-type': 'multipart/form-data; boundary=x' },
        body: '--x--',
      })
      // 先確認真的打到端點——404 會讓下面那條斷言變成恆真
      expect(res.status).not.toBe(404)
      expect(res.headers.get('access-control-allow-origin')).toBeNull()
    })
  }

  // 上面驗的是「實際請求」；preflight 要另外驗。兩者會走到不同的 handler：
  // 寫入端點的 POST/PUT/... handler 註冊在 corsFor 之前，handler 先回應就結束 chain，
  // 因此就算後面誤掛了 corsFor，實際請求也照樣不帶 CORS 標頭——只有沒有對應 handler 的
  // OPTIONS 會落到那個 middleware 身上並回出放行標頭。Hono >= 4.13.0 起 csrf 把 OPTIONS
  // 視為安全方法，不再替我們攔下 preflight，這條就是唯一的把關。
  // 期望值是 404（沒有任何 middleware／handler 接手），瀏覽器因此完不成跨來源寫入。
  for (const { method, path } of WRITE_ENDPOINTS) {
    it(`OPTIONS ${path}（${method} 的 preflight）不回 CORS 放行標頭`, async () => {
      const res = await app.request(`https://next.vtaiwan.tw${path}`, {
        method: 'OPTIONS',
        headers: { origin: 'https://vtaiwan.tw', 'access-control-request-method': method, 'access-control-request-headers': 'content-type' },
      })
      expect(res.headers.get('access-control-allow-origin')).toBeNull()
      expect(res.headers.get('access-control-allow-methods')).toBeNull()
    })
  }

  // 管理員專屬的讀取端點比照 /api/admin/audit-log：連 corsFor 都不掛，跨來源根本讀不到。
  // 舊版本可能含後續被修正／下架的內容，不該隨公開逐字稿一起露出。
  for (const path of ['/api/transcription/20260803/versions', '/api/transcription/20260803/versions/20260803T000000000Z/text']) {
    it(`${path} 不對外宣告 CORS（管理員專屬）`, async () => {
      const res = await app.request(`https://next.vtaiwan.tw${path}`, {
        headers: { origin: 'https://vtaiwan.tw', 'sec-fetch-site': 'cross-site' },
      })
      expect(res.headers.get('access-control-allow-origin')).toBeNull()
    })
  }

  // 對照組：公開讀取的 GET 端點才該掛 corsFor，那裡的 CORS 是真的會生效的。
  it('公開讀取的 GET 端點仍對白名單來源宣告 CORS', async () => {
    const res = await app.request('https://next.vtaiwan.tw/api/transcription/20260803/text', {
      headers: { origin: 'https://vtaiwan.tw', 'sec-fetch-site': 'cross-site' },
    })
    expect(res.headers.get('access-control-allow-origin')).toBe('https://vtaiwan.tw')
  })
})
