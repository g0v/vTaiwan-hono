import { describe, it, expect } from 'vite-plus/test'
import { createRouter, createMemoryHistory } from 'vue-router'
import { routes } from '#routes-runtime'
import { navLinks, footerInternalLinks } from '../router/nav-links'

// 使用真實路由表建立 router——router.resolve() 才能正確判斷 dynamic segment
const router = createRouter({ history: createMemoryHistory(), routes })

// 通過條件：resolved.name !== "not-found"
// 說明：
//   - /meetups 是 placeholderPath（status 404）但 name="placeholder-meetups"，故不是死連結。
//   - 不用 meta.status===200，那會誤殺 placeholder。
//   - 不用字串比對，那會漏掉 /word/:w 等 dynamic routes。
function isLive(path: string): boolean {
  return router.resolve(path).name !== 'not-found'
}

describe('NavBar 連結', () => {
  for (const link of navLinks) {
    it(`${link.key}: "${link.href}" 解析到已定義的 route`, () => {
      expect(isLive(link.href)).toBe(true)
    })
  }
})

describe('Footer 站內連結', () => {
  for (const link of footerInternalLinks) {
    it(`${link.labelKey}: "${link.to}" 解析到已定義的 route`, () => {
      expect(isLive(link.to)).toBe(true)
    })
  }
})

describe('跨頁連結覆蓋範圍', () => {
  it('NavBar 涵蓋所有主要內容頁', () => {
    const hrefs = navLinks.map(l => l.href)
    for (const path of ['/', '/topics', '/blogs', '/newsletters', '/mastodon', '/faq', '/intro', '/contributors']) {
      expect(hrefs).toContain(path)
    }
  })

  it('Footer 涵蓋兩個法務頁', () => {
    const tos = footerInternalLinks.map(l => l.to)
    expect(tos).toContain('/privacy')
    expect(tos).toContain('/terms')
  })
})
