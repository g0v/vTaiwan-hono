import { Parser } from 'htmlparser2'

const allowedTags = new Set([
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
])

const allowedAttributes: Record<string, ReadonlySet<string>> = {
  a: new Set(['href', 'title']),
  abbr: new Set(['title']),
  img: new Set(['src', 'alt', 'title', 'width', 'height', 'loading']),
  ol: new Set(['start']),
  td: new Set(['colspan', 'rowspan']),
  th: new Set(['colspan', 'rowspan', 'scope']),
}

const iframeAttributes = new Set(['src', 'width', 'height', 'title', 'allowfullscreen', 'loading', 'referrerpolicy', 'sandbox'])
const voidTags = new Set(['br', 'hr', 'img'])
const discardedTags = new Set(['script', 'style'])
const linkSchemes = new Set(['http', 'https', 'mailto'])
const mediaSchemes = new Set(['https'])

function escapeText(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function escapeAttribute(value: string): string {
  return escapeText(value).replace(/"/g, '&quot;')
}

function safeUrl(value: string, allowedSchemes: ReadonlySet<string>): string | undefined {
  const normalized = Array.from(value)
    .filter(character => {
      const codePoint = character.codePointAt(0) ?? 0
      return codePoint > 0x20 && (codePoint < 0x7f || codePoint > 0x9f)
    })
    .join('')
  if (normalized.replace(/\\/g, '/').startsWith('//')) return undefined

  const scheme = normalized.match(/^([a-z][a-z\d+.-]*):/i)?.[1]?.toLowerCase()
  return scheme === undefined || allowedSchemes.has(scheme) ? normalized : undefined
}

function safeIframeUrl(value: string, allowedHostnames: ReadonlySet<string>): string | undefined {
  const safe = safeUrl(value, mediaSchemes)
  if (!safe) return undefined

  try {
    const url = new URL(safe)
    return url.protocol === 'https:' && allowedHostnames.has(url.hostname) ? safe : undefined
  } catch {
    return undefined
  }
}

interface SanitizeOptions {
  allowIframe: boolean
  allowedIframeHostnames: ReadonlySet<string>
}

function sanitize(value: string, options: SanitizeOptions): string {
  let output = ''
  let discardedDepth = 0
  const emittedTags: { name: string; emitted: boolean }[] = []

  const parser = new Parser(
    {
      onopentag(name, attributes) {
        if (discardedDepth > 0) {
          discardedDepth += 1
          return
        }
        if (discardedTags.has(name)) {
          discardedDepth = 1
          return
        }

        const iframeSrc = name === 'iframe' && attributes.src ? safeIframeUrl(attributes.src, options.allowedIframeHostnames) : undefined
        const isAllowed = allowedTags.has(name) || (options.allowIframe && name === 'iframe' && iframeSrc !== undefined)
        emittedTags.push({ name, emitted: isAllowed })
        if (!isAllowed) return

        const attributeAllowlist = name === 'iframe' ? iframeAttributes : allowedAttributes[name]
        const serializedAttributes: string[] = []
        for (const [attributeName, rawValue] of Object.entries(attributes)) {
          if (!attributeAllowlist?.has(attributeName)) continue

          let attributeValue: string | undefined = rawValue
          if (name === 'a' && attributeName === 'href') attributeValue = safeUrl(rawValue, linkSchemes)
          if (name === 'img' && attributeName === 'src') attributeValue = safeUrl(rawValue, mediaSchemes)
          if (name === 'iframe' && attributeName === 'src') attributeValue = iframeSrc
          if (attributeValue !== undefined) serializedAttributes.push(`${attributeName}="${escapeAttribute(attributeValue)}"`)
        }

        if (name === 'a') serializedAttributes.push('target="_blank"', 'rel="noopener noreferrer"')
        output += `<${name}${serializedAttributes.length > 0 ? ` ${serializedAttributes.join(' ')}` : ''}>`
      },
      ontext(text) {
        if (discardedDepth === 0) output += escapeText(text)
      },
      onclosetag(name) {
        if (discardedDepth > 0) {
          discardedDepth -= 1
          return
        }

        const tag = emittedTags.pop()
        if (tag?.emitted && tag.name === name && !voidTags.has(name)) output += `</${name}>`
      },
    },
    { decodeEntities: true, lowerCaseAttributeNames: true, lowerCaseTags: true, recognizeSelfClosing: true }
  )

  parser.end(value)
  return output
}

/**
 * 清洗要透過 v-html 呈現的非信任 HTML。
 * 不允許 style、事件屬性、SVG、script、data: URL 或 protocol-relative URL。
 */
export function sanitizeUntrustedHtml(value: string): string {
  return sanitize(value, { allowIframe: false, allowedIframeHostnames: new Set() })
}

/**
 * 僅限受信任的嵌入服務使用；iframe 仍會受限於明確的主機 allowlist。
 */
export function sanitizeEmbedHtml(value: string, allowedIframeHostnames: string[]): string {
  return sanitize(value, { allowIframe: true, allowedIframeHostnames: new Set(allowedIframeHostnames) })
}

/**
 * 大綱以 Markdown 保存時，將其中的原始 HTML 編碼為文字。
 * Markdown 連結等語法仍保留，並會在輸出 HTML 時再次清洗。
 */
export function stripHtmlFromMarkdown(value: string): string {
  return value.replace(/</g, '&lt;').replace(/>/g, '&gt;')
}
