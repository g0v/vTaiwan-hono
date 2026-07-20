// D1 單一字串／資料列上限為 2,000,000 bytes；預留 meeting_id、欄位與資料庫編碼空間。
export const TRANSCRIPTION_CHUNK_MAX_BYTES = 1_500_000
// 此端點會同步保留全文、切段並產生 AI 大綱；限制總量以避免逼近 Worker 記憶體上限。
export const TRANSCRIPTION_MAX_BYTES = 20_000_000

const encoder = new TextEncoder()

export function utf8ByteLength(value: string): number {
  return encoder.encode(value).byteLength
}

/**
 * 依 UTF-8 bytes 分段，且只在 Unicode code point 邊界切割。
 * chunks 直接串接後必須與原文完全一致。
 */
export function splitTranscriptionIntoChunks(text: string, maxBytes = TRANSCRIPTION_CHUNK_MAX_BYTES): string[] {
  if (!Number.isSafeInteger(maxBytes) || maxBytes <= 0) {
    throw new RangeError('maxBytes must be a positive safe integer')
  }
  if (text.length === 0) return []
  if (utf8ByteLength(text) <= maxBytes) return [text]

  const chunks: string[] = []
  let characters: string[] = []
  let chunkBytes = 0

  for (const character of text) {
    const characterBytes = utf8ByteLength(character)
    if (characterBytes > maxBytes) {
      throw new RangeError('maxBytes is too small for a Unicode code point')
    }

    if (chunkBytes + characterBytes > maxBytes) {
      chunks.push(characters.join(''))
      characters = []
      chunkBytes = 0
    }

    characters.push(character)
    chunkBytes += characterBytes
  }

  if (characters.length > 0) chunks.push(characters.join(''))
  return chunks
}
