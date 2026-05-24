import { renderToString } from '@vue/server-renderer'
import type { ContentfulStatusCode } from 'hono/utils/http-status'
import { createVueApp } from '../app'
import { headForRoute, statusForRoute } from '../router/routes'
import { renderHeadTags, type HeadConfig } from './heads'

export interface RenderPageResult {
  html: string
  status: ContentfulStatusCode
}

const clientEntry = import.meta.env.PROD
  ? '/js/app.js'
  : '/src/client/app-entry.ts'
const clientStyle = import.meta.env.PROD
  ? '    <link rel="stylesheet" href="/js/app.css" />\n'
  : ''

// 用 vue-router 比對目前 URL，SSR 第一個畫面，再讓瀏覽器端 hydration 接管後續路由。
export async function renderPage(url: string, origin: string): Promise<RenderPageResult> {
  const { app, router } = createVueApp(url)
  await router.isReady()
  const route = router.currentRoute.value
  const head: HeadConfig = headForRoute(route, origin)
  const status = statusForRoute(route) as ContentfulStatusCode
  const bodyHtml = await renderToString(app)
  const headTags = renderHeadTags(head)

  return {
    status,
    html: `<!doctype html>
<html lang="zh-Hant">
  <head>
    ${headTags}
    <link rel="icon" href="/favicon.ico" type="image/x-icon" />
    <link rel="stylesheet" href="/styles.css" />
${clientStyle}
  </head>
  <body>
    <div id="app">${bodyHtml}</div>
    <script type="module" src="${clientEntry}"></script>
  </body>
</html>`,
  }
}
