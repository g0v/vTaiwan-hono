import { betterAuth } from 'better-auth'
import type { AppBindings } from '../../api/types'
import { admin } from 'better-auth/plugins'

export function createAuth(env: AppBindings) {
  return betterAuth({
    appName: 'vTaiwan',
    database: env.DB,
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
    plugins: [admin()],
  })
}
