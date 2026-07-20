import { describe, expect, it } from 'vite-plus/test'
import { splitTranscriptionIntoChunks, utf8ByteLength } from '../lib/transcription-storage'

describe('逐字稿 UTF-8 分段', () => {
  it('空字串不建立 chunk', () => {
    expect(splitTranscriptionIntoChunks('', 10)).toEqual([])
  })

  it('未超過容量時保留單一完整字串', () => {
    expect(splitTranscriptionIntoChunks('逐字稿', 9)).toEqual(['逐字稿'])
  })

  it('混合 CJK、ASCII 與 emoji 時不切斷 Unicode code point', () => {
    const source = '中a🙂文'
    const chunks = splitTranscriptionIntoChunks(source, 4)

    expect(chunks).toEqual(['中a', '🙂', '文'])
    expect(chunks.join('')).toBe(source)
    expect(chunks.every(chunk => utf8ByteLength(chunk) <= 4)).toBe(true)
  })

  it('長文字分段後可無損重組且每段不超過限制', () => {
    const source = '會議逐字稿\n🙂 summary\n'.repeat(100)
    const chunks = splitTranscriptionIntoChunks(source, 100)

    expect(chunks.length).toBeGreaterThan(1)
    expect(chunks.join('')).toBe(source)
    expect(chunks.every(chunk => utf8ByteLength(chunk) <= 100)).toBe(true)
  })

  it('容量小於單一 code point 時拒絕分段', () => {
    expect(() => splitTranscriptionIntoChunks('🙂', 3)).toThrow(RangeError)
  })
})
