import { describe, expect, it, vi } from 'vite-plus/test'
import { copyTextToClipboard } from '../lib/clipboard'

function createLegacyBrowser(copyResult: boolean) {
  const textArea = {
    value: '',
    style: {},
    setAttribute: vi.fn(),
    select: vi.fn(),
    setSelectionRange: vi.fn(),
  }
  const appendChild = vi.fn()
  const removeChild = vi.fn()
  const execCommand = vi.fn(() => copyResult)

  return {
    browser: {
      document: {
        createElement: vi.fn(() => textArea),
        body: { appendChild, removeChild },
        execCommand,
      },
    } as unknown as NonNullable<Parameters<typeof copyTextToClipboard>[1]>,
    textArea,
    appendChild,
    removeChild,
    execCommand,
  }
}

describe('跨平台文字複製', () => {
  it('優先使用 Clipboard API', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)

    await expect(copyTextToClipboard('https://example.test/topic', { clipboard: { writeText } })).resolves.toBe(true)
    expect(writeText).toHaveBeenCalledWith('https://example.test/topic')
  })

  it('Clipboard API 不可用時以舊式複製方式降級', async () => {
    const { browser, textArea, appendChild, removeChild, execCommand } = createLegacyBrowser(true)

    await expect(copyTextToClipboard('https://example.test/topic', browser)).resolves.toBe(true)
    expect(textArea.value).toBe('https://example.test/topic')
    expect(appendChild).toHaveBeenCalledWith(textArea)
    expect(execCommand).toHaveBeenCalledWith('copy')
    expect(removeChild).toHaveBeenCalledWith(textArea)
  })

  it('Clipboard API 失敗時仍嘗試舊式複製方式', async () => {
    const writeText = vi.fn().mockRejectedValue(new Error('clipboard denied'))
    const { browser, execCommand } = createLegacyBrowser(true)

    await expect(copyTextToClipboard('https://example.test/topic', { ...browser, clipboard: { writeText } })).resolves.toBe(true)
    expect(execCommand).toHaveBeenCalledWith('copy')
  })

  it('沒有可用複製方式時回傳失敗', async () => {
    await expect(copyTextToClipboard('https://example.test/topic', {})).resolves.toBe(false)
  })
})
