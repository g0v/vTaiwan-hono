import { describe, expect, it } from 'vite-plus/test'
import app from '../index'
import { formatVersionId, isValidMeetingId, isValidVersionId, parseVersionId, versionIdFromKey, versionObjectKey, versionsPrefix } from '../lib/transcription-versions'

describe('逐字稿版本識別碼（#73）', () => {
  const epoch = Date.UTC(2026, 7, 3, 9, 15, 0) + 123

  it('epoch 毫秒與版本識別碼可雙向轉換', () => {
    expect(formatVersionId(epoch)).toBe('20260803T091500123Z')
    expect(parseVersionId('20260803T091500123Z')).toBe(epoch)
  })

  it('字典序即時間序（R2 list 據此排序，不必另外解析時間）', () => {
    const earlier = formatVersionId(epoch)
    const later = formatVersionId(epoch + 1)
    const nextDay = formatVersionId(epoch + 86_400_000)
    expect([nextDay, earlier, later].sort()).toEqual([earlier, later, nextDay])
  })

  it('格式不符的識別碼一律拒絕（避免把使用者輸入接進 R2 key）', () => {
    expect(isValidVersionId('20260803T091500123Z')).toBe(true)
    expect(isValidVersionId('20260803T0915001Z')).toBe(false)
    expect(isValidVersionId('../../secret')).toBe(false)
    expect(isValidVersionId('')).toBe(false)
    expect(parseVersionId('not-a-version')).toBeNull()
    // 月份 99 通得過格式，但湊不出合法日期
    expect(parseVersionId('20269903T091500123Z')).toBeNull()
  })

  it('會議 ID 僅接受 8 位數字', () => {
    expect(isValidMeetingId('20260803')).toBe(true)
    expect(isValidMeetingId('2026080')).toBe(false)
    expect(isValidMeetingId('2026-08-03')).toBe(false)
  })
})

describe('逐字稿版本的 R2 key', () => {
  it('前綴帶結尾斜線，不會掃到 ID 開頭相同的其他會議', () => {
    expect(versionsPrefix('20260803')).toBe('versions/20260803/')
    expect(versionObjectKey('20260803', '20260803T091500123Z')).toBe('versions/20260803/20260803T091500123Z.txt')
    expect(versionsPrefix('2026080').startsWith(versionsPrefix('20260803'))).toBe(false)
  })

  it('由 key 還原版本識別碼；不屬於該會議或格式不符回 null', () => {
    expect(versionIdFromKey('versions/20260803/20260803T091500123Z.txt', '20260803')).toBe('20260803T091500123Z')
    expect(versionIdFromKey('versions/20260804/20260803T091500123Z.txt', '20260803')).toBeNull()
    expect(versionIdFromKey('20260803.txt', '20260803')).toBeNull()
    expect(versionIdFromKey('versions/20260803/legacy.txt', '20260803')).toBeNull()
  })
})

// 測試環境沒有 Cloudflare 綁定，因此只驗「未登入者拿不到版本」這道關卡；
// 已登入但權限不足（403）與實際列表／下載內容留待實測（見 AGENTS.md）。
describe('版本端點的授權關卡', () => {
  const headers = { origin: 'https://vtaiwan.tw' }

  it('未登入不得列出歷史版本', async () => {
    const res = await app.request('https://vtaiwan.tw/api/transcriptions/20260803/versions', { headers })
    expect(res.status).toBe(401)
  })

  it('未登入不得下載歷史版本', async () => {
    const res = await app.request('https://vtaiwan.tw/api/transcriptions/20260803/versions/20260803T091500123Z/text', { headers })
    expect(res.status).toBe(401)
  })

  it('格式不合法的參數在碰到授權與 R2 之前就被擋下', async () => {
    const res = await app.request('https://vtaiwan.tw/api/transcriptions/2026080/versions', { headers })
    expect(res.status).toBe(400)
  })
})
