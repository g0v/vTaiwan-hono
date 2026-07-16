import { SignJWT } from 'jose'
import type { AppBindings } from '../api/types'

export interface JaasUserInfo {
  user_id?: string
  user_name?: string
  user_email?: string
  user_moderator?: string
}

export async function generateJaasJwt(room: string, userInfo: JaasUserInfo, env: AppBindings): Promise<string> {
  const appId = env.JAAS_APP_ID
  const keyId = env.JAAS_KEY_ID
  const privateKeyPem = env.JAAS_PRIVATE_KEY

  if (!appId || !keyId || !privateKeyPem) {
    throw new Error('Missing JAAS_APP_ID, JAAS_KEY_ID, or JAAS_PRIVATE_KEY')
  }

  const privateKey = await importPemKey(privateKeyPem)

  const now = Math.floor(Date.now() / 1000)
  const userId = userInfo.user_id ?? 'user123'
  const userName = userInfo.user_name ?? 'Your User'
  const userEmail = userInfo.user_email ?? 'user@example.com'
  const userModerator = userInfo.user_moderator ?? 'true'

  return await new SignJWT({
    aud: 'jitsi',
    iss: 'chat',
    sub: appId,
    room,
    exp: now + 3600,
    nbf: now,
    context: {
      user: {
        id: userId,
        name: userName,
        email: userEmail,
        moderator: userModerator,
      },
      features: {
        livestreaming: true,
        'outbound-call': true,
        'sip-outbound-call': false,
        transcription: false,
        recording: false,
      },
      room: { regex: false },
    },
  })
    .setProtectedHeader({ alg: 'RS256', kid: keyId, typ: 'JWT' })
    .sign(privateKey)
}

async function importPemKey(pem: string): Promise<CryptoKey> {
  if (!pem.includes('BEGIN') || !pem.includes('END')) {
    throw new Error('PEM format invalid: missing BEGIN/END markers')
  }

  const cleaned = pem
    .replace(/-----BEGIN[^-]*-----/g, '')
    .replace(/-----END[^-]*-----/g, '')
    .replace(/[^A-Za-z0-9+/=]/g, '')

  const paddingNeeded = (4 - (cleaned.length % 4)) % 4
  const padded = cleaned + '='.repeat(paddingNeeded)

  if (!/^[A-Za-z0-9+/=]*$/.test(padded)) {
    throw new Error('PEM contains invalid characters after cleaning')
  }

  const binaryKey = Uint8Array.from(atob(padded), c => c.charCodeAt(0))

  return await crypto.subtle.importKey('pkcs8', binaryKey.buffer as ArrayBuffer, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign'])
}
