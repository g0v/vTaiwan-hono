import type { D1Database } from '@cloudflare/workers-types'
import { createAuth } from './createAuth'

// ex: npx auth@latest generate --config ./src/server/lib/auth-cli.ts --output ./migrations/20260727_init_better_auth_tables.sql

// Better Auth CLI 會讀取資料庫 metadata；此 stub 一律回覆空資料庫。
// 三個方法讓 Better Auth 辨識資料庫為 Cloudflare D1（SQLite dialect）。
const emptyResult = {
  results: [],
  success: true,
  meta: { changes: 0, last_row_id: null },
}

type SchemaOnlyStatement = {
  bind: (...values: unknown[]) => SchemaOnlyStatement
  all: () => Promise<typeof emptyResult>
}

const schemaOnlyStatement: SchemaOnlyStatement = {
  bind: () => schemaOnlyStatement,
  all: async () => emptyResult,
}

const schemaOnlyD1 = {
  batch: async () => [],
  exec: async () => ({ count: 0, duration: 0 }),
  prepare: () => schemaOnlyStatement,
} as unknown as D1Database

// 僅供 CLI 產生 schema；所有值都是無效的佔位字串，不能用於 Worker runtime。
export const auth = createAuth({
  DB: schemaOnlyD1,
  DB_AUTH: schemaOnlyD1,
  DB_CIVIC_TALKS: schemaOnlyD1,
  BETTER_AUTH_SECRET: 'schema-generation-only-secret-value',
  BETTER_AUTH_URL: 'https://schema-generation.invalid',
  GOOGLE_CLIENT_ID: 'schema-generation-only',
  GOOGLE_CLIENT_SECRET: 'schema-generation-only',
  GITHUB_CLIENT_ID: 'schema-generation-only',
  GITHUB_CLIENT_SECRET: 'schema-generation-only',
})
