import { describe, expect, it } from 'vite-plus/test'
import app, { contentSecurityPolicyFor } from '../index'

function directiveSources(policy: string, directive: string): string[] {
  const value = policy
    .split(';')
    .map(part => part.trim())
    .find(part => part.startsWith(`${directive} `))

  return value?.split(/\s+/).slice(1) ?? []
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
    expect(styleSources).toContain("'unsafe-inline'")
    expect(connectSources).toContain('https://*.google-analytics.com')
    expect(connectSources).toContain('https://*.firebaseio.com')
    expect(connectSources).toContain('wss://*.firebaseio.com')
    expect(frameSources).toContain('https://*.firebaseapp.com')
  })

  it('正式環境的 CSP 禁止內嵌樣式', () => {
    const styleSources = directiveSources(contentSecurityPolicyFor(true), 'style-src')

    expect(styleSources).not.toContain("'unsafe-inline'")
  })
})
