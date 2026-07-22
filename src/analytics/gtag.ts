// Google Analytics (GA4) 串接——與原站 vue.vTaiwan-neo 相同的量測 ID。
//
// 硬性規定：本模組只在瀏覽器端執行。SSR 期間（Worker）不得載入 gtag，
// 也不在 SSR HTML 內嵌 <script>（維持 index.ts 的 `script-src 'self'` 防禦縱深）。
// gtag.js 由 client bundle（script-src 'self'）動態注入，仍受 CSP 約束，
// 因此 index.ts 的 CSP 已放行 googletagmanager.com / google-analytics.com。

// GA4 量測 ID 為公開值（隨 client HTML 送出，非機密），因此不需放進 Worker secret。
// 預設沿用原站 vue.vTaiwan-neo 的正式站 ID；可用 build-time 環境變數
// VITE_GA_MEASUREMENT_ID 覆寫（例如接不同的量測資源）。
const GA_MEASUREMENT_ID = import.meta.env.VITE_GA_MEASUREMENT_ID || 'G-PJ396EXSTX'

// gtag 的 inline 版本會同步定義 window.gtag（把參數 push 進 dataLayer），
// 即使 googletagmanager.com 的 async script 尚未載入也能先排隊事件。
type GtagFn = (...args: unknown[]) => void

declare global {
  interface Window {
    dataLayer?: unknown[]
    gtag?: GtagFn
  }
}

let initialized = false
// page_view 不像 document.title 具冪等性；記錄最後追蹤的路徑以避免重複計數
// （afterEach 與 isReady().then() 兩處都會呼叫 trackPageView）。
let lastTrackedPath: string | null = null

// 只在 production build 載入 GA，避免本機 dev（localhost）流量污染正式站數據。
function shouldLoad(): boolean {
  return typeof window !== 'undefined' && import.meta.env.PROD
}

// 動態注入 gtag.js 並初始化。send_page_view: false——首屏與 SPA 換頁一律由
// trackPageView 手動送出，統一走同一條去重路徑。
export function initGtag(): void {
  if (initialized || !shouldLoad()) return
  initialized = true

  window.dataLayer = window.dataLayer || []
  const gtag: GtagFn = (...args: unknown[]) => {
    window.dataLayer!.push(args)
  }
  window.gtag = gtag

  const script = document.createElement('script')
  script.async = true
  script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`
  document.head.appendChild(script)

  gtag('js', new Date())
  gtag('config', GA_MEASUREMENT_ID, { send_page_view: false })
}

// 送出一次 page_view。重複路徑（同一次首屏被兩處呼叫）會被去重。
export function trackPageView(fullPath: string): void {
  if (!shouldLoad() || !window.gtag) return
  if (fullPath === lastTrackedPath) return
  lastTrackedPath = fullPath

  window.gtag('event', 'page_view', {
    page_title: document.title,
    page_path: fullPath,
    page_location: window.location.href,
  })
}
