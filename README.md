# hono-vue-ssr-template

**EN:** Minimal Cloudflare Workers template using **Hono** for routing and **Vue 3 SSR** for rendering. No D1 / R2 / KV / AI bindings — just a worker that server-renders Vue components and serves a few static assets.

**中文：**極簡的 Cloudflare Workers 範本：路由用 **Hono**、畫面用 **Vue 3 SSR**。不含 D1 / R2 / KV / AI 等綁定，僅以 Worker 做 Vue 元件伺服端渲染，並提供少數靜態資源。

## Routes / 路由

| Route | EN | 中文 |
| ----- | -- | ---- |
| `/` | Home page — vTaiwan-styled, Tailwind CSS (SSR) | 首頁 — vTaiwan 設計風格、Tailwind 排版（SSR） |
| `/about` | About page (SSR) | 關於頁（SSR） |
| `/word/:w` | Dynamic page; `og:image` is `https://www.moedict.tw/{w}.png` | 動態頁；`og:image` 為 `https://www.moedict.tw/{w}.png` |
| `/hundred` | **Hydration demo:** 10×10 grid (1–100), multiples highlighted via `v-model` / `v-for` / `:style`; SSR HTML plus optional client bundle | **Hydration 範例：**百數表（10×10，1～100）、倍數著色；SSR 產出 HTML，並可載入 client bundle 在瀏覽器接管互動 |
| `/api/hello` | Returns `Hello World!` | 回傳 `Hello World!` |
| `*` | Falls back to the `ASSETS` binding (`./public/`) | 其餘路徑交給 `ASSETS` 綁定（`./public/`） |

## Stack / 技術棧

**EN**

