# AGENTS.md

給 AI coding agent 的工作指引。本檔聚焦「**agent 該怎麼在這個 repo 工作**」；一般的部署與內容說明請看 [`README.md`](./README.md)。

## 專案目的

以 **SSR** 的方式，把現有 `vue.vTaiwan.tw`（對應 `vue.vTaiwan-neo`）的**所有頁面與功能平行搬移**過來，並套用 [`vtaiwan-design-system`](../vtaiwan-design-system) 的新視覺設計。

- **視覺來源**：`../vtaiwan-design-system`（新視覺／設計 token 的唯一參考）。
- **功能／內容來源**：`../vue.vTaiwan-neo`（現行官網，`2026-new-UI` 分支）。
- **回饋 neo（暫緩）**：本專案之後**可能**把成果回貢獻到 neo 的 `2026-new-UI` 分支，但**現階段為單向取材**——先不定義回饋流程，也不要為了「方便回貢獻」而扭曲 hono 的寫法。日後要回饋時再另議。

## 技術棧

**Hono + Vue 3 SSR + Cloudflare Workers**。核心：

- **伺服器**：Hono（`src/index.ts`），部署到 Cloudflare Workers（Wrangler）。
- **渲染**：`@vue/server-renderer` 的 `renderToString`，搭配 `createSSRApp` 做首屏 SSR，瀏覽器端 hydration 接管。
- **路由**：`vue-router`（SSR 用 `createMemoryHistory`，client 用 `createWebHistory`）。
- **多語**：`vue-i18n`（每請求獨立實例，見下）。
- **樣式**：Tailwind CSS v4（CLI 建置到 `public/styles.css`）。

## 常用指令

```bash
npm install        # 安裝依賴
npm run dev        # 本機開發（predev 會先 build:css）
npm run build:css  # tailwindcss CLI：src/styles/app.css → public/styles.css
npm run watch:css  # 監看模式重建 CSS
npm run build      # build:css + vite build（server）+ vite build client
npm run preview    # 預覽建置結果
npm run typecheck  # tsc --noEmit 型別檢查
npm run lemma:gen  # LemmaScript：重新生成 Dafny 驗證基底（不需安裝 Dafny）
npm run lemma:check # LemmaScript：執行 Dafny 形式驗證（需安裝 Dafny >= 4.x）
npm run deploy     # build + wrangler deploy（除非使用者要求，否則不要執行）
npm run cf-typegen # 由 wrangler 產生 Cloudflare 綁定型別
```

> **CSS 是獨立產物**：`app.css` 改了要跑 `build:css`（或開 `watch:css`）才會反映到 `public/styles.css`。`dev` 只在啟動時 build 一次。

## 語言與溝通慣例

- **程式碼識別字、技術用語 → 英文**（變數、函式、型別名稱等）。
- **註解、commit 訊息、對使用者的回覆 → 繁體中文**。延續現有 repo 風格。

## 動工前的原則（重要）

- **禁止憑空臆測。** 遇到模糊、不完整或有歧義的指令，先反覆與使用者核對清楚，確認後才動工——不要自行假設需求就開始改。
- 動大結構、加新工具鏈（如測試框架、Firebase SDK）前先說明並確認。

## SSR 架構（動工前務必理解）

請求流向（`src/index.ts` → `src/ssr/render.ts` → `src/app.ts` → client `src/client/app-entry.ts`）：

1. Hono `app.get('*')`：**有副檔名**的路徑（`.css/.js/.svg/.png…`）交給 `ASSETS` 綁定（對應 `public/`）；其餘走 SSR。`/api/*` 這類純資料端點直接在 Hono 回傳，不走 SSR。
2. `renderPage(url, origin)`：`createVueApp(url)` → `router.isReady()` → `renderToString(app)`，組出完整 HTML 殼（含 `<head>` meta 與 `<div id="app">`），並依路由 `meta.status` 回傳 HTTP 狀態碼。
3. Client `app-entry.ts`：`router.isReady()` 後 `app.mount('#app', true)` 做 hydration，並在每次 `afterEach` 用 `headForRoute` 同步 `document.title` / meta。

### 🚫 SSR 安全（硬性規定）

**任何在 SSR 期間執行的程式碼（元件 setup、模組頂層、`app.ts`／`i18n`）都不得碰瀏覽器專屬 API**（`window`、`document`、`localStorage`、`navigator`）。

