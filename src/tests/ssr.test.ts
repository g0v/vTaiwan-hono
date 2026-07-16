import { describe, it, expect } from 'vite-plus/test'
import type { RouteRecordRaw } from 'vue-router'
import { routes } from '#routes-runtime'
import { renderPage } from '../ssr/render'

// SSR 煙霧測試：對路由表每條 route 實際跑 renderPage()，取代「vp run dev 目視」的 SSR 首屏那一半。
// 涵蓋：renderToString 不丟例外（含誤觸瀏覽器 API 的 SSR 安全違規）、HTTP status 符合
// meta.status、<title> 有內容、首屏非空殼。hydration mismatch 仍需真瀏覽器，不在此測。

const origin = 'https://vtaiwan.tw'

// 動態 segment 的測試填值：新增帶參數的 route 時在此補一筆，缺漏會直接讓測試失敗提醒。
const paramSamples: Record<string, string> = {
  w: 'vtaiwan',
  id: 'sample-topic',
  slug: 'sample-newsletter',
  meeting_id: '20250621',
}

function samplePath(route: RouteRecordRaw): string {
  // catch-all route（/:pathMatch(.*)*）：用一條必然不存在的路徑測 404 殼
  if (route.path.startsWith('/:')) return '/this-page-does-not-exist'
  return route.path.replace(/:([A-Za-z_]+)/g, (_match, name: string) => {
    const value = paramSamples[name]
    if (!value) {
      throw new Error(`route "${route.path}" 的動態參數 ":${name}" 缺少測試填值，請補進 paramSamples`)
    }
    return value
  })
}

describe('SSR 煙霧測試', () => {
  for (const route of routes) {
    const path = samplePath(route)
    const expectedStatus = typeof route.meta?.['status'] === 'number' ? route.meta['status'] : 200

    it(`${String(route.name)}: renderPage("${path}") 回 ${expectedStatus} 且首屏完整`, async () => {
      const { html, status } = await renderPage(path, origin)

      expect(status).toBe(expectedStatus)
      // head 完整：title 非空
      expect(html).toMatch(/<title>[^<]*\S[^<]*<\/title>/)
      // 首屏非空殼：SSR 必須輸出實際內容，而非留給 client 全量渲染
      expect(html).toContain('<div id="app">')
      expect(html).not.toContain('<div id="app"></div>')
    })
  }
})
