# vTaiwan-hono

> 🤖 用 AI coding agent 開發本專案？請先看 [`AGENTS.md`](./AGENTS.md)（SSR 架構、程式碼慣例、i18n 規則、驗證與 commit 規範）。

視覺設計來自：https://github.com/Tofuswang/vtaiwan-design-system

**EN:** SSR re-implementation of the vTaiwan website. It **parallel-migrates the pages and features of the existing [`vue.vTaiwan-neo`](https://github.com/Tofuswang/vue.vTaiwan-neo) site** onto a **Hono + Vue 3 SSR + Cloudflare Workers** stack, applying the new **[vtaiwan-design-system](https://github.com/Tofuswang/vtaiwan-design-system)** visual language. Hono handles API / entry routing; the site UI is server-rendered per request and hydrated client-side with vue-router. Multilingual (zh-TW / en / ja) via vue-i18n.

**中文：**vTaiwan 官網的 SSR 版本。以 **Hono + Vue 3 SSR + Cloudflare Workers** 技術棧，**平行搬移現有 [`vue.vTaiwan-neo`](https://github.com/Tofuswang/vue.vTaiwan-neo) 官網的頁面與功能**，並套用 [vtaiwan-design-system](https://github.com/Tofuswang/vtaiwan-design-system) 的新視覺設計。API／入口路由用 Hono；畫面每個請求都在伺服端渲染，再由瀏覽器端 vue-router hydration 接管。支援多語（zh-TW / en / ja，vue-i18n）。

## Project goals / 專案目的

- **平行搬移**：把 `vue.vTaiwan-neo`（現行官網）的頁面與功能逐頁移植到本 SSR 專案。尚未實作的頁面先以 placeholder（回 404）佔位，逐步替換。
- **套用新視覺**：以 `vtaiwan-design-system` 為視覺唯一來源，**只收斂 design token** 進 `src/styles/app.css`，用 token / Tailwind 工具類別，不硬寫顏色數值。
- **動態功能策略**：現階段 SSR 只出靜態骨架，動態資料（原站的登入、Topics、Blogs、Polis、轉錄等）在瀏覽器端 hydration 後才抓。
- **多 repo 工作區**：本專案與 `../vtaiwan-design-system`（視覺參考）、`../vue.vTaiwan-neo`（功能／內容來源，`2026-new-UI` 分支）並列於同一 workspace（見 `vTaiwan-hono.code-workspace`）。`./pull-all.sh` 會依序 `git pull` 這三個 repo。

> 本專案之後**可能**把成果回貢獻到 `vue.vTaiwan-neo` 的 `2026-new-UI` 分支，但現階段為單向取材，尚未定義回饋流程。

## Routes / 路由

| Route                                                                                 | Status | EN                                                                   | 中文                                                     |
| ------------------------------------------------------------------------------------- | ------ | -------------------------------------------------------------------- | -------------------------------------------------------- |
| `/`                                                                                   | 200    | Home — vTaiwan design system, dark hero, three civic colors          | 首頁 — vTaiwan 設計系統、黑底 Hero、三種公民色           |
| `/about`, `/intro`                                                                    | 200    | About page                                                           | 關於頁                                                   |
| `/word/:w`                                                                            | 200    | Dynamic page; `og:image` is `https://www.moedict.tw/{w}.png`         | 動態頁；`og:image` 為 `https://www.moedict.tw/{w}.png`   |
| `/hundred`                                                                            | 200    | 10×10 grid (1–100), multiples highlighted; hydrated interactive page | 百數表（10×10，1～100）、倍數著色；hydration 後可互動    |
| `/privacy`                                                                            | 200    | Privacy policy                                                       | 隱私權政策                                               |
| `/terms`                                                                              | 200    | Terms of service                                                     | 服務條款                                                 |
| `/topics`, `/meetups`, `/blogs`, `/newsletters`, `/mastodon`, `/faq`, `/contributors` | 404    | Placeholders — routed to `NotFound`, awaiting migration              | 尚未搬移的頁面，暫以 `NotFound` 佔位、回 404             |
| `/api/hello`                                                                          | 200    | Returns `Hello World!` (plain Hono, no SSR)                          | 回傳 `Hello World!`（純 Hono，不走 SSR）                 |
| `*`                                                                                   | 404    | Static files → `ASSETS` binding; unknown page-like URLs → `NotFound` | 靜態檔交給 `ASSETS` 綁定；未知的頁面 URL 交給 `NotFound` |

## Stack / 技術棧

- [Hono](https://hono.dev) — Worker 與路由 / the worker & router
- [Vue 3](https://vuejs.org) + `@vue/server-renderer` + [Vue Router](https://router.vuejs.org) — SSR + hydration 後的 SPA 路由
- [vue-i18n](https://vue-i18n.intlify.dev) — 多語（zh-TW / en / ja）/ i18n
- [Vite](https://vite.dev) + `@vitejs/plugin-vue` + `@cloudflare/vite-plugin` — 建置與本機開發 / build & dev
- [Tailwind CSS v4](https://tailwindcss.com) — 樣式，以獨立 CLI 編譯輸出到 `public/styles.css` / styling via standalone CLI
- [Wrangler](https://developers.cloudflare.com/workers/wrangler/) — 部署 / deploy（Cloudflare Workers）

## Layout / 目錄結構

```
src/
├── index.ts             # Hono worker entry — API, static assets, SSR fallback / Worker 入口
├── app.ts               # createSSRApp + vue-router + vue-i18n factory / 建立 app、router、i18n
├── App.vue              # RouterView root / router 根元件
├── router/
│   └── routes.ts        # route table + status/head helpers + placeholder 404 paths / 路由表
├── ssr/
│   ├── render.ts        # renderToString → full HTML page / 產出完整 HTML
│   └── heads.ts         # per-route <title> / OG meta builders / 各路由的 head
├── views/               # 頁面 / pages
│   ├── Home.vue
│   ├── About.vue
│   ├── Word.vue
│   ├── HundredChart.vue
│   ├── Privacy.vue
│   ├── Terms.vue
│   └── NotFound.vue
├── components/
│   ├── NavBar.vue           # 毛玻璃導覽列（RouterLink + mobile state）/ glass header
│   ├── LanguageSwitcher.vue # 語言切換（zh-TW / en / ja）/ locale switcher
│   ├── Footer.vue           # 深色頁尾 / dark footer
│   ├── FooterNavLink.vue
│   └── FooterLinkIcon.vue
├── i18n/
│   └── index.ts         # createAppI18n + locale 偵測/持久化（僅瀏覽器端）/ i18n factory
├── l10n/                # 翻譯 JSON（三檔同步）/ translation JSON (keep in sync)
│   ├── zh-TW.json
│   ├── en.json
│   └── ja.json
├── client/
│   └── app-entry.ts     # browser entry — hydrate + sync head after navigation / hydration 入口
└── styles/
    └── app.css          # Tailwind v4 source — @theme design tokens / 樣式與 token 來源
vite.config.mts          # server build (Worker) / 伺服端建置
vite.client.config.mts   # client build — hydration bundle only / 僅輸出 hydration bundle
wrangler.jsonc           # Cloudflare Workers config / Cloudflare 設定
pull-all.sh              # git pull this repo + sibling repos / 同步本專案與 sibling repo
public/                  # static assets, served via ASSETS binding / 靜態資源
├── styles.css           # generated — gitignored / 自動產生，不納入版控
├── js/app.js            # generated — gitignored / 自動產生，不納入版控
├── js/app.css           # generated — gitignored / 自動產生，不納入版控
├── img/, assets/        # icons, logo / 圖示與 logo
└── favicon.ico
```

## i18n / 多語系

**EN:** Three locales — `zh-TW` (default), `en`, `ja` — served through vue-i18n. UI strings must go through translations (`$t('key')` in templates; `const { t } = useI18n()` in `<script setup>`); don't hard-code display text. **When you add any UI string, add the same key to all three files** `src/l10n/{zh-TW,en,ja}.json`. A per-request i18n instance is created in `createAppI18n` (see `src/i18n/index.ts`) to avoid SSR cross-request state leakage; locale detection / persistence (`localStorage`, `navigator`) runs **only in the browser**. Users switch locale via `LanguageSwitcher.vue`.

**中文：**三種語言 — `zh-TW`（預設）、`en`、`ja`，走 vue-i18n。介面文字一律用翻譯（模板 `$t('key')`；`<script setup>` 內 `const { t } = useI18n()`），不要寫死。**新增任何介面文字時，`src/l10n/{zh-TW,en,ja}.json` 三個檔都要加上相同 key**，值各自翻譯。i18n 於 `createAppI18n`（見 `src/i18n/index.ts`）每請求新建實例，避免 SSR 跨請求狀態污染；語言偵測與持久化（`localStorage`、`navigator`）只在瀏覽器端執行。使用者透過 `LanguageSwitcher.vue` 切換語言。

## Generated assets / 自動產生的靜態檔

下列檔案**不納入 Git**（見 `.gitignore`），clone 後需自行建置：

| File                | Command / 產生方式                                                                      |
| ------------------- | --------------------------------------------------------------------------------------- |
| `public/styles.css` | `npm run build:css` — Tailwind CLI，來源 `src/styles/app.css`                           |
| `public/js/app.js`  | `vite build -c vite.client.config.mts`（含在 `npm run build`）— 瀏覽器 hydration bundle |
| `public/js/app.css` | 同上 client build 一併輸出                                                              |

**EN:** After `git clone`, run `npm install` then `npm run build` (all three) or `npm run dev` (runs `predev` → `build:css` only; production hydration still needs a full `npm run build` before deploy). `npm run deploy` runs the full build then `wrangler deploy`.

**中文：**`git clone` 後先 `npm install`，再 `npm run build`（一次產生上述三個檔），或 `npm run dev`（僅透過 `predev` 編譯 `styles.css`；正式環境 hydration 仍須在部署前跑完整 `npm run build`）。`npm run deploy` 會先完整 build 再部署。

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
npm run dev          # vite dev — 本機跑 Worker，含 HMR / runs the worker locally with HMR
                   # `predev` 會先把 src/styles/app.css 編譯成 public/styles.css
npm run watch:css    # (另開終端機) 監看 .vue 變更並即時重編 Tailwind 樣式
npm run typecheck    # tsc --noEmit — 型別檢查 / type-check
```

> **EN:** `npm run dev` rebuilds `public/styles.css` once on start (via `predev`). When you add or change Tailwind classes in `.vue` files during a session, run `npm run watch:css` in a second terminal so the stylesheet stays in sync.
>
> **中文：**`npm run dev` 啟動時會（透過 `predev`）重新編譯一次 `public/styles.css`。開發過程中若在 `.vue` 增修 Tailwind class，請另開終端機跑 `npm run watch:css`，樣式才會即時更新。

### Verify / 驗證（改完必做）

1. `npm run typecheck` — 應為零錯誤 / zero errors.
2. `npm run build` — 確認 CSS + server + client 都能成功建置 / all builds succeed.
3. `npm run dev` 目視 — 確認 SSR 首屏正確、hydration 無 mismatch 警告（檢查 devtools console）。

> 本 repo 目前**沒有測試框架**（`npm run test` 不存在）。日後視需要再導入 Vitest / SSR 煙霧測試。

## Formal Verification / 形式驗證（LemmaScript）

關鍵的純函式已加上 [LemmaScript](https://viteplus.dev/) `//@ ` 形式不變量，可透過 [Dafny](https://dafny.org/) 機器驗證。

Key pure functions are annotated with [LemmaScript](https://viteplus.dev/) `//@ ` invariants and can be formally verified via [Dafny](https://dafny.org/).

### 已加注的檔案 / Annotated files

| 檔案 / File | 不變量 / Invariants |
|-------------|---------------------|
| `src/ssr/heads.ts` | `buildOg` → 恆輸出 10 個 MetaEntry；`headFor*` → title 非空、`meta.length === 10`；`renderHeadTags` → output 含 charset、title、viewport |
| `src/i18n/index.ts` | `isSupportedLocale` ↔ value ∈ `{"zh-TW","en","ja"}`；`detectPreferredLocale` → 回傳值恆為合法 locale |
| `src/router/routes.ts` | `statusForRoute` → 回傳 meta.status 或 200；`headForRoute` → 恆回傳合法 HeadConfig |
| `src/lib/discourse.ts` | `getJson` → path 非空、in-flight 去重；`getAllCategoryTopics` → categoryUri 非空 |

### 執行 / Commands

```bash
# 重新從 TS 生成 Dafny 驗證基底（不需要安裝 Dafny）
# Regenerate .dfy.gen from annotated TS — no Dafny needed
npm run lemma:gen

# 跑 Dafny 驗證（需另外安裝 Dafny >= 4.x）
# Run Dafny verification — requires Dafny >= 4.x
npm run lemma:check
```

**安裝 Dafny / Install Dafny：** 見 [dafny.org/dafny/Installation](https://dafny.org/dafny/Installation)。`lsc` 本身由 `npm install -g lemmascript` 安裝，已包含在本機環境。

### 檔案角色 / File roles

| 檔案 | 追蹤 | 說明 |
|------|------|------|
| `src/**/*.dfy` | ✅ git tracked | 驗證基底 + 可加入 proof additions |
| `src/**/*.dfy.gen` | 🚫 gitignored | 每次 `lemma:gen` 自動重生，不納入版控 |

### 加注語法速查 / Annotation syntax

```typescript
function foo(x: string): Result {
  //@ verify          // 標記此函式進行驗證 / opt in for verification
  //@ requires x.length > 0
  //@ ensures \result.field === 10
  //@ autohavoc       // 將不可建模的外部呼叫（如 t()）抽象為任意值
  //@ contract 自然語言說明函式意圖（prover 忽略，lsc extract 使用）
  ...
}

while (condition) {
  //@ invariant i >= 0 && i <= arr.length
  //@ decreases arr.length - i
  ...
}
```

完整語法見 [LemmaScript SPEC.md](https://github.com/midspiral/LemmaScript/blob/main/SPEC.md)。

## Deploy / 部署

```bash
npm run deploy       # 完整 build（含 hydration bundle）+ wrangler deploy
```

## Adding a page / 新增頁面

**EN**

1. Create a `.vue` file in `src/views/`.
2. Add a `headForX(...)` function in `src/ssr/heads.ts`.
3. Add a vue-router route in `src/router/routes.ts` (**static import** the component — not lazy — so it bundles into SSR), set `meta.status`, remove it from `placeholderPaths` if present, and add a `case` in `headForRoute(...)`:

   ```ts
   {
     path: '/foo',
     name: 'foo',
     component: FooView,
     meta: { status: 200 },
   }
   ```

4. Add the page's UI strings to all three `src/l10n/{zh-TW,en,ja}.json` files.
5. Use `<RouterLink>` for internal links so navigation stays inside the hydrated app.

**中文**

1. 在 `src/views/` 新增 `.vue` 檔。
2. 在 `src/ssr/heads.ts` 新增 `headForX(...)` 函式。
3. 在 `src/router/routes.ts` 新增 route（元件用**靜態 import**、非 lazy，SSR 打包需要），設 `meta.status`，若原本在 `placeholderPaths` 就移除，並在 `headForRoute(...)` 補上對應 `case`。
4. 把頁面的介面文字補進 `src/l10n/{zh-TW,en,ja}.json` 三個檔。
5. 站內連結使用 `<RouterLink>`，導覽才會留在 hydrated app 裡。

## Hydration + vue-router / 全站 hydration

**EN:** Hono keeps `/api/*` endpoints and static asset handling. All page-like GET requests are rendered through `src/ssr/render.ts`: the server creates a memory-history router, pushes the incoming URL, renders the matched view, injects `/src/client/app-entry.ts` in dev or `/js/app.js` in production, and returns the route status. After hydration, Vue Router uses `createWebHistory()` so internal navigation does not reload the document.

**中文：**Hono 保留 `/api/*` 與靜態檔處理。所有像頁面的 GET 請求都走 `src/ssr/render.ts`：伺服器建立 memory-history router、push 目前 URL、渲染符合的 view，開發時注入 `/src/client/app-entry.ts`，正式環境注入 `/js/app.js`，並回傳該 route 狀態碼。Hydration 後 Vue Router 使用 `createWebHistory()`，站內導覽不會重新載入整份文件。

> **SSR 安全**：任何在 SSR 期間執行的程式碼都不得碰 `window` / `document` / `localStorage` / `navigator`，且每請求要用獨立實例。詳見 [`AGENTS.md`](./AGENTS.md)。

## Dynamic HEAD / 動態 `<head>`

**EN:** Each route builds a `HeadConfig` (title + meta) before rendering. `/word/:w` sets `og:image` to `https://www.moedict.tw/{w}.png` — see `headForWord` in `src/ssr/heads.ts`. The client re-syncs `document.title` / meta after each navigation (see `syncHead` in `app-entry.ts`).

**中文：**每個路由在渲染前會組出 `HeadConfig`（標題與 meta）。`/word/:w` 會把 `og:image` 設成 `https://www.moedict.tw/{w}.png`，見 `src/ssr/heads.ts` 的 `headForWord`。瀏覽器端每次導覽後會重新同步 `document.title` 與 meta（見 `app-entry.ts` 的 `syncHead`）。

## Styling — Tailwind CSS / 樣式

**EN:** Styling uses **Tailwind CSS v4**. Because the worker server-renders an HTML _string_ and links a static `<link rel="stylesheet" href="/styles.css">`, Tailwind runs through its **standalone CLI** (not the Vite plugin): `src/styles/app.css` is the source, compiled to `public/styles.css`, served by the `ASSETS` binding.

- `src/styles/app.css` — `@import "tailwindcss"`, an `@theme` block exposing the vTaiwan **design tokens** consolidated from `vtaiwan-design-system` (civic colors `--color-vt-democratic-red` / `-jade-green` / `-wheat-yellow`, Noto Serif / Sans TC, type scale, spacing, radii). Prefer the `vt-*` utilities (e.g. `text-vt-democratic-red`, `bg-vt-bg-2`, `font-vt-serif`); **legacy aliases** (`democratic-red`, `font-serif`, …) are kept for existing templates. A few `@layer components` effects (hero gradient, glass header `.vt-glass`, pill buttons `.vt-btn*`, title underline `.vt-title-underline`) plus legacy `.container` / `.hundred-*` styles live here too.
- `npm run build:css` — compile + minify to `public/styles.css`.
- `npm run watch:css` — rebuild on `.vue` changes during development.
- Don't hard-code color / size values — use tokens. Don't edit the generated `public/styles.css` by hand.

**中文：**樣式採用 **Tailwind CSS v4**。由於 Worker 是伺服端渲染 HTML _字串_、再以 `<link rel="stylesheet" href="/styles.css">` 載入靜態樣式，因此 Tailwind 以**獨立 CLI**（非 Vite plugin）編譯：來源 `src/styles/app.css`，編譯成 `public/styles.css`，由 `ASSETS` 綁定提供。

- `src/styles/app.css` — `@import "tailwindcss"`、`@theme` 定義由 `vtaiwan-design-system` 收斂進來的 **design token**（民主紅 `--color-vt-democratic-red`、青玉綠 `-jade-green`、麥穗黃 `-wheat-yellow`，Noto Serif / Sans TC，字級、間距、圓角）。優先用 `vt-*` 工具類別（如 `text-vt-democratic-red`、`bg-vt-bg-2`、`font-vt-serif`）；既有樣板用的 **legacy 別名**（`democratic-red`、`font-serif` 等）已保留。另含少數 `@layer components` 效果（hero 漸層、毛玻璃 `.vt-glass`、pill 按鈕 `.vt-btn*`、標題紅底線 `.vt-title-underline`）與既有的 `.container` / `.hundred-*` 樣式。
- `npm run build:css` — 編譯並壓縮輸出到 `public/styles.css`。
- `npm run watch:css` — 開發時監看 `.vue` 變更並即時重編。
- **不要硬寫顏色 / 尺寸數值**，一律用 token；也不要手動修改自動產生的 `public/styles.css`。

## License / 授權

MIT — 詳見 [LICENSE](./LICENSE) / see [LICENSE](./LICENSE).
