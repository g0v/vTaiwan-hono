// <meta> 兩種寫法：name="..."（一般 SEO）與 property="..."（OG 系列）
export type MetaEntry =
  | { name: string; content: string }
  | { property: string; content: string }

// 每條路由產出的 head 設定，會交給 renderHeadTags() 轉成 HTML
export interface HeadConfig {
  title: string
  description?: string
  meta?: MetaEntry[]
}

const SITE_NAME = 'Hono Vue SSR Template'

// 預設的 OG 圖片是 "模板" 的字圖，來自 moedict.tw
const DEFAULT_OG_IMAGE = `https://vtaiwan-hono.audreyt.workers.dev/img/og-image.png`

// 統一產 OG / Twitter Card meta，避免每條路由都自己寫一次
function buildOg(
  title: string,
  description: string,
  image: string,
  url: string,
): MetaEntry[] {
  return [
    { property: 'og:type', content: 'website' },
    { property: 'og:site_name', content: SITE_NAME },
    { property: 'og:title', content: title },
    { property: 'og:description', content: description },
    { property: 'og:image', content: image },
    { property: 'og:url', content: url },
    { name: 'twitter:card', content: 'summary_large_image' },
    { name: 'twitter:title', content: title },
    { name: 'twitter:description', content: description },
    { name: 'twitter:image', content: image },
  ]
}

export function headForHome(origin: string): HeadConfig {
  const title = `${SITE_NAME} — Home`
  const description = 'A minimal Hono + Vue SSR template on Cloudflare Workers.'
  return {
    title,
    description,
    // DEFAULT_OG_IMAGE 已是完整網址，不需再拼 origin
    meta: buildOg(title, description, DEFAULT_OG_IMAGE, `${origin}/`),
  }
}

export function headForAbout(origin: string): HeadConfig {
  const title = `About — ${SITE_NAME}`
  const description = 'About this template: Hono + Vue + Vue SSR on Cloudflare Workers.'
  return {
    title,
    description,
    meta: buildOg(title, description, DEFAULT_OG_IMAGE, `${origin}/about`),
  }
}

export function headForWord(word: string, origin: string): HeadConfig {
  const title = `${word} — ${SITE_NAME}`
  const description = `Word page for: ${word}`

  // 使用 moedict.tw 的 API 來取得字圖
  const ogImage = `https://www.moedict.tw/${encodeURIComponent(word)}.png`
  return {
    title,
    description,
    meta: buildOg(title, description, ogImage, `${origin}/word/${encodeURIComponent(word)}`),
  }
}

export function headForHundredChart(origin: string): HeadConfig {
  const title = `百數表 Hydration — ${SITE_NAME}`
  const description =
    'Vue SSR 後由瀏覽器 hydration：v-model、v-for、:style 互動示範（倍數著色）。'
  return {
    title,
    description,
    meta: buildOg(title, description, DEFAULT_OG_IMAGE, `${origin}/hundred`),
  }
}

export function headForPrivacy(origin: string): HeadConfig {
  const title = `隱私政策 — vTaiwan`
  const description =
    'vTaiwan 隱私政策 - 我們承諾保護您的個人資料，不會將您的個人資料傳遞給第三方'
  return {
    title,
    description,
    meta: buildOg(title, description, DEFAULT_OG_IMAGE, `${origin}/privacy`),
  }
}

export function headForTerms(origin: string): HeadConfig {
  const title = `使用條款 — vTaiwan`
  const description =
    'vTaiwan 使用條款 - 使用我們的視訊和轉錄服務需要註冊帳號並同意 CC-BY-SA 授權'
  return {
    title,
    description,
    meta: buildOg(title, description, DEFAULT_OG_IMAGE, `${origin}/terms`),
  }
}

export function headForTopics(origin: string): HeadConfig {
  const title = `議題 — vTaiwan`
  const description = 'vTaiwan 的議題討論區，參與政策制定過程。'
  return {
    title,
    description,
    meta: buildOg(title, description, DEFAULT_OG_IMAGE, `${origin}/topics`),
  }
}

export function headForTopicDetail(origin: string, routeName: string): HeadConfig {
  const title = routeName ? `議題 — ${routeName} — vTaiwan` : `議題詳情 — vTaiwan`
  const description = 'vTaiwan 議題詳情頁，了解政策討論進度與參與方式。'
  const path = routeName ? `/topic/${encodeURIComponent(routeName)}` : '/topics'
  return {
    title,
    description,
    meta: buildOg(title, description, DEFAULT_OG_IMAGE, `${origin}${path}`),
  }
}

export function headForPolis(origin: string): HeadConfig {
  const title = `提案討論 — vTaiwan`
  const description = '用 Polis 一起決定下一個 Polis 該討論什麼'
  return {
    title,
    description,
    meta: buildOg(title, description, DEFAULT_OG_IMAGE, `${origin}/polis`),
  }
}

export function headForNotFound(origin: string): HeadConfig {
  const title = `404 施工中 — vTaiwan`
  const description = `此頁面目前正在施工中，敬請期待更完善的 vTaiwan 數位民主平台。`
  return {
    title,
    description,
    meta: buildOg(title, description, DEFAULT_OG_IMAGE, `${origin}/404`),
  }
}


function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

// 把 HeadConfig 轉成可以塞進 <head> 的 HTML 字串
export function renderHeadTags(head: HeadConfig): string {
  const parts: string[] = [
    '<meta charset="UTF-8" />',
    '<meta name="viewport" content="width=device-width, initial-scale=1.0" />',
    `<title>${escapeHtml(head.title)}</title>`,
  ]
  if (head.description) {
    parts.push(`<meta name="description" content="${escapeHtml(head.description)}" />`)
  }
  for (const m of head.meta ?? []) {
    if ('name' in m) {
      parts.push(`<meta name="${escapeHtml(m.name)}" content="${escapeHtml(m.content)}" />`)
    } else {
      parts.push(`<meta property="${escapeHtml(m.property)}" content="${escapeHtml(m.content)}" />`)
    }
  }
  return parts.join('\n    ')
}
