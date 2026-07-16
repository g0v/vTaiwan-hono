// NavBar 導覽連結——NavBar.vue 的 links 陣列單一來源
// 欄位對應 NavBar.vue 模板：l.key / l.href / l.labelKey
export const navLinks = [
  { key: 'home', labelKey: 'header.home', href: '/' },
  { key: 'topics', labelKey: 'header.topics', href: '/topics' },
  { key: 'meetups', labelKey: 'header.meetups', href: '/meetups' },
  { key: 'blogs', labelKey: 'header.blogs', href: '/blogs' },
  { key: 'newsletters', labelKey: 'header.newsletters', href: '/newsletters' },
  { key: 'mastodon', labelKey: 'header.mastodon', href: '/mastodon' },
  { key: 'faq', labelKey: 'header.faq', href: '/faq' },
  { key: 'about', labelKey: 'header.about', href: '/intro' },
  { key: 'contributors', labelKey: 'header.contributors', href: '/contributors' },
] as const

// ── Footer 型別 ────────────────────────────────────────────────────────────────

// 外部連結（純 href，label 為固定字串）
export type FooterExternalItem = { label: string; href: string; labelKey?: never; to?: never }
// 站內連結（router-link to，label 由 i18n key 提供）
export type FooterInternalItem = { labelKey: string; to: string; label?: never; href?: never }
// 法務連結（一律有 labelKey，href 或 to 二擇一）
export type FooterLegalExternalItem = { labelKey: string; href: string; to?: never }
export type FooterLegalInternalItem = { labelKey: string; to: string; href?: never }

export type FooterContactItem = FooterExternalItem | FooterInternalItem
export type FooterLegalItem = FooterLegalExternalItem | FooterLegalInternalItem

// ── Footer 聯絡區塊——Footer.vue contact 陣列單一來源 ──────────────────────────
export const contact: FooterContactItem[] = [
  { label: 'info@vtaiwan.tw', href: 'mailto:info@vtaiwan.tw' },
  { labelKey: 'footer.joinNextMeeting', to: '/meetups' },
  { labelKey: 'footer.proposeTopic', to: '/topics' },
]

// ── Footer 法務連結——Footer.vue legal 陣列單一來源 ────────────────────────────
export const legal: FooterLegalItem[] = [
  { labelKey: 'footer.sourceCode', href: 'https://github.com/g0v/vTaiwan-hono' },
  { labelKey: 'footer.privacyPolicy', to: '/privacy' },
  { labelKey: 'footer.termsOfService', to: '/terms' },
]

// ── 衍生：Footer 所有站內連結（有 to 欄位的項目）────────────────────────────
// 測試用；不是 copy，直接從 contact / legal 篩出，保持單一來源。
type InternalLink = { labelKey: string; to: string }

function hasTo(item: FooterContactItem | FooterLegalItem): item is InternalLink {
  return 'to' in item && typeof (item as InternalLink).to === 'string'
}

export const footerInternalLinks: InternalLink[] = ([...contact, ...legal] as (FooterContactItem | FooterLegalItem)[]).filter(hasTo)
