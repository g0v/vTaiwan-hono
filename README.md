# vTaiwan-hono


視覺設計來自：
https://github.com/Tofuswang/vtaiwan-design-system

技術使用以下模板：

**EN:** Minimal Cloudflare Workers template using **Hono** for API / entry routing and **Vue 3 SSR + vue-router hydration** for the site UI. No D1 / R2 / KV / AI bindings — just a worker that server-renders the first route, hydrates the app, and serves a few static assets.

**中文：**極簡的 Cloudflare Workers 範本：API / 入口路由用 **Hono**、畫面用 **Vue 3 SSR + vue-router hydration**。不含 D1 / R2 / KV / AI 等綁定，Worker 負責第一個 URL 的伺服端渲染，之後由瀏覽器端 vue-router 接管站內導覽。

## Routes / 路由

| Route | EN | 中文 |
| ----- | -- | ---- |
| `/` | Home page — vTaiwan-styled, Tailwind CSS (SSR + hydration) | 首頁 — vTaiwan 設計風格、Tailwind 排版（SSR + hydration） |
| `/about`, `/intro` | About page (SSR + hydration) | 關於頁（SSR + hydration） |
| `/word/:w` | Dynamic page; `og:image` is `https://www.moedict.tw/{w}.png` | 動態頁；`og:image` 為 `https://www.moedict.tw/{w}.png` |
| `/hundred` | 10×10 grid (1–100), multiples highlighted via `v-model` / `v-for` / `:style`; now part of the hydrated app | 百數表（10×10，1～100）、倍數著色；現在是全站 hydrated app 的一頁 |
| `/api/hello` | Returns `Hello World!` | 回傳 `Hello World!` |
| `*` | Static files go to the `ASSETS` binding; route-like URLs are rendered by vue-router and return 404 for unknown / placeholder pages | 靜態檔交給 `ASSETS` 綁定；像頁面的 URL 交給 vue-router 渲染，未知 / 樣稿路由回 404 |

## Stack / 技術棧

**EN**

