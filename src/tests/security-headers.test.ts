import { describe, expect, it } from 'vite-plus/test'
import app from '../index'

function directiveSources(policy: string, directive: string): string[] {
  const value = policy
    .split(';')
    .map(part => part.trim())
    .find(part => part.startsWith(`${directive} `))

  return value?.split(/\s+/).slice(1) ?? []
}

function styleNonce(policy: string): string | undefined {
  const source = directiveSources(policy, 'style-src').find(value => value.startsWith("'nonce-") && value.endsWith("'"))
  return source?.slice(7, -1)
}

describe('安全標頭', () => {
  it('CSP 允許 GA 與 Firebase 實際使用的瀏覽器端來源', async () => {
    const response = await app.request('/api/hello')
    const policy = response.headers.get('Content-Security-Policy')

    expect(policy).not.toBeNull()
    const scriptSources = directiveSources(policy!, 'script-src')
    const styleSources = directiveSources(policy!, 'style-src')
    const connectSources = directiveSources(policy!, 'connect-src')
    const frameSources = directiveSources(policy!, 'frame-src')

    expect(scriptSources).toContain('https://www.googletagmanager.com')
    expect(scriptSources).toContain('https://apis.google.com')
    expect(scriptSources).toContain('https://*.firebaseio.com')
    expect(scriptSources).toContain("'sha256-3bzWVxQE32IZQKH9eh8KzyHuhXOlMrboDVVBRd0fWTU='")
    expect(scriptSources).not.toContain("'unsafe-inline'")
    expect(styleSources).not.toContain("'unsafe-inline'")
    expect(styleNonce(policy!)).toBeTruthy()
    expect(connectSources).toContain('https://*.google-analytics.com')
    expect(connectSources).toContain('https://*.firebaseio.com')
    expect(connectSources).toContain('wss://*.firebaseio.com')
    expect(frameSources).toContain('https://*.firebaseapp.com')
  })

  it('每次 SSR 請求以不同 nonce 放行 Vite 注入的樣式', async () => {
    const firstResponse = await app.request('/')
    const secondResponse = await app.request('/')
    const firstPolicy = firstResponse.headers.get('Content-Security-Policy')
    const secondPolicy = secondResponse.headers.get('Content-Security-Policy')

    expect(firstPolicy).not.toBeNull()
    expect(secondPolicy).not.toBeNull()

    const firstNonce = styleNonce(firstPolicy!)
    const secondNonce = styleNonce(secondPolicy!)
    const firstHtml = await firstResponse.text()
    const secondHtml = await secondResponse.text()

    expect(firstNonce).toBeTruthy()
    expect(secondNonce).toBeTruthy()
    expect(firstNonce).not.toBe(secondNonce)
    expect(firstHtml).toContain(`<meta property="csp-nonce" nonce="${firstNonce}" />`)
    expect(secondHtml).toContain(`<meta property="csp-nonce" nonce="${secondNonce}" />`)
  })
})
