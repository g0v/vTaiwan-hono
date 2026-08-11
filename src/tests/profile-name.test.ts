import { describe, expect, it } from 'vite-plus/test'
import { isNameChangeCooldownPayload, NAME_CHANGE_COOLDOWN_DAYS, NAME_CHANGE_COOLDOWN_MS, nameChangeCooldownExpiresAt, nameChangeCooldownRemainingDays } from '../lib/profile-name'

describe('個人名稱修改冷卻期', () => {
  const changedAt = '2026-08-01T00:00:00.000Z'
  const now = Date.parse(changedAt)

  it('名稱更新後 30 天內維持冷卻，到期時解除', () => {
    expect(nameChangeCooldownExpiresAt(changedAt, now)).toBe(now + NAME_CHANGE_COOLDOWN_MS)
    expect(nameChangeCooldownExpiresAt(changedAt, now + NAME_CHANGE_COOLDOWN_MS - 1)).toBe(now + NAME_CHANGE_COOLDOWN_MS)
    expect(nameChangeCooldownExpiresAt(changedAt, now + NAME_CHANGE_COOLDOWN_MS)).toBeNull()
  })

  it('未曾修改或無效時間戳記不會誤擋名稱更新', () => {
    expect(nameChangeCooldownExpiresAt(null, now)).toBeNull()
    expect(nameChangeCooldownExpiresAt('not-a-date', now)).toBeNull()
  })

  it('以向上取整的天數顯示剩餘冷卻期', () => {
    expect(nameChangeCooldownRemainingDays(changedAt, now)).toBe(NAME_CHANGE_COOLDOWN_DAYS)
    expect(nameChangeCooldownRemainingDays(changedAt, now + 24 * 60 * 60 * 1000)).toBe(29)
    expect(nameChangeCooldownRemainingDays(changedAt, now + NAME_CHANGE_COOLDOWN_MS - 1)).toBe(1)
    expect(nameChangeCooldownRemainingDays(changedAt, now + NAME_CHANGE_COOLDOWN_MS)).toBeNull()
  })

  it('可辨識 Worker 與 Better Auth client 的冷卻期錯誤格式', () => {
    expect(isNameChangeCooldownPayload({ code: 'NAME_CHANGE_COOLDOWN' })).toBe(true)
    expect(isNameChangeCooldownPayload({ error: { code: 'NAME_CHANGE_COOLDOWN' } })).toBe(true)
    expect(isNameChangeCooldownPayload({ code: 'OTHER_ERROR' })).toBe(false)
  })
})
