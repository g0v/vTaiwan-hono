import type { Hono } from 'hono'
import type { D1Database, R2Bucket, Ai } from '@cloudflare/workers-types'

export type AppBindings = {
  ASSETS?: {
    fetch: (request: RequestInfo | URL, init?: RequestInit) => Promise<Response>
  }
  MASTODON_TOKEN?: string
  DB: D1Database
  DB_AUTH: D1Database
  R2?: R2Bucket
  AI?: Ai

  JAAS_APP_ID?: string
  JAAS_KEY_ID?: string
  JAAS_PRIVATE_KEY?: string

  // Better Auth
  BETTER_AUTH_SECRET: string
  BETTER_AUTH_URL: string

  // Google OAuth
  GOOGLE_CLIENT_ID: string
  GOOGLE_CLIENT_SECRET: string

  // GitHub OAuth
  GITHUB_CLIENT_ID: string
  GITHUB_CLIENT_SECRET: string
}

export type AppEnv = {
  Bindings: AppBindings
  Variables: {
    cspNonce: string
  }
}

export type App = Hono<AppEnv>
