import sanitizeHtml from 'sanitize-html'

const allowedTags = [
  'a',
  'abbr',
  'b',
  'blockquote',
  'br',
  'code',
  'del',
  'details',
  'div',
  'em',
  'figcaption',
  'figure',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'hr',
  'i',
  'img',
  'li',
  'ol',
  'p',
  'pre',
  's',
  'small',
  'span',
  'strong',
  'sub',
  'summary',
  'sup',
  'table',
  'tbody',
  'td',
  'th',
  'thead',
  'tr',
  'u',
  'ul',
]

const allowedAttributes = {
  a: ['href', 'title', 'target', 'rel'],
  abbr: ['title'],
  img: ['src', 'alt', 'title', 'width', 'height', 'loading'],
  ol: ['start'],
  td: ['colspan', 'rowspan'],
  th: ['colspan', 'rowspan', 'scope'],
}

const allowedSchemes = ['http', 'https', 'mailto']

const linkTransform = sanitizeHtml.simpleTransform('a', {
  target: '_blank',
  rel: 'noopener noreferrer',
})

/**
 * 清洗要透過 v-html 呈現的非信任 HTML。
 * 不允許 style、事件屬性、SVG、script、data: URL 或 protocol-relative URL。
 */
export function sanitizeUntrustedHtml(value: string): string {
  return sanitizeHtml(value, {
    allowedTags,
    allowedAttributes,
    allowedSchemes,
    allowedSchemesByTag: { img: ['https'] },
    allowProtocolRelative: false,
    disallowedTagsMode: 'completelyDiscard',
    transformTags: { a: linkTransform },
  })
}

/**
 * 僅限受信任的嵌入服務使用；iframe 仍會受限於明確的主機 allowlist。
 */
export function sanitizeEmbedHtml(value: string, allowedIframeHostnames: string[]): string {
  return sanitizeHtml(value, {
    allowedTags: [...allowedTags, 'iframe'],
    allowedAttributes: {
      ...allowedAttributes,
      iframe: ['src', 'width', 'height', 'title', 'allowfullscreen', 'loading', 'referrerpolicy', 'sandbox'],
    },
    allowedSchemes,
    allowedSchemesByTag: { iframe: ['https'], img: ['https'] },
    allowedIframeHostnames,
    allowProtocolRelative: false,
    disallowedTagsMode: 'completelyDiscard',
    transformTags: { a: linkTransform },
  })
}

/**
 * 大綱以 Markdown 保存時，將其中的原始 HTML 編碼為文字。
 * Markdown 連結等語法仍保留，並會在輸出 HTML 時再次清洗。
 */
export function stripHtmlFromMarkdown(value: string): string {
  return value.replace(/</g, '&lt;').replace(/>/g, '&gt;')
}
