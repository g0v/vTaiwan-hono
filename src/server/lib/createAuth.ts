import { betterAuth } from 'better-auth'
import { createAuthMiddleware, getOAuthState } from 'better-auth/api'
import type { AppBindings } from '../../api/types'
import { admin } from 'better-auth/plugins'
import { adminAc, userAc } from 'better-auth/plugins/admin/access'
import { prepareAuthAudit, recordPreparedAuthAudit, type PreparedAuthAudit } from './auth-audit'
import { sealStepUpToken, STEP_UP_COOKIE_NAME, STEP_UP_PURPOSE, STEP_UP_TTL_SECONDS } from './step-up'

export const adminRoleAccess = {
  user: userAc,
  admin: userAc,
  'super-admin': adminAc,
}

// Better Auth 必須在每次 OAuth 登入取回供應商個人資料，才能得知頭像是否更新。
// 資料庫 hook 會把這個完整覆寫限制為只同步 image，保留使用者自行修改的名稱與 email。
export const socialProviderProfileSync = { overrideUserInfoOnSignIn: true } as const

export function limitOAuthProfileSyncToAvatar(data: Record<string, unknown>, path?: string) {
  if (!path?.startsWith('/callback/') || !('image' in data)) return

  return {
    data: {
      name: undefined,
      email: undefined,
      emailVerified: undefined,
    },
  }
}

export function createAuth(env: AppBindings) {
  const preparedAudits = new WeakMap<object, PreparedAuthAudit>()

  return betterAuth({
    appName: 'vTaiwan',
    database: env.DB_AUTH,
    baseURL: env.BETTER_AUTH_URL,
    secret: env.BETTER_AUTH_SECRET,
    advanced: {
      cookiePrefix: 'vtaiwan',
    },
    onAPIError: {
      errorURL: '/auth/error',
    },
    account: {
      accountLinking: {
        trustedProviders: ['google', 'github'],
      },
    },
    socialProviders: {
      google: {
        clientId: env.GOOGLE_CLIENT_ID,
        clientSecret: env.GOOGLE_CLIENT_SECRET,
        ...socialProviderProfileSync,
      },
      github: {
        clientId: env.GITHUB_CLIENT_ID,
        clientSecret: env.GITHUB_CLIENT_SECRET,
        ...socialProviderProfileSync,
      },
    },
    databaseHooks: {
      user: {
        update: {
          before: async (data, context) => limitOAuthProfileSyncToAvatar(data, context?.path),
        },
      },
    },
    plugins: [
      admin({
        adminRoles: ['super-admin'],
        roles: adminRoleAccess,
      }),
    ],
    hooks: {
      before: createAuthMiddleware(async ctx => {
        const prepared = await prepareAuthAudit(env, ctx.path, ctx.body)
        if (prepared) preparedAudits.set(ctx.context, prepared)
      }),
      after: createAuthMiddleware(async ctx => {
        const prepared = preparedAudits.get(ctx.context) ?? null
        preparedAudits.delete(ctx.context)
        await recordPreparedAuthAudit(env, ctx.context.session?.user, prepared, ctx.context.returned)

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
