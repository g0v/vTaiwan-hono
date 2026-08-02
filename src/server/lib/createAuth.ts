import { betterAuth } from 'better-auth'
import { createAuthMiddleware, getOAuthState } from 'better-auth/api'
import type { AppBindings } from '../../api/types'
import { admin } from 'better-auth/plugins'
import { adminAc, userAc } from 'better-auth/plugins/admin/access'
import { sealStepUpToken, STEP_UP_COOKIE_NAME, STEP_UP_PURPOSE, STEP_UP_TTL_SECONDS } from './step-up'

export const adminRoleAccess = {
  user: userAc,
  admin: userAc,
  'super-admin': adminAc,
}

export function createAuth(env: AppBindings) {
  return betterAuth({
    appName: 'vTaiwan',
    database: env.DB_AUTH,
    baseURL: env.BETTER_AUTH_URL,
    secret: env.BETTER_AUTH_SECRET,
    socialProviders: {
      google: {
        clientId: env.GOOGLE_CLIENT_ID,
        clientSecret: env.GOOGLE_CLIENT_SECRET,
      },
      github: {
        clientId: env.GITHUB_CLIENT_ID,
        clientSecret: env.GITHUB_CLIENT_SECRET,
      },
    },
    plugins: [
      admin({
        adminRoles: ['super-admin'],
        roles: adminRoleAccess,
      }),
    ],
    hooks: {
      after: createAuthMiddleware(async ctx => {
        const secure = !!ctx.context.authCookies.sessionToken.attributes.secure

        // OAuth 回調：只有「發起時就標記為二次驗證」的登入才簽發 step-up cookie，
        // 一般登入（含登出後重新登入）不會拿到——這是 #72 要求的「刻意複核」語意。
        if (ctx.path?.startsWith('/callback/')) {
          const state = (await getOAuthState()) as { purpose?: string } | null
          if (state?.purpose !== STEP_UP_PURPOSE) return

          // 綁定這次登入建立的 session，登出後舊 cookie 即自動失效
          const sessionId = ctx.context.newSession?.session?.id
          if (!sessionId) return

          ctx.setCookie(STEP_UP_COOKIE_NAME, await sealStepUpToken(sessionId, env.BETTER_AUTH_SECRET), {
            path: '/',
            httpOnly: true,
            sameSite: 'lax',
            maxAge: STEP_UP_TTL_SECONDS,
            secure,
          })
          return
        }

        // 登出：cookie 綁 session、本就失效，這裡順手清掉不留殘留
        if (ctx.path === '/sign-out') {
          ctx.setCookie(STEP_UP_COOKIE_NAME, '', { path: '/', httpOnly: true, sameSite: 'lax', maxAge: 0, secure })
        }
      }),
    },
  })
}