- 需要瀏覽器 API 時，用 `if (typeof window === 'undefined') return` 守衛，或放到 `onMounted` / client-only 流程。參考 `src/i18n/index.ts`：`createAppI18n` 刻意不讀 `localStorage`／`navigator`，偏好偵測拆到只在瀏覽器端跑的 `detectPreferredLocale` / `persistLocale`。
- **每請求要用獨立實例**（i18n、router、app 皆由 `createVueApp` 每次新建），避免 SSR 跨請求狀態污染。

### 動態功能策略（現階段）

原站的動態功能（Firebase 登入、Topics、Blogs、Polis、轉錄等）**現階段一律「SSR 只出靜態殼、資料在 hydration 後於瀏覽器端才抓」**。

- SSR 負責可預先渲染的骨架 / 版面；動態資料在 client mount 後再 fetch 並填入。
- 尚未實作的頁面先掛在 `routes.ts` 的 `placeholderPaths`（回 404 的 `NotFound`），逐步替換成真頁。
- 現階段**不要**在 Worker 端直接接 Firebase / 外部 API 做完整動態 SSR，也**不要**引入 Firebase SDK；要改這個策略先跟使用者確認。

## 新增一個頁面（核心重複工作）

1. `src/views/XxxView.vue` — 新頁面元件（`<script setup lang="ts">`）。
2. `src/router/routes.ts` — 加一筆 route（**靜態 import 元件**，非 lazy——SSR 打包需要），設 `meta.status`；若原本在 `placeholderPaths` 要移除該筆。
3. `src/ssr/heads.ts` — 新增 `headForXxx(origin)`，並在 `routes.ts` 的 `headForRoute` switch 補上對應 `case`。
4. `src/l10n/{zh-TW,en,ja}.json` — **三檔同步**補齊介面文字 key。
5. 驗證：`npm run typecheck` + `npm run build`，`npm run dev` 目視 SSR 與 hydration。

## 設計系統：只收斂 design token

套用新視覺的方式是**把 `../vtaiwan-design-system/project/colors_and_type.css` 的設計變數收斂進 `src/styles/app.css` 的 `@theme`**，模板一律用這些 token / Tailwind 工具類別，**不硬寫顏色、字級、間距數值**。

- Token 命名：主用 `--color-vt-*`、`--font-vt-*`、`--text-vt-*`、`--spacing-vt-*`、`--radius-vt-*` 等（對應 `text-vt-democratic-red`、`bg-vt-bg-2`、`font-vt-serif` 這類工具類別）。
- **既有樣板用的 legacy 別名**（`text-democratic-red`、`font-serif`、`bg-jade-green/10` 等）在 `app.css` 已保留對應——沿用即可，不用一次全換。
- 少數難用工具類別表達的效果（hero 漸層、frosted glass header、pill 按鈕 `.vt-btn*`、標題紅底線 `.vt-title-underline`）放在 `app.css` 的 `@layer components`。
- **元件外觀自行對齊即可**：以 token 為準重刻頁面／元件，**不要求**逐一照抄 `vtaiwan-design-system` 內的 `_source_reference` SFC；那些檔案與 `project/preview/*.html` 當作視覺規格參考。
- 新增 token 時：先在 `app.css` 的 `@theme` 定義，再於模板使用，然後 `npm run build:css`。

## i18n（多語系）

- 支援 `zh-TW` / `en` / `ja`（見 `src/i18n/index.ts` 的 `supportedLocales`，預設 `zh-TW`）。
- 介面文字一律走翻譯：模板用 `$t('key')`，`<script setup>` 內 `const { t } = useI18n()` 後用 `t('key')`。不要寫死字串。
- **三檔同步（硬性規定）**：新增任何介面文字時，`src/l10n/zh-TW.json`、`en.json`、`ja.json` **三個檔都要加上相同 key**，值各自翻譯。key 用點號分層（如 `header.home`、`about.mission.title`）。
- 語言偵測 / 持久化只在瀏覽器端（`detectPreferredLocale` / `persistLocale`），SSR 一律用預設 locale——別把偵測邏輯拉進 SSR 路徑。

## 專案結構

- `src/index.ts` — Hono 進入點（Worker `fetch`）；靜態檔 vs SSR 分流、`/api/*` 端點。
- `src/ssr/render.ts` — SSR 主流程（組 HTML 殼）。
- `src/ssr/heads.ts` — 各頁 `<head>` / meta 設定與 `renderHeadTags`。
- `src/app.ts` — `createVueApp`（SSR / client 共用的 app + router + i18n 工廠）。
- `src/client/app-entry.ts` — 瀏覽器端 hydration 進入點。
- `src/router/routes.ts` — 路由表、`statusForRoute`、`headForRoute`。
- `src/views/` — 各頁面（`XxxView.vue`）。
- `src/components/` — 共用元件（NavBar、Footer、LanguageSwitcher 等）。
- `src/i18n/index.ts` + `src/l10n/*.json` — 多語（zh-TW / en / ja 三檔同步）。
- `src/styles/app.css` — Tailwind v4 source + 設計 token（建置到 `public/styles.css`）。
- `public/` — 靜態資產（由 `ASSETS` 綁定提供）。
- `vite.config.mts`（server build）、`vite.client.config.mts`（client build）、`wrangler.jsonc`（Cloudflare）。

