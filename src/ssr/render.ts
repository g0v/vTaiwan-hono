import { renderToString } from '@vue/server-renderer'
import type { ContentfulStatusCode } from 'hono/utils/http-status'
import { createVueApp } from '../app'
import { headForRoute, statusForRoute } from '../router/routes'
import { renderHeadTags, type HeadConfig } from './heads'

export interface RenderPageResult {
  html: string
  status: ContentfulStatusCode
}

const buildId = import.meta.env.VITE_BUILD_ID
const clientEntry = import.meta.env.PROD ? `/js/app.js?v=${buildId}` : '/src/client/app-entry.ts'
const appStyle = import.meta.env.PROD ? `/styles.css?v=${buildId}` : '/styles.css'
const clientStyle = import.meta.env.PROD ? `    <link rel="stylesheet" href="/js/app.css?v=${buildId}" />\n` : ''

// 用 vue-router 比對目前 URL，SSR 第一個畫面，再讓瀏覽器端 hydration 接管後續路由。
export async function renderPage(url: string, origin: string, cspNonce: string): Promise<RenderPageResult> {
  const { app, router, i18n } = createVueApp(url)
  await router.isReady()
  const route = router.currentRoute.value
  const head: HeadConfig = headForRoute(route, origin, key => i18n.global.t(key))
  const status = statusForRoute(route) as ContentfulStatusCode
  const bodyHtml = await renderToString(app)
  const headTags = renderHeadTags(head)

  return {
    status,
    html: `<!doctype html>
<html lang="zh-Hant">
  <head>
    <meta property="csp-nonce" nonce="${cspNonce}" />
    ${headTags}
    <link rel="apple-touch-icon" sizes="180x180" href="/img/apple-touch-icon.png" />
    <link rel="icon" type="image/png" sizes="32x32" href="/img/favicon-32x32.png" />
    <link rel="icon" type="image/png" sizes="16x16" href="/img/favicon-16x16.png" />
    <link rel="manifest" href="/manifest.json" />
    <link rel="mask-icon" href="/img/safari-pinned-tab.svg" color="#5bbad5" />
    <meta name="msapplication-TileColor" content="#da532c" />
    <meta name="theme-color" content="#ffffff" />
    <link rel="shortcut icon" href="/favicon.ico" type="image/x-icon" />
    <link rel="stylesheet" href="${appStyle}" />
${clientStyle}
  </head>
  <body>
    <div id="app">${bodyHtml}</div>
    <script type="module" src="${clientEntry}"></script>
  </body>
</html>`,
  }
}
