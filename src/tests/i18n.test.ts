import { afterEach, describe, expect, it, vi } from 'vite-plus/test'
import { createAppI18n, defaultLocale, detectPreferredLocale, isSupportedLocale, persistLocale } from '../i18n'
import de from '../l10n/de.json'
import en from '../l10n/en.json'
import { faqs } from '../data/faqs'

function messageEntries(messages: Record<string, unknown>, prefix = ''): Array<[string, string]> {
  return Object.entries(messages).flatMap(([key, value]): Array<[string, string]> => {
    // 括號路徑保留 key 的特殊字元，例如 email_doesn't_match。
    const path = `${prefix}[${JSON.stringify(key)}]`
    return typeof value === 'string' ? [[path, value]] : messageEntries(value as Record<string, unknown>, path)
  })
}

function placeholders(message: string): string[] {
  return [...message.matchAll(/\{(\w+)\}/g)].map(match => match[1]!).sort()
}

function browserPreference(language: string, saved: string | null = null) {
  vi.stubGlobal('window', {})
  vi.stubGlobal('navigator', { language })
  vi.stubGlobal('localStorage', { getItem: () => saved })
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('德文語系', () => {
  it('接受 de，拒絕未註冊的語系代碼', () => {
    expect(isSupportedLocale('de')).toBe(true)
    expect(isSupportedLocale('de-DE')).toBe(false)
    expect(isSupportedLocale('fr')).toBe(false)
    expect(isSupportedLocale(null)).toBe(false)
  })

  it.each(['de', 'de-DE', 'de-AT', 'de-CH'])('瀏覽器偏好 %s 使用德文', language => {
    browserPreference(language)
    expect(detectPreferredLocale()).toBe('de')
  })

  it('已儲存的德文優先於瀏覽器語言', () => {
    browserPreference('en-US', 'de')
    expect(detectPreferredLocale()).toBe('de')
  })

  it('已儲存的其他支援語言優先於德文瀏覽器偏好', () => {
    browserPreference('de-DE', 'ja')
    expect(detectPreferredLocale()).toBe('ja')
  })

  it('無效的儲存偏好不阻止德文瀏覽器偵測', () => {
    browserPreference('de-AT', 'invalid')
    expect(detectPreferredLocale()).toBe('de')
  })

  it('切換德文會儲存偏好並更新 HTML 語言', () => {
    const setItem = vi.fn()
    const document = { documentElement: { lang: 'zh-TW' } }
    vi.stubGlobal('window', {})
    vi.stubGlobal('localStorage', { setItem })
    vi.stubGlobal('document', document)
    persistLocale('de')
    expect(setItem).toHaveBeenCalledWith('locale', 'de')
    expect(document.documentElement.lang).toBe('de')
  })

  it('SSR 不讀取瀏覽器偏好，且不同實例不共享德文狀態', () => {
    vi.stubGlobal('window', undefined)
    expect(detectPreferredLocale()).toBe(defaultLocale)
    const german = createAppI18n('de')
    const other = createAppI18n()
    expect(german.global.t('common.cancel')).toBe('Abbrechen')
    expect(other.global.locale.value).toBe(defaultLocale)
    expect(other.global.t('common.cancel')).toBe('取消')
  })

  it('所有德文訊息保留來源插值並能渲染，不退回中文或 key', () => {
    const source = new Map(messageEntries(en))
    const i18n = createAppI18n('de')
    const errors = vi.spyOn(console, 'error')
    for (const [key, message] of messageEntries(de)) {
      expect(placeholders(message), key).toEqual(placeholders(source.get(key)!))
      expect(message, key).not.toMatch(/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/u)
      const params = Object.fromEntries(placeholders(message).map(name => [name, `test-${name}`]))
      const rendered = i18n.global.t(key, params)
      expect(rendered.trim(), key).not.toBe('')
      expect(rendered, key).not.toBe(key)
      for (const name of placeholders(message)) expect(rendered, key).toContain(`test-${name}`)
    }
    expect(errors).not.toHaveBeenCalled()
  })

  it('德文 FAQ 的問題、答案與流程步驟皆有內容', () => {
    for (const faq of faqs) {
      expect(faq.question.de.trim(), faq.id).not.toBe('')
      expect(faq.answer.de.trim(), faq.id).not.toBe('')
      if (faq.details) {
        expect(faq.details.de).toHaveLength(faq.details['zh-TW'].length)
        for (const step of faq.details.de) expect(step.trim(), faq.id).not.toBe('')
      }
    }
  })
})
