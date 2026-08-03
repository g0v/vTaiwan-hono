/**
 * 敏感操作二次驗證（step-up）。
 *
 * **只有「刻意為了二次驗證而重新登入」才算通過**——單純「剛登入」不算。
 * 因此 session 的新舊（`createdAt`）不足以承載此語意：登出再登入的 session 一樣是新的，
 * 但那只是一般登入，不該直接開通後台。
 *
 * 流程：StepUpAuth 發起的社群登入（Google／GitHub 皆可）會在 OAuth state 帶 `purpose=step-up`；
 * Better Auth callback 完成後（見 createAuth.ts 的 after hook）簽發一枚短效 httpOnly cookie，
 * 內容為 `exp.sessionId.sig`（HMAC-SHA256，密鑰為 `BETTER_AUTH_SECRET`）。
 *
 * cookie **綁定當下的 session id**，所以：
 * - 登出（session 失效）後再登入 ⇒ session id 不同 ⇒ 舊 cookie 自動失效，需重新二次驗證；
 * - cookie 被單獨竊取也無法搭配他人 session 使用。
 *
 * 侷限（已知並接受）：provider（Google／GitHub）若仍在登入狀態，再次登入是零點擊轉跳。這擋得住
 * 「只偷到本站 session cookie」的攻擊者（他沒有受害者的社群帳號），但擋不住「借用已解鎖的裝置」。
 * 另：驗證的是「控制其中一個已連結的 provider」，不必然是當初建立 session 的那一個——與一般登入
 * 的信任模型一致（帳號以 email 連結，見 createAuth.ts 的 accountLinking）。
 */

export const STEP_UP_COOKIE_NAME = 'vtaiwan.step_up'

/** 通過二次驗證後，敏感操作允許的持續時間 */
export const STEP_UP_TTL_SECONDS = 15 * 60

/** OAuth state 的意圖標記：只有帶這個值的登入才會簽發 step-up cookie */
export const STEP_UP_PURPOSE = 'step-up'

/** 與 Better Auth 內建的 freshness 錯誤碼一致，前後端共用此字串判斷 */
export const SESSION_NOT_FRESH_CODE = 'SESSION_NOT_FRESH' as const

export function sessionNotFreshBody(): { error: string; code: typeof SESSION_NOT_FRESH_CODE } {
  return { error: 'Session not fresh', code: SESSION_NOT_FRESH_CODE }
}

/**
 * Better Auth admin plugin 的端點（list-users／set-role／ban-user…）全屬敏感操作：
 * 「進入管理員後台」看得到資料靠 list-users、「改變使用者權限」靠 set-role。
 * 前綴僅涵蓋 /api/auth/admin/，不會誤傷 /api/auth/sign-in/*、/api/auth/callback/*——
 * 否則二次驗證本身要走的登入流程會被自己擋住。
 */
export function requiresStepUp(pathname: string): boolean {
  return pathname === '/api/auth/admin' || pathname.startsWith('/api/auth/admin/')
}

function bytesToBase64Url(bytes: ArrayBuffer): string {
  const view = new Uint8Array(bytes)
  let binary = ''
  for (const byte of view) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

async function signPayload(secret: string, payload: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  return bytesToBase64Url(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload)))
}

// 自簽後做定長比對，避免以字串提早返回洩漏簽章前綴
async function verifyPayload(secret: string, payload: string, signature: string): Promise<boolean> {
  const expected = await signPayload(secret, payload)
  if (expected.length !== signature.length) return false
  let diff = 0
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ signature.charCodeAt(i)
  return diff === 0
}

/** 簽發 step-up cookie 值：`exp.sessionId.sig`（exp 為 Unix 秒） */
export async function sealStepUpToken(sessionId: string, secret: string, nowMs: number = Date.now(), ttlSeconds: number = STEP_UP_TTL_SECONDS): Promise<string> {
  const exp = Math.floor(nowMs / 1000) + ttlSeconds
  const payload = `${exp}.${sessionId}`
  return `${payload}.${await signPayload(secret, payload)}`
}

function readStepUpCookie(cookieHeader: string | null | undefined): string | null {
  if (!cookieHeader) return null
  const match = cookieHeader.match(/(?:^|;\s*)vtaiwan\.step_up=([^;]*)/)
  return match?.[1] ? decodeURIComponent(match[1]) : null
}

/**
 * 驗證 step-up cookie，回傳到期時間（epoch 毫秒）；無效／過期／綁到別的 session 一律回 null。
 * 回傳到期時間是為了讓前端顯示剩餘時間倒數。
 */
export async function readStepUpExpiry(cookieHeader: string | null | undefined, sessionId: string, secret: string, nowMs: number = Date.now()): Promise<number | null> {
  const token = readStepUpCookie(cookieHeader)
  if (!token) return null

  // sessionId 理論上不含 '.'，但仍以「首段為 exp、末段為簽章」的方式切，避免格式假設出錯
  const parts = token.split('.')
  if (parts.length < 3) return null
  const expRaw = parts[0]
  const signature = parts[parts.length - 1]
  const subject = parts.slice(1, -1).join('.')
  if (!expRaw || !signature || !subject) return null
  if (subject !== sessionId) return null

  const exp = Number(expRaw)
  if (!Number.isFinite(exp)) return null
  const expiresAtMs = exp * 1000
  if (expiresAtMs <= nowMs) return null

  return (await verifyPayload(secret, `${expRaw}.${subject}`, signature)) ? expiresAtMs : null
}
