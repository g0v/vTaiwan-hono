import { createAuthClient } from 'better-auth/client'
import { adminClient } from 'better-auth/client/plugins'
import { adminAc, userAc } from 'better-auth/plugins/admin/access'

// 角色設定須與 createAuth.ts 的 admin plugin 對齊，否則 client 端型別／權限檢查會不一致。
export const authClient = createAuthClient({
  plugins: [
    adminClient({
      roles: {
        user: userAc,
        admin: userAc,
        'super-admin': adminAc,
      },
    }),
  ],
})
