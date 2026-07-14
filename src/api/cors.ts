import { cors } from "hono/cors";

// 允許的前端來源白名單（同 vtaiwan-transcription-worker + hono worker 本身）
export const ALLOWED_ORIGINS = [
  // 'https://vtaiwan.pages.dev',
  'http://localhost:3000',
  'http://localhost:3001',
  'http://localhost:4173',
  'http://localhost:4174',
  'http://localhost:8080',
  'http://localhost:8081',
  'http://localhost:8787',
  'https://vtaiwan.tw',
  'https://www.vtaiwan.tw',
  'https://vue.vtaiwan.tw',
  'https://talk.vtaiwan.tw',
  'https://feat-newsletters-page.vtaiwan.pages.dev',
  'https://vtaiwan-hono.audreyt.workers.dev',
];

/**
 * 為單一路由產生 CORS middleware。
 * methods 只列該路由實際用到的 HTTP 動詞（hono/cors 的 preflight 會自動處理 OPTIONS）。
 */
export function corsFor(methods: string[]) {
  return cors({
    origin: (origin) => (ALLOWED_ORIGINS.includes(origin) ? origin : null),
    allowMethods: methods,
    allowHeaders: ['Content-Type', 'Authorization'],
    maxAge: 86400,
  });
}
