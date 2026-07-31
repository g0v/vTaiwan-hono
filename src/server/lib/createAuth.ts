import { betterAuth } from 'better-auth'
import type { AppBindings } from '../../api/types'
import { admin } from 'better-auth/plugins'
import { adminAc, userAc } from 'better-auth/plugins/admin/access'

// 管理端點（/api/auth/admin/*：list-users、set-role、ban-user…）的權限來源，
// 由 Better Auth admin plugin 直接強制——這是**唯一**的授權設定點，Worker 端
// 不再另外實作平行守衛（否則兩處規則會漂移、互相衝突）。
// 目前只有 super-admin 拿到 adminAc（可列表／改角色／停權）；admin 與 user 都是
// userAc（空權限集合），打管理端點一律 403，未登入則由 plugin 的 adminMiddleware 回 401。
// ⚠️ 業務權限（meeting.*／transcription.*／topic.manage）是另一套，見 authorization.ts。
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
        // adminRoles 只用於「不可被假冒／不可被操作的目標帳號」判定，
        // 端點本身的授權一律走 roles（見 adminRoleAccess 註解）。
        adminRoles: ['super-admin'],
        roles: adminRoleAccess,
      }),
    ],
  })
}
