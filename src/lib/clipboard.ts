interface ClipboardBrowser {
  clipboard?: Pick<Clipboard, 'writeText'>
  document?: Pick<Document, 'body' | 'createElement' | 'execCommand'>
}

function legacyCopyText(text: string, document: NonNullable<ClipboardBrowser['document']>): boolean {
  const textArea = document.createElement('textarea')
  textArea.value = text
  textArea.setAttribute('readonly', '')
  textArea.style.position = 'fixed'
  textArea.style.opacity = '0'
  document.body.appendChild(textArea)
  textArea.select()
  textArea.setSelectionRange(0, text.length)

  try {
    return document.execCommand('copy')
  } finally {
    document.body.removeChild(textArea)
  }
}

/**
 * 優先使用現代 Clipboard API；舊版瀏覽器或權限受限時降級為 execCommand。
 * 僅能在使用者觸發的瀏覽器事件中呼叫。
 */
export async function copyTextToClipboard(
  text: string,
  browser: ClipboardBrowser = {
    clipboard: typeof navigator === 'undefined' ? undefined : navigator.clipboard,
    document: typeof document === 'undefined' ? undefined : document,
  }
): Promise<boolean> {
  if (browser.clipboard) {
    try {
      await browser.clipboard.writeText(text)
      return true
    } catch {
      // Clipboard API 可能因權限、非安全來源或瀏覽器實作不完整而失敗，改用舊式複製方式。
    }
  }

  return browser.document ? legacyCopyText(text, browser.document) : false
}