## 驗證流程（改完必做）

**現階段：**

1. `npm run typecheck` — `tsc --noEmit`，應為零錯誤。
2. `npm run build` — 確認 CSS + server + client 都能成功建置。
3. `npm run dev` 目視 — 確認 SSR 首屏正確，且 hydration **無 mismatch 警告**（開 devtools console 檢查）。
4. `npm run lemma:gen` — 重新生成 Dafny 驗證基底（`.dfy.gen`），確認 lsc 能正常解析所有加注函式。

> **未來再加**（尚未導入，需先跟使用者確認再動工）：比照 neo 導入 Vitest 補單元測試；以及 SSR 輸出 / hydration 一致性的煙霧測試。目前本 repo **沒有測試框架**，別假設 `npm run test` 存在。

## LemmaScript 形式驗證

本專案以 [LemmaScript](https://viteplus.dev/) 對純函式加注形式不變量（`//@ requires` / `//@ ensures` / `//@ invariant`），並可透過 Dafny 機器驗證。

### 已加注的模組

| 檔案 | 主要不變量 |
|------|-----------|
| `src/ssr/heads.ts` | `buildOg` → `\result.length === 10`；`headFor*` → `\result.title.length > 0` 且 `\result.meta.length === 10`；`renderHeadTags` → output 含 charset、title、viewport |
| `src/i18n/index.ts` | `isSupportedLocale` ↔ value ∈ `{"zh-TW","en","ja"}`；`detectPreferredLocale` → 回傳值恆為合法 locale |
| `src/router/routes.ts` | `statusForRoute` → `\result === 200 || \result === route.meta.status`；`headForRoute` → 恆有效 |
| `src/lib/discourse.ts` | `getJson` → `requires path.length > 0`；in-flight 去重 contract |

### 執行方式

```bash
# 重新從 TS 生成 .dfy.gen（不需安裝 Dafny）
npm run lemma:gen

# 形式驗證（需安裝 Dafny >= 4.x，見 https://dafny.org/dafny/Installation）
npm run lemma:check
```

### 加注規則（agent 需遵守）

- **新增 `headFor*` 函式**時，必須在函式體第一行加上：
  ```typescript
  //@ verify
  //@ autohavoc
  //@ requires origin.length > 0
  //@ ensures \result.title.length > 0
  //@ ensures \result.meta.length === 10
  ```
  加完後跑 `npm run lemma:gen` 確認 lsc 能正常解析。

- **加注語法**：`//@ ` 開頭（注意 `@` 後有空格）；只能放在函式 / 迴圈 body 第一行。
  - `//@ verify` — 標記函式納入驗證（brownfield 模式下必填）
  - `//@ requires <expr>` — 前置條件
  - `//@ ensures \result <expr>` — 後置條件（`\result` 指回傳值）
  - `//@ invariant <expr>` — 迴圈不變量
  - `//@ autohavoc` — 將不可建模的外部呼叫（如 `t()`）抽象為任意值
  - `//@ contract <text>` — 自然語言意圖說明（prover 忽略，文件用）

- **`.dfy` vs `.dfy.gen`**：
  - `.dfy.gen` — gitignored，每次 `lemma:gen` 覆寫，**不要手改**。
  - `.dfy` — tracked，可加 proof additions，diff 只能是新增行。

- **regex / Promise / DOM 無法建模**：含 regex literal、`localStorage`、多行 lambda 的函式跳過 `//@ verify`，改用 `//@ ensures` 作純文件標注。

## 多 repo 工作區

本專案在一個三 repo 的 VS Code workspace（`vTaiwan-hono.code-workspace`）：

- `.`（本專案，vTaiwan-hono）
- `../vue.vTaiwan-neo`（功能／內容來源，`2026-new-UI` 分支）
- `../vtaiwan-design-system`（新視覺參考）

`./pull-all.sh` 會依序 `git pull` 這三個 sibling repo。要參考原站行為或新視覺時，直接讀對應 sibling repo 的檔案。

## Git / Commit 慣例

- **Conventional Commits + 繁體中文描述**，例如：
  - `feat: 平行搬移電子報列表頁（SSR）`
  - `fix: 修正 LanguageSwitcher 在 SSR 下讀取 localStorage`
  - `chore(deps): 升級 hono`
- 常見前綴：`feat`、`fix`、`chore`、`refactor`、`style`、`docs`。
- 除非使用者明確要求，否則**不要自行 commit / push / deploy**。

## Milestone 規劃

本專案以 GitHub Milestones 追蹤進度：<https://github.com/g0v/vTaiwan-hono/milestones>

| Milestone | 狀態 | 核心目標 | 主要 issues |
|-----------|------|---------|-------------|
| [打樣](https://github.com/g0v/vTaiwan-hono/milestone/1) | ✅ 已完成 | 讓首頁、NavBar、Footer 的視覺對齊 `vtaiwan-design-system`；確保多語言切換不會切版。 | #1 導航列、#2 首頁、#4 Footer、#5 logo/favicon/og、#8 隱私條款頁、#14 LanguageSwitcher bug、#17 Title、#21 make.vtaiwan.tw 連結 |
| [MVP](https://github.com/g0v/vTaiwan-hono/milestone/2) | ✅ 已完成 | **即時會議以外**的所有頁面與功能全部完工，可正式部署取代現行站。 | #3 hydration/vue-router、#10 vue-i18n、#11 共用元件、#12 Manifest、#15 語言偵測、#16 議題頁、#18 Title i18n、#20 三個文章頁（含後端 proxy）、#23 貢獻者/FAQ 靜態頁 |
| [完整功能](https://github.com/g0v/vTaiwan-hono/milestone/3) | 🚧 進行中（預計 10 月初） | 完成即時會議（JAAS worker + 轉錄 worker）及其餘收尾項目，達成功能完整搬移。 | open: #24 會議頁、#25 所有路由 alias、#28 CORS 標頭、#29 即時會議；closed: #13 登入、#19 lazy-import、#22 hydration fix |
| [實作自動測試](https://github.com/g0v/vTaiwan-hono/milestone/5) | 📋 待開始 | 尚無 issue，細節待定。動工前先與使用者確認範圍。 | — |
| [從 Firebase 搬移到全 Cloudflare](https://github.com/g0v/vTaiwan-hono/milestone/4) | 📋 待開始 | 登入改為 BetterAuth；資料庫改用 D1 / R2；即時校對資料考慮使用 Durable Objects (DO)。進行到此 milestone 前**不要**提前動工。 | — |

> Milestone 有嚴格前後依賴：打樣 → MVP → 完整功能 → 自動測試 → 從 Firebase 搬移到全 Cloudflare。

## Migration 基本原則

從 `vue.vTaiwan-neo`（及其搭配的後端 workers）搬移功能時，遵守以下原則：

### 接口整合
原本分散在**一個前端（vue.vTaiwan-neo）加兩個後端 worker**的所有接口，全部整合進 `vTaiwan-hono` 這個新專案。**新專案不能再打舊專案的外部 worker 路由。**

### 漸進增強
以漸進增強（progressive enhancement）的方式進行搬移——先確保 SSR 靜態殼可用，再逐步加入動態功能，不中斷現有服務。

### 路由完整性
**所有原專案的路由（含 alias 路由）在新專案都必須有對應。** 不能讓舊有連結失效。未完成的頁面先掛 `placeholderPaths`（回 404），上線前補完。

### 什麼不搬
- neo 的開發腳本、CI 配置、測試 fixture——hono 自行維護。
- 有疑問的功能，動工前先問使用者，不臆測。

## 守則與禁區

- ✅ **SSR 安全**——SSR 路徑不碰 `window`/`document`/`localStorage`/`navigator`；每請求用獨立實例。
- ✅ **動態資料 client 端才抓**——SSR 只出靜態殼（現階段策略）。
- ✅ **只收斂 design token**——用 `app.css` 的 `--vt-*` token / 工具類別，不硬寫顏色數值。
- ✅ **i18n 三檔同步**——新增文字時 zh-TW / en / ja 都要有對應 key。
- ✅ **動工前確認需求**——不憑空臆測，模糊就先問清楚。
- 🚫 **不手改 `public/styles.css`**——那是 `build:css` 的產物；改 `src/styles/app.css`。
- 🚫 **不手改 `dist/`**——`npm run build` 的自動產物。
- 🚫 **不引入 Firebase SDK / Worker 端動態 SSR**——除非先確認要改動態策略。
- 🚫 **不提交機密**——金鑰等不進 git。
