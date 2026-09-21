/**
 * 以瀏覽器 Blob URL 下載檔案，並在完成觸發後清除暫存連結與 URL。
 * 僅能在使用者觸發的瀏覽器事件中呼叫；SSR 或不支援 Blob URL 的環境會回傳 false。
 */
export function downloadBlob(blob: Blob, filename: string): boolean {
  if (typeof document === 'undefined' || typeof URL === 'undefined' || typeof URL.createObjectURL !== 'function') return false

  const objectUrl = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = objectUrl
  link.download = filename

  document.body.appendChild(link)
  try {
    link.click()
  } finally {
    document.body.removeChild(link)
    URL.revokeObjectURL(objectUrl)
  }

  return true
}
