import { describe, expect, it } from 'vite-plus/test'
import app from '../index'
import { isSessionNotFreshPayload, isWrongAccountAfterStepUp, SESSION_NOT_FRESH_CODE, STEP_UP_PURPOSE, type AppRole, type AuthSession } from '../client/auth-session'
import { readStepUpExpiry, requiresStepUp, sealStepUpToken, sessionNotFreshBody, STEP_UP_PURPOSE as SERVER_STEP_UP_PURPOSE, STEP_UP_TTL_SECONDS } from '../server/lib/step-up'

describe('敏感操作二次驗證（step-up cookie）', () => {
  const now = Date.UTC(2026, 7, 2, 0, 0, 0)
  const secret = 'test-secret-for-step-up-hmac'
  const cookieFor = (token: string) => `other=1; vtaiwan.step_up=${encodeURIComponent(token)}`

  it('簽發後在有效期內通過，並回傳到期時間供前端倒數', async () => {
    const token = await sealStepUpToken('session-1', secret, now)
    const expiresAt = await readStepUpExpiry(cookieFor(token), 'session-1', secret, now + 1000)
    expect(expiresAt).toBe(now + STEP_UP_TTL_SECONDS * 1000)
  })

  // 這是 #72 的核心語意：登出會換一組 session，舊的二次驗證不該延續到新 session。
  it('cookie 綁定 session：換一個 session（登出再登入）即失效', async () => {
    const token = await sealStepUpToken('session-1', secret, now)
    expect(await readStepUpExpiry(cookieFor(token), 'session-2', secret, now + 1000)).toBeNull()
  })

  it('過期後失效', async () => {
    const token = await sealStepUpToken('session-1', secret, now, 60)
    expect(await readStepUpExpiry(cookieFor(token), 'session-1', secret, now + 59_000)).toBe(now + 60_000)
    expect(await readStepUpExpiry(cookieFor(token), 'session-1', secret, now + 60_000)).toBeNull()
  })

  it('簽章錯誤或被竄改的 cookie 無效', async () => {
    const token = await sealStepUpToken('session-1', secret, now)
    // 換密鑰（等同偽造）
    expect(await readStepUpExpiry(cookieFor(token), 'session-1', 'another-secret', now + 1000)).toBeNull()
    // 延長到期時間但沿用舊簽章
    const [, sessionId, signature] = token.split('.')
    const forged = `${Math.floor(now / 1000) + 86_400}.${sessionId}.${signature}`
    expect(await readStepUpExpiry(cookieFor(forged), 'session-1', secret, now + 1000)).toBeNull()
    // 格式不完整
    expect(await readStepUpExpiry(cookieFor('garbage'), 'session-1', secret, now)).toBeNull()
  })

  it('一般登入 cookie 本身不算通過二次驗證', async () => {
    expect(await readStepUpExpiry('better-auth.session_token=abc', 'session-1', secret, now)).toBeNull()
    expect(await readStepUpExpiry(null, 'session-1', secret, now)).toBeNull()
  })

  it('前後端的 purpose 標記一致（不一致就永遠簽不出 cookie）', () => {
    expect(STEP_UP_PURPOSE).toBe(SERVER_STEP_UP_PURPOSE)
  })

  it('管理端點需二次驗證，登入流程本身不得被擋', () => {
    expect(requiresStepUp('/api/auth/admin/set-role')).toBe(true)
    expect(requiresStepUp('/api/auth/admin/list-users')).toBe(true)
    expect(requiresStepUp('/api/auth/admin/ban-user')).toBe(true)
    // 二次驗證要走的登入／回調路徑若被擋住，使用者將永遠無法取得 step-up cookie
    expect(requiresStepUp('/api/auth/sign-in/social')).toBe(false)
    expect(requiresStepUp('/api/auth/callback/google')).toBe(false)
    expect(requiresStepUp('/api/auth/callback/github')).toBe(false)
    expect(requiresStepUp('/api/auth/get-session')).toBe(false)
    expect(requiresStepUp('/api/me')).toBe(false)
  })

  // 社群帳號 email 與管理員帳號不同時，Better Auth 會新建一個角色為 user 的帳號並換掉 session；
  // 「通過二次驗證卻不是管理員」是一般訪客到不了的狀態，AdminView 據此提示並導回首頁。
  describe('二次驗證後身分被換掉（isWrongAccountAfterStepUp）', () => {
    const sessionWith = (role: AppRole, fresh: boolean): AuthSession => ({
      user: { id: 'u1', name: '測試', email: 'someone@example.com', image: null },
      role,
      banned: false,
      permissions: [],
      fresh,
      stepUpExpiresAt: fresh ? Date.UTC(2026, 7, 2, 0, 15, 0) : null,
    })

    it('通過二次驗證卻非管理員：判定為換到別的帳號', () => {
      expect(isWrongAccountAfterStepUp(sessionWith('user', true))).toBe(true)
    })

    it('管理員通過二次驗證：正常流程，不得誤判', () => {
      expect(isWrongAccountAfterStepUp(sessionWith('admin', true))).toBe(false)
      expect(isWrongAccountAfterStepUp(sessionWith('super-admin', true))).toBe(false)
    })

    it('未通過二次驗證的一般使用者：只是無權限的訪客，維持原本的 403 畫面', () => {
      expect(isWrongAccountAfterStepUp(sessionWith('user', false))).toBe(false)
      expect(isWrongAccountAfterStepUp(null)).toBe(false)
      expect(isWrongAccountAfterStepUp(undefined)).toBe(false)
    })
  })

  it('sessionNotFreshBody 帶前後端共用的錯誤碼', () => {
    expect(sessionNotFreshBody()).toEqual({ error: 'Session not fresh', code: SESSION_NOT_FRESH_CODE })
  })

  it('client 端可辨識 SESSION_NOT_FRESH（含 Better Auth client 包一層的形狀）', () => {
    expect(isSessionNotFreshPayload(sessionNotFreshBody())).toBe(true)
    expect(isSessionNotFreshPayload({ error: sessionNotFreshBody() })).toBe(true)
    expect(isSessionNotFreshPayload({ code: 'FORBIDDEN' })).toBe(false)
    expect(isSessionNotFreshPayload(null)).toBe(false)
  })

  // 端點層級：未登入者連 Better Auth handler 都碰不到（測試環境無 D1 綁定，
  // 因此「有 session、但未二次驗證」的 403 分支留待實測）。
  it('未登入打管理端點回 401（不落到 Better Auth handler 的 500）', async () => {
    const res = await app.request('https://vtaiwan.tw/api/auth/admin/list-users', {
      headers: { origin: 'https://vtaiwan.tw' },
    })
    expect(res.status).toBe(401)
    expect(await res.json()).toEqual({ error: 'Unauthorized', code: 'UNAUTHORIZED' })
  })
})