- [Hono](https://hono.dev) — the worker / router
- [Vue 3](https://vuejs.org) + `@vue/server-renderer` — SSR
- [Vite](https://vite.dev) + `@vitejs/plugin-vue` + `@cloudflare/vite-plugin` — build / dev
- [Tailwind CSS v4](https://tailwindcss.com) — styling, built via the standalone CLI to `public/styles.css`
- [Wrangler](https://developers.cloudflare.com/workers/wrangler/) — deploy

**中文**

- [Hono](https://hono.dev) — Worker 與路由
- [Vue 3](https://vuejs.org) + `@vue/server-renderer` — 伺服端渲染
- [Vite](https://vite.dev) + `@vitejs/plugin-vue` + `@cloudflare/vite-plugin` — 建置與本機開發
- [Tailwind CSS v4](https://tailwindcss.com) — 樣式，以獨立 CLI 編譯輸出到 `public/styles.css`
- [Wrangler](https://developers.cloudflare.com/workers/wrangler/) — 部署

## Layout / 目錄結構

```
src/
├── index.ts             # Hono worker entry — defines all routes / Worker 入口，定義所有路由
├── ssr/
│   ├── render.ts        # createSSRApp + renderToString → full HTML page / 產出完整 HTML
│   └── heads.ts         # per-route <title> / OG meta builders / 各路由的 <title> 與 OG meta
├── views/
│   ├── Home.vue
│   ├── About.vue
│   ├── Word.vue
│   └── HundredChart.vue   # optional hydration demo page / 選用 hydration 範例頁
├── client/
│   └── hundred-chart-entry.ts  # browser entry — createSSRApp + mount(..., true) / 瀏覽器 hydration 入口
├── components/
│   ├── NavBar.vue       # vTaiwan 毛玻璃導覽列（含 CSS-only 行動選單）
│   └── Footer.vue       # vTaiwan 深色頁尾
└── styles/
    └── app.css          # Tailwind v4 source — @theme tokens + 樣式來源 / 樣式來源
vite.client.config.mts   # second Vite build: emits client bundle only / 第二段建置：僅輸出 hydration bundle
public/                  # static assets, served via ASSETS binding / 靜態資源，經 ASSETS 提供
├── styles.css           # generated from src/styles/app.css — do not edit / 由 app.css 編譯產生，勿手改
├── assets/              # vTaiwan logo SVGs / vTaiwan logo 圖檔
├── js/hundred-chart.js  # created by `npm run build` (vite.client.config.mts) / 由建置產生
└── favicon.svg
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
3. Wire a route in `src/index.ts`:

   ```ts
   app.get('/foo', async (c) => {
     const origin = new URL(c.req.url).origin
     const html = await renderPage(FooView, {}, headForFoo(origin))
     return c.html(html)
   })
   ```

4. *(Optional)* To ship **client hydration** for that route, pass a fourth argument to `renderPage` and add a small browser entry under `src/client/` (see `/hundred` in `src/index.ts`, `src/client/hundred-chart-entry.ts`, and `vite.client.config.mts`). `npm run build` runs the Worker build then the client bundle build.

**中文**

1. 在 `src/views/` 新增 `.vue` 檔。
2. 在 `src/ssr/heads.ts` 新增 `headForX(...)` 函式。
3. 在 `src/index.ts` 接上路由（見上方程式片段）。
4. **（選用）**若該頁要在瀏覽器 **hydration**，可傳入 `renderPage` 第四個參數，並在 `src/client/` 新增對應入口（見 `/hundred`、`src/client/hundred-chart-entry.ts`、`vite.client.config.mts`）。`npm run build` 會先建 Worker，再建 client bundle。

## Optional hydration / 選用 hydration

**EN:** By default, routes only return SSR HTML (no Vue runtime in the browser). `/hundred` opts in: `renderPage` injects `<script type="module">` — in dev it loads `/src/client/hundred-chart-entry.ts` (Vite transforms it); in production it loads `/js/hundred-chart.js` from `public/` (produced by `vite build -c vite.client.config.mts`, included in `npm run build`).

**中文：**預設各路由僅回傳 SSR 的靜態 HTML（瀏覽器不載入 Vue）。`/hundred` 為選用模式：`renderPage` 會插入 `<script type="module">` — 開發時載入 `/src/client/hundred-chart-entry.ts`（由 Vite 轉譯）；正式環境載入 `public/js/hundred-chart.js`（由 `vite.client.config.mts` 建置，`npm run build` 已包含）。

## Dynamic HEAD / 動態 `<head>`

**EN:** Each route builds a `HeadConfig` (title + meta) before rendering. `/word/:w` sets `og:image` to `https://www.moedict.tw/{w}.png` — see `headForWord` in `src/ssr/heads.ts` for the pattern. Add more `og:` / `twitter:` tags or extend `HeadConfig` as needed.

**中文：**每個路由在渲染前會組出 `HeadConfig`（標題與 meta）。`/word/:w` 會把 `og:image` 設成 `https://www.moedict.tw/{w}.png`，可參考 `src/ssr/heads.ts` 的 `headForWord`。可依需求擴充 `og:` / `twitter:` 標籤或延伸 `HeadConfig`。

## Styling — Tailwind CSS / 樣式

**EN:** Styling uses **Tailwind CSS v4**. Because the worker server-renders an HTML *string* and links a static `<link rel="stylesheet" href="/styles.css">`, Tailwind is run through its **standalone CLI** (not the Vite plugin): `src/styles/app.css` is the source, compiled to `public/styles.css`, which is then served by the `ASSETS` binding.

- `src/styles/app.css` — `@import "tailwindcss"`, an `@theme` block exposing the vTaiwan design tokens (civic colors `democratic-red` / `jade-green` / `wheat-yellow`, Noto Serif / Sans TC), plus a few `@layer components` effects and the legacy `.container` / `.hundred-*` styles.
- `npm run build:css` — compile + minify to `public/styles.css`.
- `npm run watch:css` — rebuild on `.vue` changes during development.
- `public/styles.css` is **generated** — don't edit it by hand; `build` / `deploy` / `predev` all run `build:css` first.

The homepage (`src/views/Home.vue`), `NavBar.vue` and `Footer.vue` follow the [vTaiwan Design System](https://github.com/Tofuswang/vtaiwan-design-system) — dark hero, three civic colors, glass header, dark footer.

**中文：**樣式採用 **Tailwind CSS v4**。由於 Worker 是伺服端渲染 HTML *字串*、再以 `<link rel="stylesheet" href="/styles.css">` 載入靜態樣式，因此 Tailwind 以**獨立 CLI**（非 Vite plugin）編譯：來源為 `src/styles/app.css`，編譯成 `public/styles.css`，再由 `ASSETS` 綁定提供。

- `src/styles/app.css` — `@import "tailwindcss"`、`@theme` 定義 vTaiwan 設計代幣（民主紅 `democratic-red`、青玉綠 `jade-green`、麥穗黃 `wheat-yellow`，Noto Serif / Sans TC），另含少數 `@layer components` 效果與既有的 `.container` / `.hundred-*` 樣式。
- `npm run build:css` — 編譯並壓縮輸出到 `public/styles.css`。
- `npm run watch:css` — 開發時監看 `.vue` 變更並即時重編。
- `public/styles.css` 為**自動產生**，請勿手動修改；`build` / `deploy` / `predev` 皆會先執行 `build:css`。

首頁（`src/views/Home.vue`）、`NavBar.vue` 與 `Footer.vue` 依循 [vTaiwan Design System](https://github.com/Tofuswang/vtaiwan-design-system) 風格 — 黑底 Hero、三種公民色、毛玻璃導覽列、深色頁尾。

## License / 授權

**EN:** MIT — see [LICENSE](./LICENSE).

**中文：**MIT — 詳見 [LICENSE](./LICENSE)。