- [Hono](https://hono.dev) — the worker / router
- [Vue 3](https://vuejs.org) + `@vue/server-renderer` + [Vue Router](https://router.vuejs.org) — SSR + hydrated SPA routing
- [Vite](https://vite.dev) + `@vitejs/plugin-vue` + `@cloudflare/vite-plugin` — build / dev
- [Tailwind CSS v4](https://tailwindcss.com) — styling, built via the standalone CLI to `public/styles.css`
- [Wrangler](https://developers.cloudflare.com/workers/wrangler/) — deploy

**中文**

- [Hono](https://hono.dev) — Worker 與路由
- [Vue 3](https://vuejs.org) + `@vue/server-renderer` + [Vue Router](https://router.vuejs.org) — 伺服端渲染 + hydration 後的 SPA 路由
- [Vite](https://vite.dev) + `@vitejs/plugin-vue` + `@cloudflare/vite-plugin` — 建置與本機開發
- [Tailwind CSS v4](https://tailwindcss.com) — 樣式，以獨立 CLI 編譯輸出到 `public/styles.css`
- [Wrangler](https://developers.cloudflare.com/workers/wrangler/) — 部署

## Layout / 目錄結構

```
src/
├── index.ts             # Hono worker entry — API, static assets, SSR fallback / Worker 入口：API、靜態檔、SSR fallback
├── app.ts               # createSSRApp + vue-router factory / 建立 Vue app 與 router
├── App.vue              # RouterView root / router 根元件
├── router/
│   └── routes.ts        # shared route table + status/head helpers / 共用路由表、狀態碼與 head helper
├── ssr/
│   ├── render.ts        # router.push(url) + renderToString → full HTML page / 比對 URL 並產出完整 HTML
│   └── heads.ts         # per-route <title> / OG meta builders / 各路由的 <title> 與 OG meta
├── views/
│   ├── Home.vue
│   ├── About.vue
│   ├── Word.vue
│   └── HundredChart.vue
├── client/
│   └── app-entry.ts      # browser entry — hydrate + sync head after navigation / 瀏覽器 hydration 入口
├── components/
│   ├── NavBar.vue       # vTaiwan 毛玻璃導覽列（RouterLink + mobile state）
│   └── Footer.vue       # vTaiwan 深色頁尾
└── styles/
    └── app.css          # Tailwind v4 source — @theme tokens + 樣式來源 / 樣式來源
vite.client.config.mts   # second Vite build: emits client bundle only / 第二段建置：僅輸出 hydration bundle
public/                  # static assets, served via ASSETS binding / 靜態資源，經 ASSETS 提供
├── styles.css           # generated — gitignored / 自動產生，不納入版控
├── js/app.js            # generated — gitignored / 自動產生，不納入版控
├── js/app.css           # generated — gitignored / 自動產生，不納入版控
├── assets/              # vTaiwan logo SVGs / vTaiwan logo 圖檔
└── favicon.svg
```

## Generated assets / 自動產生的靜態檔

下列檔案**不納入 Git**（見 `.gitignore`），clone 後需自行建置：

| File | Command / 產生方式 |
| ---- | ------------------ |
| `public/styles.css` | `npm run build:css` — Tailwind CLI，來源 `src/styles/app.css` |
| `public/js/app.js` | `vite build -c vite.client.config.mts`（含在 `npm run build`）— 瀏覽器 hydration bundle |
| `public/js/app.css` | 同上 client build 一併輸出 |

**EN:** After `git clone`, run `npm install` then either `npm run build` (all three) or `npm run dev` (which runs `predev` → `build:css` only; production hydration still needs a full `npm run build` before deploy). `npm run deploy` runs the full `npm run build` then `wrangler deploy`.

**中文：**`git clone` 後請先 `npm install`，再執行 `npm run build`（一次產生上述三個檔案），或 `npm run dev`（僅透過 `predev` 編譯 `styles.css`；正式環境的 hydration 仍須在部署前跑完整 `npm run build`）。`npm run deploy` 會先執行完整 `npm run build` 再部署。

```bash
npm install
npm run build          # styles.css + Worker bundle + public/js/app.js + app.css
# 或只編譯樣式：
npm run build:css
# 或只編譯 client hydration：
vite build -c vite.client.config.mts
```

## Develop / 開發

```bash
npm install
npm run dev          # vite dev — runs the worker locally with HMR
                   # Vite 開發模式：本機跑 Worker，含 HMR
                   # `predev` 會先把 src/styles/app.css 編譯成 public/styles.css

npm run watch:css    # (另開終端機) 監看 .vue 變更並即時重編 Tailwind 樣式
                   # watches .vue files and rebuilds styles.css on change
```

> **EN:** `npm run dev` rebuilds `public/styles.css` once on start (via the `predev` hook). When you add or change Tailwind classes in `.vue` files during a session, run `npm run watch:css` in a second terminal so the stylesheet stays in sync.
>
> **中文：**`npm run dev` 啟動時會（透過 `predev`）重新編譯一次 `public/styles.css`。開發過程中若在 `.vue` 增修 Tailwind class，請另開終端機跑 `npm run watch:css`，樣式才會即時更新。

## Deploy / 部署

```bash
npm run deploy       # vite build (+ client bundle) + wrangler deploy
                   # Vite 建置（含 hydration bundle）+ wrangler deploy
```

## Adding a route / 新增路由

**EN**

1. Create a `.vue` file in `src/views/`.
2. Add a `headForX(...)` function in `src/ssr/heads.ts`.
3. Add a vue-router route in `src/router/routes.ts`, and update `headForRoute(...)` if the route needs custom head tags:

   ```ts
   {
     path: '/foo',
     name: 'foo',
     component: FooView,
     meta: { status: 200 },
   }
   ```

4. Use `<RouterLink>` for internal links so navigation stays inside the hydrated app.

**中文**

1. 在 `src/views/` 新增 `.vue` 檔。
2. 在 `src/ssr/heads.ts` 新增 `headForX(...)` 函式。
3. 在 `src/router/routes.ts` 新增 vue-router route；若該頁需要自己的 `<head>`，也更新 `headForRoute(...)`。
4. 站內連結使用 `<RouterLink>`，導覽才會留在 hydrated app 裡。

## Hydration + vue-router / 全站 hydration

**EN:** Hono keeps `/api/*` endpoints and static asset handling. All page-like GET requests are rendered through `src/ssr/render.ts`: the server creates a memory-history router, pushes the incoming URL, renders the matched view, injects `/src/client/app-entry.ts` in dev or `/js/app.js` in production, and returns the route status. After hydration, Vue Router uses `createWebHistory()` so internal navigation does not reload the document.

**中文：**Hono 保留 `/api/*` 與靜態檔處理。所有像頁面的 GET 請求都走 `src/ssr/render.ts`：伺服器建立 memory-history router、push 目前 URL、渲染符合的 view，開發時注入 `/src/client/app-entry.ts`，正式環境注入 `/js/app.js`，並回傳該 route 的狀態碼。Hydration 後，Vue Router 使用 `createWebHistory()`，站內導覽不會重新載入整份文件。

## Dynamic HEAD / 動態 `<head>`

**EN:** Each route builds a `HeadConfig` (title + meta) before rendering. `/word/:w` sets `og:image` to `https://www.moedict.tw/{w}.png` — see `headForWord` in `src/ssr/heads.ts` for the pattern. Add more `og:` / `twitter:` tags or extend `HeadConfig` as needed.

**中文：**每個路由在渲染前會組出 `HeadConfig`（標題與 meta）。`/word/:w` 會把 `og:image` 設成 `https://www.moedict.tw/{w}.png`，可參考 `src/ssr/heads.ts` 的 `headForWord`。可依需求擴充 `og:` / `twitter:` 標籤或延伸 `HeadConfig`。

## Styling — Tailwind CSS / 樣式

**EN:** Styling uses **Tailwind CSS v4**. Because the worker server-renders an HTML *string* and links a static `<link rel="stylesheet" href="/styles.css">`, Tailwind is run through its **standalone CLI** (not the Vite plugin): `src/styles/app.css` is the source, compiled to `public/styles.css`, which is then served by the `ASSETS` binding.

- `src/styles/app.css` — `@import "tailwindcss"`, an `@theme` block exposing the vTaiwan design tokens (civic colors `democratic-red` / `jade-green` / `wheat-yellow`, Noto Serif / Sans TC), plus a few `@layer components` effects and the legacy `.container` / `.hundred-*` styles.
- `npm run build:css` — compile + minify to `public/styles.css`.
- `npm run watch:css` — rebuild on `.vue` changes during development.
- `public/styles.css`, `public/js/app.js`, and `public/js/app.css` are **generated** and **gitignored** — don't edit them by hand; see [Generated assets](#generated-assets--自動產生的靜態檔). `build` / `deploy` / `predev` run the appropriate compile steps.

The homepage (`src/views/Home.vue`), `NavBar.vue` and `Footer.vue` follow the [vTaiwan Design System](https://github.com/Tofuswang/vtaiwan-design-system) — dark hero, three civic colors, glass header, dark footer.

**中文：**樣式採用 **Tailwind CSS v4**。由於 Worker 是伺服端渲染 HTML *字串*、再以 `<link rel="stylesheet" href="/styles.css">` 載入靜態樣式，因此 Tailwind 以**獨立 CLI**（非 Vite plugin）編譯：來源為 `src/styles/app.css`，編譯成 `public/styles.css`，再由 `ASSETS` 綁定提供。

- `src/styles/app.css` — `@import "tailwindcss"`、`@theme` 定義 vTaiwan 設計代幣（民主紅 `democratic-red`、青玉綠 `jade-green`、麥穗黃 `wheat-yellow`，Noto Serif / Sans TC），另含少數 `@layer components` 效果與既有的 `.container` / `.hundred-*` 樣式。
- `npm run build:css` — 編譯並壓縮輸出到 `public/styles.css`。
- `npm run watch:css` — 開發時監看 `.vue` 變更並即時重編。
- `public/styles.css`、`public/js/app.js`、`public/js/app.css` 為**自動產生**且**不納入版控**，請勿手動修改；詳見 [自動產生的靜態檔](#generated-assets--自動產生的靜態檔)。`build` / `deploy` / `predev` 會依腳本執行對應編譯步驟。

首頁（`src/views/Home.vue`）、`NavBar.vue` 與 `Footer.vue` 依循 [vTaiwan Design System](https://github.com/Tofuswang/vtaiwan-design-system) 風格 — 黑底 Hero、三種公民色、毛玻璃導覽列、深色頁尾。

## License / 授權

**EN:** MIT — see [LICENSE](./LICENSE).

**中文：**MIT — 詳見 [LICENSE](./LICENSE)。
