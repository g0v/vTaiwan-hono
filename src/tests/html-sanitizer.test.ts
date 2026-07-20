import { describe, expect, it } from 'vite-plus/test'
import { sanitizeEmbedHtml, sanitizeUntrustedHtml, stripHtmlFromMarkdown } from '../lib/html-sanitizer'

describe('HTML 清洗', () => {
  it('移除 script、事件屬性與危險 URL，同時保留安全的 Markdown HTML', () => {
    const result = sanitizeUntrustedHtml(
      '<script>alert(1)</script><img src="https://example.com/image.png" onerror="alert(1)"><a href="javascript:alert(1)">連結</a><table><tr><td>內容</td></tr></table>'
    )

    expect(result).not.toContain('<script')
    expect(result).not.toContain('onerror')
    expect(result).not.toContain('javascript:')
    expect(result).toContain('<table>')
    expect(result).toContain('<td>內容</td>')
  })

  it('只保留 allowlist 中的 iframe 主機', () => {
    const result = sanitizeEmbedHtml('<iframe src="https://docs.google.com/presentation/d/demo/embed"></iframe><iframe src="https://attacker.example/embed"></iframe>', ['docs.google.com'])

    expect(result).toContain('docs.google.com')
    expect(result).not.toContain('attacker.example')
  })

  it('阻擋編碼、控制字元與 protocol-relative URL', () => {
    const result = sanitizeUntrustedHtml('<a href="jav&#x61;script:alert(1)">編碼</a><a href="java&#10;script:alert(1)">換行</a><img src="//attacker.example/image.png"><a href="/safe">安全</a>')

    expect(result).not.toContain('javascript:')
    expect(result).not.toContain('attacker.example')
    expect(result).toContain('href="/safe"')
  })

  it('不接受 allowlist 主機的相似網域，並完整丟棄 script 內容', () => {
    const result = sanitizeEmbedHtml('<script><p>惡意內容</p></script><iframe src="https://docs.google.com.attacker.example/embed"></iframe>', ['docs.google.com'])

    expect(result).not.toContain('惡意內容')
    expect(result).not.toContain('attacker.example')
  })

  it('在保存 Markdown 前將原始 HTML 編碼為文字', () => {
    const result = stripHtmlFromMarkdown('## 標題\n<script>alert(1)</script>\n<img src=x onerror=alert(1)>')

    expect(result).toContain('## 標題')
    expect(result).not.toContain('<script')
    expect(result).not.toContain('<img')
    expect(result).toContain('&lt;script&gt;alert(1)&lt;/script&gt;')
  })
})
