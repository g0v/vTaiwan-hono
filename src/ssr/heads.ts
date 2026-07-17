// <meta> 兩種寫法：name="..."（一般 SEO）與 property="..."（OG 系列）
export type MetaEntry = { name: string; content: string } | { property: string; content: string }

// 每條路由產出的 head 設定，會交給 renderHeadTags() 轉成 HTML
export interface HeadConfig {
  title: string
  description?: string
  meta?: MetaEntry[]
}

const SITE_NAME = 'vTaiwan'
type Translate = (key: string) => string

// 預設 OG 圖片
const DEFAULT_OG_IMAGE = `https://vtaiwan-hono.vtaiwan-tw-349.workers.dev/img/og-image.png`

// 統一產 OG / Twitter Card meta，避免每條路由都自己寫一次
function buildOg(title: string, description: string, image: string, url: string): MetaEntry[] {
  //@ verify
  //@ requires title.length > 0
  //@ requires url.length > 0
  //@ ensures \result.length === 10
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

export function headForHome(origin: string, t: Translate): HeadConfig {
  const title = t('head.home.title')
  const description = t('head.home.description')
  return {
    title,
    description,
    // DEFAULT_OG_IMAGE 已是完整網址，不需再拼 origin
    meta: buildOg(title, description, DEFAULT_OG_IMAGE, `${origin}/`),
  }
}

export function headForAbout(origin: string, t: Translate): HeadConfig {
  const title = t('head.about.title') + ' - ' + SITE_NAME
  const description = t('head.about.description')
  return {
    title,
    description,
    meta: buildOg(title, description, DEFAULT_OG_IMAGE, `${origin}/about`),
  }
}

export function headForWord(word: string, origin: string, t: Translate): HeadConfig {
  const title = t('head.word.title').replace('{word}', word) + ' - ' + SITE_NAME
  const description = t('head.word.description').replace('{word}', word)

  // 使用 moedict.tw 的 API 來取得字圖
  const ogImage = `https://www.moedict.tw/${encodeURIComponent(word)}.png`
  return {
    title,
    description,
    meta: buildOg(title, description, ogImage, `${origin}/word/${encodeURIComponent(word)}`),
  }
}

export function headForHundredChart(origin: string, t: Translate): HeadConfig {
  const title = t('head.hundred.title') + ' - ' + SITE_NAME
  const description = t('head.hundred.description')
  return {
    title,
    description,
    meta: buildOg(title, description, DEFAULT_OG_IMAGE, `${origin}/hundred`),
  }
}

export function headForPrivacy(origin: string, t: Translate): HeadConfig {
  const title = t('head.privacy.title') + ' - ' + SITE_NAME
  const description = t('head.privacy.description')
  return {
    title,
    description,
    meta: buildOg(title, description, DEFAULT_OG_IMAGE, `${origin}/privacy`),
  }
}

export function headForTerms(origin: string, t: Translate): HeadConfig {
  const title = t('head.terms.title') + ' - ' + SITE_NAME
  const description = t('head.terms.description')
  return {
    title,
    description,
    meta: buildOg(title, description, DEFAULT_OG_IMAGE, `${origin}/terms`),
  }
}

export function headForTopics(origin: string, t: Translate): HeadConfig {
  const title = t('head.topics.title') + ' - ' + SITE_NAME
  const description = t('head.topics.description')
  return {
    title,
    description,
    meta: buildOg(title, description, DEFAULT_OG_IMAGE, `${origin}/topics`),
  }
}

export function headForTopicDetail(origin: string, routeName: string, t: Translate): HeadConfig {
  const title = (routeName ? t('head.topicDetail.withNameTitle').replace('{name}', routeName) : t('head.topicDetail.title')) + ' - ' + SITE_NAME
  const description = t('head.topicDetail.description')
  const path = routeName ? `/topic/${encodeURIComponent(routeName)}` : '/topics'
  return {
    title,
    description,
    meta: buildOg(title, description, DEFAULT_OG_IMAGE, `${origin}${path}`),
  }
}

export function headForPolis(origin: string, t: Translate): HeadConfig {
  const title = t('head.polis.title') + ' - ' + SITE_NAME
  const description = t('head.polis.description')
  return {
    title,
    description,
    meta: buildOg(title, description, DEFAULT_OG_IMAGE, `${origin}/polis`),
  }
}

export function headForProfile(origin: string, t: Translate): HeadConfig {
  const title = t('head.profile.title') + ' - ' + SITE_NAME
  const description = t('head.profile.description')
  return {
    title,
    description,
    meta: buildOg(title, description, DEFAULT_OG_IMAGE, `${origin}/profile`),
  }
}

export function headForBlogs(origin: string, t: Translate): HeadConfig {
  const title = t('head.blogs.title') + ' - ' + SITE_NAME
  const description = t('head.blogs.description')
  return {
    title,
    description,
    meta: buildOg(title, description, DEFAULT_OG_IMAGE, `${origin}/blogs`),
  }
}

export function headForMastodon(origin: string, t: Translate): HeadConfig {
  const title = t('head.mastodon.title') + ' - ' + SITE_NAME
  const description = t('head.mastodon.description')
  return {
    title,
    description,
    meta: buildOg(title, description, DEFAULT_OG_IMAGE, `${origin}/mastodon`),
  }
}

export function headForContributors(origin: string, t: Translate): HeadConfig {
  const title = t('head.contributors.title') + ' - ' + SITE_NAME
  const description = t('head.contributors.description')
  return {
    title,
    description,
    meta: buildOg(title, description, DEFAULT_OG_IMAGE, `${origin}/contributors`),
  }
}

export function headForFaq(origin: string, t: Translate): HeadConfig {
  const title = t('head.faq.title') + ' - ' + SITE_NAME
  const description = t('head.faq.description')
  return {
    title,
    description,
    meta: buildOg(title, description, DEFAULT_OG_IMAGE, `${origin}/faq`),
  }
}

export function headForNewsletters(origin: string, t: Translate): HeadConfig {
  const title = t('head.newsletters.title') + ' - ' + SITE_NAME
  const description = t('head.newsletters.description')
  return {
    title,
    description,
    meta: buildOg(title, description, DEFAULT_OG_IMAGE, `${origin}/newsletters`),
  }
}

export function headForNewsletterDetail(origin: string, slug: string, t: Translate): HeadConfig {
  const title = t('head.newsletterDetail.title') + ' - ' + SITE_NAME
  const description = t('head.newsletterDetail.description')
  return {
    title,
    description,
    meta: buildOg(title, description, DEFAULT_OG_IMAGE, `${origin}/newsletters/${slug}`),
  }
}

export function headForMeetups(origin: string, t: Translate): HeadConfig {
  const title = t('head.meetups.title') + ' - ' + SITE_NAME
  const description = t('head.meetups.description')
  return {
    title,
    description,
    meta: buildOg(title, description, DEFAULT_OG_IMAGE, `${origin}/meetups`),
  }
}

export function headForTranscriptions(origin: string, t: Translate): HeadConfig {
  const title = t('head.transcriptions.title') + ' - ' + SITE_NAME
  const description = t('head.transcriptions.description')
  return {
    title,
    description,
    meta: buildOg(title, description, DEFAULT_OG_IMAGE, `${origin}/transcriptions`),
  }
}

export function headForTranscriptionDetail(origin: string, t: Translate): HeadConfig {
  const title = t('head.transcriptionDetail.title') + ' - ' + SITE_NAME
  const description = t('head.transcriptionDetail.description')
  return {
    title,
    description,
    meta: buildOg(title, description, DEFAULT_OG_IMAGE, `${origin}/transcriptions`),
  }
}

export function headForJitsi(origin: string, t: Translate): HeadConfig {
  const title = t('head.jitsi.title') + ' - ' + SITE_NAME
  const description = t('head.jitsi.description')
  return {
    title,
    description,
    meta: buildOg(title, description, DEFAULT_OG_IMAGE, `${origin}/jitsi`),
  }
}
export function headForContact(origin: string, t: Translate): HeadConfig {
  const title = t('head.contact.title') + ' - ' + SITE_NAME
  const description = t('head.contact.description')
  return {
    title,
    description,
    meta: buildOg(title, description, DEFAULT_OG_IMAGE, `${origin}/contact`),
  }
}

export function headForPropose(origin: string, t: Translate): HeadConfig {
  const title = t('head.propose.title') + ' - ' + SITE_NAME
  const description = t('head.propose.description')
  return {
    title,
    description,
    meta: buildOg(title, description, DEFAULT_OG_IMAGE, `${origin}/propose`),
  }
}

export function headForNotFound(origin: string, t: Translate): HeadConfig {
  const title = t('head.notFound.title') + ' - ' + SITE_NAME
  const description = t('head.notFound.description')
  return {
    title,
    description,
    meta: buildOg(title, description, DEFAULT_OG_IMAGE, `${origin}/404`),
  }
}

// 契約：輸出不含 < > " '（皆轉為 entity）。
// （regex 不可建模；改寫成 split/join 後「不含 <」的 ensures 也需手寫 Dafny lemma 才能證，故不做 LemmaScript 標注）
function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')
}

// 把 HeadConfig 轉成可以塞進 <head> 的 HTML 字串
export function renderHeadTags(head: HeadConfig): string {
  const parts: string[] = ['<meta charset="UTF-8" />', '<meta name="viewport" content="width=device-width, initial-scale=1.0" />', `<title>${escapeHtml(head.title)}</title>`]
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
