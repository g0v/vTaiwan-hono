# AGENTS.md

給 AI coding agent 的工作指引。本檔聚焦「**agent 該怎麼在這個 repo 工作**」；一般的部署與內容說明請看 [`README.md`](./README.md)。

## 專案目的

以 **SSR** 的方式，把現有 `vue.vTaiwan.tw`（對應 `vue.vTaiwan-neo`）的**所有頁面與功能平行搬移**過來，並套用 [`vtaiwan-design-system`](../vtaiwan-design-system) 的新視覺設計。

- **視覺來源**：`../vtaiwan-design-system`（新視覺／設計 token 的唯一參考）。
- **功能／內容來源**：`../vue.vTaiwan-neo`（現行官網，`2026-new-UI` 分支）。
- **回饋 neo（暫緩）**：本專案之後**可能**把成果回貢獻到 neo 的 `2026-new-UI` 分支，但**現階段為單向取材**——先不定義回饋流程，也不要為了「方便回貢獻」而扭曲 hono 的寫法。日後要回饋時再另議。

## 不可妥協的不變量（Non-negotiable invariants）

違反任何一條就是破壞專案的根本契約。動手前先讀，改完後逐條自查。

1. **SSR 路徑絕不碰瀏覽器 API。** 任何在 SSR 期間執行的程式碼（元件 setup、模組頂層、`app.ts`／`i18n`）不得使用 `window`／`document`／`localStorage`／`navigator`——需要時用 `typeof window === 'undefined'` 守衛或放到 `onMounted`。每請求由 `createVueApp` 新建獨立實例（app／router／i18n），嚴禁跨請求共享可變狀態。
2. **SSR 只出靜態殼，動態資料 hydration 後才抓。** 不在 Worker 端接外部 API 做動態 SSR；登入態一律由 client mount 後打 `/api/me` 取得。要改這個策略，先與使用者確認。（Firebase 已於 #81 全數移除，專案不再有任何 Firebase 相依。）
3. **路由完整性與靜態 import。** 原站所有路由（含 alias）在本專案都必須有對應，未完成頁掛 `placeholderPaths`（404）——**舊連結永不失效**。路由元件一律靜態 import（lazy import 會造成 hydration mismatch，SSR 打包也需要靜態表）。
4. **i18n 三檔同步，介面文字一律走翻譯。** `zh-TW`／`en`／`ja` 的 key 集合必須完全一致（`vp test` 機器把關）；模板與程式不寫死介面字串。
5. **視覺只用 design token。** 顏色、字級、間距一律走 `app.css` `@theme` 的 `--vt-*` token 或既有工具類別，不硬寫數值。
6. **生成物不手改。** `public/styles.css`、`dist/`、`*.dfy.gen`、`worker-configuration.d.ts` 皆為建置產物——改源頭重新生成。唯一例外：tracked 的 `.dfy` 允許「只新增行」的 proof additions（見 LemmaScript 章節）。
7. **Vite+ 是唯一專案介面。** 指令一律走 `vp`（`vp run`／`vp exec`／`vp install`）；不要繞過 vp 直呼全域工具或改用其他套件管理器。版本鎖定見「工具鏈版本」。
8. **形式標注與測試必須誠實。** `//@` 標注只加真的會被 Dafny 驗證的（`lemma:check` 看到 `verified` 才算數），不可建模就用一般註解——doc-only 標注是偽裝的形式規格。測試必須斷言可觀察行為，恆真測試視同缺陷。
9. **完成 = 全部綠燈。** `vp check`、`vp test`、`vp run build`、`vp run lemma:gen` 全過才算改完（本機有 Dafny 時加跑 `lemma:check`；CI 必跑）。紅燈狀態不 commit。
10. **機密不進 git；不擅自 push／deploy。** `.dev.vars` 等憑證只留本地。commit／push／deploy 的界線與長程 checkpoint 例外，見「Git / Commit 慣例」。

## 技術棧

**Hono + Vue 3 SSR + Cloudflare Workers**。核心：

- **伺服器**：Hono（`src/index.ts`），部署到 Cloudflare Workers（Wrangler）。
- **渲染**：`@vue/server-renderer` 的 `renderToString`，搭配 `createSSRApp` 做首屏 SSR，瀏覽器端 hydration 接管。
- **路由**：`vue-router`（SSR 用 `createMemoryHistory`，client 用 `createWebHistory`）。
- **多語**：`vue-i18n`（每請求獨立實例，見下）。
- **樣式**：Tailwind CSS v4（CLI 建置到 `public/styles.css`）。
- **登入／授權**：Better Auth（Google／GitHub OAuth + admin plugin），資料落在 D1 `DB_AUTH`；詳見「Admin 介面與 Better Auth」章節。
- **資料**：D1（`DB` 逐字稿與審計表、`DB_AUTH` 認證）、R2（逐字稿與版本檔）、Workers AI（大綱生成）、Durable Object `MeetingRoom`（即時會議逐字稿，WebSocket）。
- **建置工具**：VitePlus（`vp`）——本專案的 `vite` 指向 `@voidzero-dev/vite-plus-core`；`vp run dev` / `vp preview` 走 `vp` CLI，`vp run build` 走雙設定檔（`vite.config.mts` server build + `vite.client.config.mts` client build）。`vp` 同時提供 `lsc`（LemmaScript）形式驗證工具（見「LemmaScript 形式驗證」章節）。

## 工具鏈版本

| 工具                 | 版本                     | 鎖定位置                                          |
| -------------------- | ------------------------ | ------------------------------------------------- |
| npm（套件管理）      | 12.0.1                   | `devEngines`（onFail: download，由 Vite+ 供裝）   |
| Vite+（`vp`）        | 0.2.4（exact）           | `devDependencies` + `overrides`（vite 指向 core） |
| LemmaScript（`lsc`） | ^0.5.13                  | `devDependencies`                                 |
| TypeScript           | ^5.6                     | `devDependencies`                                 |
| Tailwind CSS         | ^4.3（v4 CLI）           | `devDependencies`                                 |
| Wrangler             | ^4.83                    | `devDependencies`                                 |
| Vue / vue-i18n       | ^3.5 / ^11.4             | `dependencies`                                    |
| Dafny（形式驗證）    | CI 固定 4.9.0；本機 >= 4 | `.github/workflows/ci.yml`（setup-dafny-action）  |

> 升級 Vite+ / LemmaScript / Dafny 前先告知使用者——三者互相咬合（`vp` 供裝 `lsc`、`lsc` 生成的 Dafny 語法隨版本變化），升級後必跑 `vp run lemma:check` 確認 VCs 仍全數通過。

## 常用指令

```bash
vp install                  # 安裝依賴
vp run dev                  # 本機開發（先 build:css）
vp run build:css            # tailwindcss CLI：src/styles/app.css → public/styles.css
vp run watch:css            # 監看模式重建 CSS
vp run build                # build:css + server build + client build
vp preview                  # 預覽建置結果
vp check --no-fmt --no-lint # 僅型別檢查
vp test                     # 自動測試：連結完整性 + SSR 煙霧測試（src/tests/）
vp check                    # format + lint + typecheck 一次到位
vp run lemma:gen            # LemmaScript：重新生成 Dafny 驗證基底（不需安裝 Dafny）
vp run lemma:check          # LemmaScript：Dafny 形式驗證，三模組 4 VCs（需 Dafny >= 4.x，詳見 LemmaScript 章節）
vp run deploy               # build + wrangler deploy（除非使用者要求，否則不要執行）
vp run cf-typegen           # 由 wrangler 產生 Cloudflare 綁定型別
```

> **CSS 是獨立產物**：`app.css` 改了要跑 `build:css`（或開 `watch:css`）才會反映到 `public/styles.css`。`dev` 只在啟動時 build 一次。

## 語言與溝通慣例

- **程式碼識別字、技術用語 → 英文**（變數、函式、型別名稱等）。
- **註解、commit 訊息、對使用者的回覆 → 繁體中文**。延續現有 repo 風格。

## 動工前的原則（重要）

- **禁止憑空臆測。** 遇到模糊、不完整或有歧義的指令，先反覆與使用者核對清楚，確認後才動工——不要自行假設需求就開始改。
- 動大結構、加新工具鏈（測試框架、新的第三方 SDK、新的 Cloudflare 綁定）前先說明並確認。

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

原站的動態功能（登入、Topics、Blogs、Polis、轉錄、即時會議等）**一律「SSR 只出靜態殼、資料在 hydration 後於瀏覽器端才抓」**。

- SSR 負責可預先渲染的骨架 / 版面；動態資料在 client mount 後再 fetch 並填入。
- 尚未實作的頁面先掛在 `routes.server.ts` 的 `placeholderPaths`（回 404 的 `NotFound`），逐步替換成真頁。
- **不要**在 Worker 端直接接外部 API 做完整動態 SSR；要改這個策略先跟使用者確認。
- 唯一的例外是 `/admin` 的**狀態碼**：Worker 端讀 session 後可能把同一份 HTML 殼改回 403（見 `src/index.ts`）。內容不變是刻意的——換內容會造成 hydration mismatch。

## 新增一個頁面（核心重複工作）

1. `src/views/XxxView.vue` — 新頁面元件（`<script setup lang="ts">`）。
2. `src/router/routes.server.ts` — 加一筆 route（**靜態 import 元件**，非 lazy——SSR 打包需要），設 `meta.status`；若原本在 `placeholderPaths` 要移除該筆。（`routes.ts` 只放 `statusForRoute`／`headForRoute` 等純邏輯，路由表在 `routes.server.ts`，經 `#routes-runtime` 別名注入。）
3. `src/ssr/heads.ts` — 新增 `headForXxx(origin)`，並在 `routes.ts` 的 `headForRoute` switch 補上對應 `case`。
4. `src/l10n/{zh-TW,en,ja}.json` — **三檔同步**補齊介面文字 key。
5. 驗證：`vp check --no-fmt --no-lint` + `vp run build`，`vp run dev` 目視 SSR 與 hydration。

## 設計系統：只收斂 design token

套用新視覺的方式是**把 `../vtaiwan-design-system/project/colors_and_type.css` 的設計變數收斂進 `src/styles/app.css` 的 `@theme`**，模板一律用這些 token / Tailwind 工具類別，**不硬寫顏色、字級、間距數值**。

- Token 命名：主用 `--color-vt-*`、`--font-vt-*`、`--text-vt-*`、`--spacing-vt-*`、`--radius-vt-*` 等（對應 `text-vt-democratic-red`、`bg-vt-bg-2`、`font-vt-serif` 這類工具類別）。
- **既有樣板用的 legacy 別名**（`text-democratic-red`、`font-serif`、`bg-jade-green/10` 等）在 `app.css` 已保留對應——沿用即可，不用一次全換。
- 少數難用工具類別表達的效果（hero 漸層、frosted glass header、pill 按鈕 `.vt-btn*`、標題紅底線 `.vt-title-underline`）放在 `app.css` 的 `@layer components`。
- **元件外觀自行對齊即可**：以 token 為準重刻頁面／元件，**不要求**逐一照抄 `vtaiwan-design-system` 內的 `_source_reference` SFC；那些檔案與 `project/preview/*.html` 當作視覺規格參考。
- **View 的 SFC 樣式原則上必須使用 `<style scoped>`**，避免樣式跨頁交叉污染，並確保 `:deep()` 由 Vue 正確編譯後套用到 `v-html` 等動態子節點。真正需要全站共用的樣式應移至 `src/styles/app.css`，不要以 View 內的無 `scoped` `<style>` 實作。
- 新增 token 時：先在 `app.css` 的 `@theme` 定義，再於模板使用，然後 `vp run build:css`。

## i18n（多語系）

- 支援 `zh-TW` / `en` / `ja`（見 `src/i18n/index.ts` 的 `supportedLocales`，預設 `zh-TW`）。
- 介面文字一律走翻譯：模板用 `$t('key')`，`<script setup>` 內 `const { t } = useI18n()` 後用 `t('key')`。不要寫死字串。
- **三檔同步（硬性規定）**：新增任何介面文字時，`src/l10n/zh-TW.json`、`en.json`、`ja.json` **三個檔都要加上相同 key**，值各自翻譯。key 用點號分層（如 `header.home`、`about.mission.title`）。
- 語言偵測 / 持久化只在瀏覽器端（`detectPreferredLocale` / `persistLocale`），SSR 一律用預設 locale——別把偵測邏輯拉進 SSR 路徑。

## 專案結構

- `src/index.ts` — Hono 進入點（Worker `fetch`）；CSP／安全標頭、`/api/*` 的全域 `csrf()`、`/admin` 路由守衛、靜態檔 vs SSR 分流。
- `src/ssr/render.ts` — SSR 主流程（組 HTML 殼）。
- `src/ssr/heads.ts` — 各頁 `<head>` / meta 設定與 `renderHeadTags`。
- `src/app.ts` — `createVueApp`（SSR / client 共用的 app + router + i18n 工廠）。
- `src/client/` — `app-entry.ts`（hydration 進入點）、`auth-session.ts`（登入態純函式，顯示層用）、`authClient.ts`（Better Auth client）。
- `src/router/routes.server.ts` — **路由表**（靜態 import 全部 view，含 `placeholderPaths`）；`routes.ts` — `statusForRoute`／`headForRoute`／`resolveRouteStatus`（含 LemmaScript 標注）；`nav-links.ts` — 導覽連結定義。
- `src/api/` — 各 `/api/*` 端點（`auth`、`admin`、`transcription`、`jitsi_token`、`meeting`、`proxy`、`mastodon`、`discourse_*`、`hello`）＋ `cors.ts`（白名單）、`types.ts`（`AppBindings`）。
- `src/server/lib/` — **只在 Worker 端執行**的模組：`createAuth.ts`（Better Auth 設定）、`authorization.ts`（角色／權限／`AuthContext`）、`step-up.ts`（二次驗證 cookie）、`audit-log.ts`／`auth-audit.ts`（審計寫入）、`auth-cli.ts`（產 D1 schema）。**client 不得 import 此目錄**（會把 Better Auth 拉進瀏覽器 bundle）。
- `src/lib/` — 前後端共用的純邏輯（`audit-log.ts` 型別與對應表、`transcription-versions.ts` R2 key 規則、`html-sanitizer.ts`、`discourse.ts` 等）。
- `src/durable-objects/meeting-room.ts` — `MeetingRoom` DO（即時會議逐字稿，WebSocket；#81 取代 Firebase）。
- `src/views/` — 各頁面（`XxxView.vue`，含 `AdminView.vue`）。
- `src/components/` — 共用元件（NavBar、Footer、LanguageSwitcher、SocialLogin、StepUpAuth、TranscriptionManager 等）。
- `src/i18n/index.ts` + `src/l10n/*.json` — 多語（zh-TW / en / ja 三檔同步）。
- `src/tests/` — `vp test` 的測試檔。
- `src/styles/app.css` — Tailwind v4 source + 設計 token（建置到 `public/styles.css`）。
- `migrations/` — `DB`（`vtaiwan-transcriptions`）的 SQL migrations；`migrations/auth/` 為 `DB_AUTH` 專用（**由 Better Auth CLI 生成，勿手改**）。
- `public/` — 靜態資產（由 `ASSETS` 綁定提供）。
- `design/` — 架構示意圖等設計文件（SVG）。
- `vite.config.mts`（server build）、`vite.client.config.mts`（client build）、`wrangler.jsonc`（Cloudflare 綁定與 `next.vtaiwan.tw` custom domain）。

## 驗證流程（改完必做）

### 按改動類型的必跑檢查

每完成一個邏輯完整的子步驟就跑對應檢查——不要等功能全部完成才驗證，累積改動後出錯難以定位。

| 改動類型                                                                                                          | 必跑檢查                                                                                             |
| ----------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| 文件（`.md`）                                                                                                     | `vp check`；核對文中引用的指令／檔案／設定與現實一致                                                 |
| 樣式／token（`src/styles/app.css`）                                                                               | `vp run build:css` + `vp check`；互動 session 加 `vp run dev` 目視                                   |
| 元件／頁面（`.vue`）                                                                                              | `vp check` + `vp test`（SSR 煙霧會抓到瀏覽器 API 違規）                                              |
| 新增／修改路由（`routes.server.ts`）                                                                              | `vp check` + `vp test` + `vp run build`（靜態 import 驗證）；同步 `heads.ts` 與 l10n 三檔            |
| i18n / l10n JSON                                                                                                  | `vp test`（三檔同步 gate）+ `vp check`                                                               |
| SSR 管線（`render.ts`／`heads.ts`／`app.ts`／`index.ts`）                                                         | `vp check` + `vp test` + `vp run build`；`heads.ts` 另跑 `vp run lemma:gen`                          |
| 帶 `//@` 標注的檔案（`heads` / `i18n` / `routes`）                                                                | `vp run lemma:check` 看到 `verified, 0 errors` + `vp check`                                          |
| 依賴／`package.json`                                                                                              | `vp install` + `vp check` + `vp test` + `vp run build`                                               |
| Vite／wrangler 設定                                                                                               | `vp check` + `vp run build` + `vp test`                                                              |
| CI workflow（`.github/workflows/`）                                                                               | `actionlint`；確認每個 step 在本機有等價指令且為綠燈                                                 |
| 登入／授權／Admin（`src/server/lib/`、`src/api/auth.ts`、`src/api/admin.ts`、`AdminView.vue`、`auth-session.ts`） | 見「Admin 介面與 Better Auth」的 **B. 專屬驗收檢查**；同時更新 `design/登入與權限管理工程示意圖.svg` |

### 改完後：完整驗收

**現階段（依序執行）：**

1. `vp check --no-fmt --no-lint` — 僅做型別檢查，應為零錯誤。
2. `vp run build` — 確認 CSS + server + client 都能成功建置。
3. `vp run lemma:gen` — 重新生成 Dafny 驗證基底（`.dfy.gen`），確認 lsc 能正常解析所有加注函式。
4. `vp check` — format + lint + typecheck 全部無錯。
5. `vp test` — 自動測試全數通過：
   - 連結完整性（NavBar / Footer 每條站內連結都解析到已定義 route）
   - SSR 煙霧測試（`src/tests/ssr.test.ts`：路由表每條 route 實跑 `renderPage()`，驗 status / title / 首屏非空殼；誤觸瀏覽器 API 的 SSR 安全違規會在此爆掉）
6. `vp run dev` 目視（**僅互動 session；無人看管的長程 run 跳過此步，以第 5 步替代**）— 確認 hydration **無 mismatch 警告**（開 devtools console 檢查）。
7. `vp check --fix` - 修理細微的format錯誤

> **尚未涵蓋**（需先跟使用者確認再動工）：hydration 一致性的自動化驗證（需真瀏覽器，如 Playwright，屬「實作自動測試」milestone 範圍）。SSR 輸出煙霧測試已由 `vp test` 涵蓋。
>
> **CI**：`.github/workflows/ci.yml` 會在 push / PR 時跑 `vp check` → `vp test` → `vp run build` → `vp run lemma:gen`，另一個 job 安裝 Dafny 跑 `vp run lemma:check`。本機驗收過了 CI 也應該過；CI 紅燈時先看是哪個 gate。

## LemmaScript 形式驗證

本專案以 [LemmaScript](https://viteplus.dev/) 對純函式加注形式不變量（`//@ requires` / `//@ ensures` / `//@ invariant`），並透過 Dafny 機器驗證。**只加真的會被驗證的標注**——不可建模的函式一律不加 `//@`（用一般註解記契約），因為 doc-only 標注不會進入生成模型，只會偽裝成形式規格誤導讀者。

### 已驗證的模組（共 4 VCs，`lemma:check` 全跑）

| 檔案                   | VCs | 驗證的不變量                                                         |
| ---------------------- | --- | -------------------------------------------------------------------- |
| `src/ssr/heads.ts`     | 2   | `buildOg` → `requires title/url 非空`、`\result.length === 10`       |
| `src/i18n/index.ts`    | 1   | `isSupportedLocaleCode` ↔ value ∈ `{"zh-TW","en","ja"}`              |
| `src/router/routes.ts` | 1   | `resolveRouteStatus` → `\result === 200 \|\| \result === metaStatus` |

### 純核心抽取模式（讓函式可驗證的關鍵）

lsc 只能建模 TS 的一個小片段。碰到不可建模的型別時，**把邏輯抽成一個只吃窄型別的純核心函式**加 `//@ verify`，原函式變薄封裝（不加註）：

- `isSupportedLocaleCode(value: string): boolean` ← `isSupportedLocale`（union type alias `SupportedLocale` 會生成帶連字號的 Dafny datatype 建構子，語法不合法）
- `resolveRouteStatus(metaStatus: number | undefined): number` ← `statusForRoute`（`RouteLocationNormalizedLoaded` 會把整個 Vue 型別閉包拉進 Dafny）

已知的建模地雷（實測過）：

- **union type alias / vue-router 型別 / `unknown` / `Promise`**：出現在加注函式簽名即不可建模。
- **`typeof x === "number"` 窄化**：lsc 原樣輸出 `typeof(...)`（不合法 Dafny）；改寫成 `x === undefined ? ... : ...` 才會生成正確的 `match`。
- **`t()` 等外部呼叫**：`//@ autohavoc` 後為任意值，依賴其內容的後置條件不可證（`headFor*` 因此不加註）。
- **regex / `localStorage` / DOM / 多敘述 lambda**：整個函式跳過，不加註（`escapeHtml`、`detectPreferredLocale`、`persistLocale`、`getJson`）。
- **`\result.includes(...)` 這類字串內容斷言**：即使改寫成 split/join 可建模，也需要手寫 Dafny lemma 才能證，不划算。

### 執行方式

```bash
# 重新從 TS 生成 .dfy.gen，三個模組全跑（不需安裝 Dafny）
vp run lemma:gen

# Dafny 形式驗證，三個模組共 4 VCs（需 Dafny >= 4.x，見 https://dafny.org/dafny/Installation；CI 亦會執行）
vp run lemma:check
```

### 加注規則（agent 需遵守）

- **加注語法**：`//@ ` 開頭（注意 `@` 後有空格）；只能放在函式 / 迴圈 body 第一行。
  - `//@ verify` — 標記函式納入驗證（**有加註就必須有這行**——會被驗證才值得加註）
  - `//@ requires <expr>` — 前置條件
  - `//@ ensures \result <expr>` — 後置條件（`\result` 指回傳值）
  - `//@ invariant <expr>` — 迴圈不變量
  - `//@ autohavoc` — 將不可建模的外部呼叫抽象為任意值
- **新增標注後必跑 `vp run lemma:check`**：不只 gen——要看到 `verified, 0 errors` 才算數。不可建模就把 `//@` 全刪，改一般註解。
- **`.dfy` vs `.dfy.gen`**：
  - `.dfy.gen` — gitignored，每次 `lemma:gen` 覆寫，**不要手改**。
  - `.dfy` — tracked，可加 proof additions，diff 只能是新增行。`src/ssr/heads.dfy` 現有一行手工 addition（`type MetaEntry = (string, string)`），是 `buildOg` 能驗證的前提，**不要刪**。
  - 被驗證函式的簽名／body 改動後，`.dfy` 需 rebase：刪掉舊 `.dfy` 讓 `lsc check` 重建，再補回仍需要的 proof additions。

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
- **長程（無人看管）任務例外**：使用者明確授權跑長程任務時，允許在 **feature branch** 上以 Conventional Commits 做 **checkpoint commit**——每完成一個驗證通過（`vp check` + `vp test`）的子步驟一筆，方便回溯。仍然 🚫 **禁止 push、禁止直接 commit 到 main、禁止 deploy**。

## Milestone 規劃

本專案以 GitHub Milestones 追蹤進度：<https://github.com/g0v/vTaiwan-hono/milestones>

> **本表是快照，不是真相來源。** 動工前用 `gh issue list --repo g0v/vTaiwan-hono --state open` 與
> `gh api "repos/g0v/vTaiwan-hono/milestones?state=all"` 核對現況——issue 開關狀態隨時在變，
> 而本檔更新頻率遠低於 issue。

**已結束的 milestone**（皆 0 open）：

| Milestone                                                               | 核心目標                                                                      |
| ----------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| [打樣](https://github.com/g0v/vTaiwan-hono/milestone/1)                 | 首頁、NavBar、Footer 視覺對齊 `vtaiwan-design-system`；多語切換不切版         |
| [MVP](https://github.com/g0v/vTaiwan-hono/milestone/2)                  | 即時會議以外的所有頁面與功能完工                                              |
| [完整功能](https://github.com/g0v/vTaiwan-hono/milestone/3)             | 即時會議（JAAS）＋所有路由 alias、CORS 標頭等收尾，達成功能完整搬移           |
| [實作自動測試](https://github.com/g0v/vTaiwan-hono/milestone/5)         | #54 研究 foundry-security-spec                                                |
| [管理後台 - 樣稿+視稿](https://github.com/g0v/vTaiwan-hono/milestone/8) | #62 版面樣稿、#68 管理入口 UI 位置                                            |
| [管理後台 - MVP](https://github.com/g0v/vTaiwan-hono/milestone/9)       | #63 AUTH_DB、#64 初始化 Better Auth、#65 `.dev.vars.example`、#66 Google 登入 |

**進行中的 milestone**：

| Milestone                                                                            | 狀態                          | 剩餘工作                                                                                                          |
| ------------------------------------------------------------------------------------ | ----------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| [管理後台 - 完整功能](https://github.com/g0v/vTaiwan-hono/milestone/10)              | 🟢 issue 全關，milestone 未關 | #67 權限復刻、#72 二次驗證、#73 版本控制、#74 日誌補記、#75 GitHub 登入、#76 管理員介面、#87 手機 Navbar 皆已完成 |
| [完整從 Firebase 搬移到 cloudflare](https://github.com/g0v/vTaiwan-hono/milestone/4) | 🟢 issue 全關，milestone 未關 | #43 長程計畫、#81 DO + WebSocket 取代 Firebase、#91 資料庫轉移皆已完成；專案已無 Firebase 相依                    |
| [部署上線](https://github.com/g0v/vTaiwan-hono/milestone/6)                          | 🚧 1 open                     | **#32 逐字稿資料庫需搬移**（closed: #36 Google 分析、#80 JaaS 連結、#82 OAuth 端點）                              |
| [資料與內容維護](https://github.com/g0v/vTaiwan-hono/milestone/7)                    | 🚧 1 open                     | **#55 Google 日曆內容空白**                                                                                       |

> 早期的「打樣 → MVP → 完整功能」線性依賴已走完；目前只剩「部署上線」與「資料與內容維護」兩條各自獨立的收尾線。

## Admin 介面與 Better Auth 開發 checkpoints

本章描述 **Better Auth 登入／授權** 與 **管理員（Admin）介面** 的落地機制。相關工作線（#43、#62–#68、#70–#76）已全數併回 `main` 並關閉 issue；本章因此**從「進度追蹤」轉為「機制說明」**——記錄的是為什麼這樣設計、哪裡是安全邊界、哪些是刻意的取捨。續作或改動前先讀完本章。

**視覺總覽**：[`design/登入與權限管理工程示意圖.svg`](./design/登入與權限管理工程示意圖.svg)——資訊架構分層、`/admin` 路由守衛流、`/api/*` 四道閘與 step-up 往返、角色權限與端點對照。改動授權機制時請一併更新該圖。

### A. 機制現況（逐項對照原始碼）

**Better Auth（後端認證與授權）**

| 區塊             | 落地位置 / 說明                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Auth 端點        | `/api/auth/*`（Better Auth handler，前置 `requiresStepUp` 檢查）+ `/api/me`（回 `AuthContext`），見 `src/api/auth.ts`（薄層）；實際邏輯在 `src/server/lib/`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| 專用 D1 資料庫   | 綁定 `DB_AUTH`（`vtaiwan-auth`）、migrations 於 `./migrations/auth`；建表 SQL 為 user/session/account/verification                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| 本機設定範本     | `.dev.vars.example` 備齊 `BETTER_AUTH_SECRET`／`BETTER_AUTH_URL`／`GOOGLE_*`／`GITHUB_*`（含警語與建立步驟）                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| Social 登入      | `createAuth.ts` 設 Google + GitHub provider（`accountLinking.trustedProviders` 兩者皆信任，以 email 連結帳號）；client 端入口為 `SocialLogin.vue` + `authClient.ts` + `App.vue`。OAuth 個資同步刻意只吃頭像：`overrideUserInfoOnSignIn: true` 讓 Better Auth 每次登入取回 provider profile，再由 `limitOAuthProfileSyncToAvatar`（`user.update.before` hook）把 `name`／`email`／`emailVerified` 抹成 `undefined`，保留使用者自行改過的名稱。`oauth-profile-sync.test.ts` 釘住此行為                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| 角色／權限模型   | `src/server/lib/authorization.ts`：`AppRole`(user/admin/super-admin)、`Permission`、`resolveRole`（未知角色降級 user）、`permissionsForAccount`（停權即空陣列）、`hasPermission`、`isAdminRole`／`isSuperAdminRole`／`isActiveAdminRole`。**`Permission` 只列本站真的會強制的三項**（`meeting.join`／`meeting.moderate`／`transcription.update`）——議題（Topic）的上架與內容修改由 talk.vtaiwan.tw（Discourse）管理員負責，不屬本站授權範圍，故刻意不定義 `topic.*` 權限                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| 跨站（CSRF）防護 | 全域 `app.use('/api/*', csrf())`（`hono/csrf`，見 `src/index.ts`）——**唯一**的同源把關點，逐端點的 `hasSameOrigin` 已移除；`/api/auth/*` 另有 Better Auth 自身的 `trustedOrigins` 檢查。⚠️ 無 Origin／無 Sec-Fetch-Site 的表單型請求一律 403（非瀏覽器請求不再豁免），受影響者為 `/api/create-table`（curl 要帶 `Content-Type: application/json`）與 `/api/test-ai`（multipart，僅剩同源瀏覽器打得到）；未來加 `form_post` 模式的 OAuth provider（如 Apple）其跨站 POST callback 也會被擋。`api-csrf.test.ts` 以真實 Hono app 驗證                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| 端點權限強制     | `jitsi-token`（`meeting.join`；moderator claim 由 `meeting.moderate` 決定）、`/api/meeting/*` 與 `/api/ws/meeting/:date`（`meeting.join`）、逐字稿寫入與版本讀取（`transcription.update`）、`/api/transcription/:lang`（`meeting.join`）。Better Auth admin plugin 端點 `/api/auth/admin/*`（list-users／set-role／ban-user…）由 plugin 自身強制（未登入 401、權限不足 403），設定單一來源為 `createAuth.ts` 的 `adminRoleAccess`，Worker 端不再疊平行守衛。**每個 `Permission` 都有實際強制它的端點，不留孤兒權限**                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| Jitsi 防偽造     | Jitsi token 為 **POST**、moderator claim 由 session 建立，不接受前端傳入身分／角色（原可用 query string 偽造）                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| Profile          | Profile 名稱走 Better Auth `updateUser()`；顯示層依 `auth-session.ts` 的角色／權限判斷（`/profile` 的後台入口、逐字稿管理 UI 等）                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| 敏感操作二次驗證 | `src/server/lib/step-up.ts`：**只有「刻意為了複核而重新登入」才算通過**——`StepUpAuth` 發起的登入在 OAuth state 帶 `purpose=step-up`（`signIn.social` 的 `additionalData`，schema 為 `z.record(z.string(), z.any())`，原樣往返），`createAuth.ts` 的 `after` hook 於 callback 簽發 15 分鐘 httpOnly cookie `exp.sessionId.sig`（HMAC-SHA256）。⚠️ **不可改用 `session.createdAt` 判新鮮度**——那會讓「登出後重新登入」直接視同已複核，違反 #72 語意。cookie **綁 session id**：登出換 session ⇒ 舊 cookie 自動失效（登出時 hook 亦主動清除）。未通過的敏感操作回 **403 + `SESSION_NOT_FRESH`**。已套用：`/api/auth/admin/*`（涵蓋 list-users＝進後台、set-role＝改權限）、`update-outline`、`upload-transcription` 覆蓋既有 meeting_id。`/api/me` 另回 `stepUpExpiresAt` 供 AdminView 右上角倒數，歸零即自動退回二次驗證畫面。`SocialLogin` 一律以當前路由為 `callbackURL`，回跳留在原頁；二次驗證與一般登入提供**同一組 provider（Google／GitHub）**——`purpose` 寫在 provider 無關的 `/sign-in/social` state，任一 provider 的 callback 都能簽發 cookie。⚠️ **死路：社群帳號 email 與管理員帳號不同時**，Better Auth 找不到既有使用者，會新建 `user` 角色帳號並簽發其 session——形同靜默換身分。純函式 `isWrongAccountAfterStepUp`（`auth-session.ts`）以「`fresh` 為真卻非管理員」判定（一般訪客到不了此狀態），AdminView 據此 alert 後 `replace('/')`；判定用伺服器回報的 `fresh`，**不可改用 `needsStepUp`**（摻前端倒數會漏判）。⚠️ 一般 `admin`（非 super-admin）不會觸及 `/api/auth/admin/*`，其「進入後台」目前**只由 AdminView 前端把關**；可接受是因為後台對他而言無敏感資料（成員列表拿不到、變更日誌拿不到——`/api/admin/audit-log` 同樣只放行 super-admin、逐字稿為公開資料），所有寫入仍由 Worker 端擋。**侷限**：provider 仍在登入狀態時是零點擊轉跳，擋得住偷 cookie、擋不住借用已解鎖裝置；驗證的是「控制其中一個已連結 provider」，不必然是當初建立 session 的那個（帳號以 email 連結） |
| 單元測試         | `authorization.test.ts` 覆蓋角色降級／權限集合（逐字釘住，不留孤兒權限）／`adminRoleAccess`（管理端點只有 super-admin 過得去）；`api-csrf.test.ts` 以真實 Hono app 驗 `/api/*` 跨站防護；`step-up.test.ts` 覆蓋 token 簽發／驗證、綁 session（換 session 即失效）、過期、竄改、前後端 `purpose` 一致、需二次驗證的路徑集合、未登入打管理端點回 401；`audit-log.test.ts` 覆蓋事件對應、body 解析、detail 序列化與「每種事件都有文案」、未登入拿不到日誌；`meeting-auth.test.ts` 覆蓋會議端點授權；`security-headers.test.ts` 覆蓋 CSP／安全標頭（含 Firebase 網域已移除的負向斷言）；`oauth-profile-sync.test.ts` 覆蓋只同步頭像；`transcription-versions.test.ts` 覆蓋版本識別碼／R2 key 與未登入拿不到版本。**尚無帶 session 的端點層級整合測試**（403 流程、日誌實際寫入、R2 版本列表內容皆未自動化）                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |

**Admin 介面**

| 區塊               | 落地位置 / 說明                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 版面               | `AdminView.vue`：三個分頁（成員／日誌／逐字稿）、關鍵字搜尋（`SearchInput`）、角色下拉、權限矩陣、二次驗證倒數                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| i18n               | `admin.*` key 三檔同步                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| robots 遮蔽        | `public/robots.txt` `Disallow: /admin`（**僅 crawler 提示，非安全邊界**——真正把關靠路由守衛）                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| mock 資料          | 已全數退役：成員 tab 與日誌 tab 皆為真實 API，`seedLogs()` 與「重設樣稿日誌」按鈕已移除                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| 真實資料串接       | 成員 tab 接 Better Auth `listUsers`／`setRole`／`banUser`／`unbanUser`（僅 `super-admin`）；日誌 tab 接 `/api/admin/audit-log`；逐字稿 tab 接 `TranscriptionManager` 與回復／刪除端點                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| 權限矩陣可寫       | ⛔ 刻意唯讀：權限由 `AppRole` 推導，checkbox 不可勾；改角色即改權限。逐權限可寫不在範圍內                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| 角色變更保護       | `canManageRole`：非 super-admin 不可改、不可改自己、**最後一位 super-admin 不可被降級**（避免鎖死管理能力）                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| 變更日誌           | **事件來源＝D1 審計表 `admin_audit_log`**（放在 `DB`／`vtaiwan-transcriptions`，見 `migrations/0002_add_admin_audit_log.sql`；`DB_AUTH` 的 schema 由 CLI 生成不得手寫）。涵蓋**角色／停權變更＋逐字稿上傳／覆蓋／回復／刪除＋大綱編輯**：前者由 `createAuth.ts` 的 `before`／`after` hook 觸發、實作在 `src/server/lib/auth-audit.ts`（`before` 於動作生效前快照操作對象姓名與原角色——跨 D1 無法 JOIN；`after` 確認回應成功才入帳），後者寫在 `src/api/transcription.ts`。schema 通用（`action` + `target` + JSON `detail`），加事件種類不必改表。讀取端 `GET /api/admin/audit-log` **僅 super-admin 且需 session 新鮮**（日誌含成員姓名／信箱，敏感度等同成員列表）。`recordAudit` **絕不 throw**：日誌寫失敗不得把已成功的管理操作變成 500。**所有會改變狀態的 admin 端點皆已入帳**（含 `impersonate-user`）；其中兩個的操作對象不在 request body 的 `userId`，由 `auth-audit.ts` 另外取得（#74）——`create-user` 讀成功回應的 `{ user }`，`revoke-user-session` 則在動作生效前以 `sessionToken` 反查 `DB_AUTH` 的 `session` 表（`findAuditUserIdBySessionToken`）。⚠️ 事件名 `user.session.revoke`（單一工作階段）與 `user.sessions.revoke`（全部工作階段）只差一個字母、端點路徑互為前綴，`audit-log.test.ts` 有相鄰斷言釘住，勿調換。`detail.reason` 記錄停權理由。⚠️ **表要先建**：`DB` 綁定為 `remote`，`migrations/0002` 未套用時 `listAudit` 會 500（Worker log 有提示字串）、`recordAudit` 則靜默失敗；套 migration 或打 `/api/create-table` 皆可（idempotent）。**「管理操作」欄**：逐字稿／大綱的變更列附「回復到變更前版本」按鈕，`transcription.create` 列則是「刪除此逐字稿」（變更前＝不存在，使用者裁定）；哪一列有按鈕由純函式 `restoreCommandFor` 單一決定，前端顯示與端點呼叫共用。回復本身也入帳，因此可以再回復回去 |
| 停權（ban／unban） | AdminView 成員 tab 以 `authClient.admin.banUser({ userId, banReason })`／`unbanUser()` 操作，停權理由經 modal 輸入並寫入 `detail.reason`。停權帳號的 `permissions` 為空陣列、`isActiveAdminRole` 為 false，因此無法進後台也無法用會議功能                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| 逐字稿版本控制     | 每次上傳在 R2 另存 `versions/<meeting_id>/<versionId>.txt`（**不覆蓋、全部保留**，`versionId` 為 `YYYYMMDDThhmmssSSSZ`，字典序即時間序）；key 一律由 `src/lib/transcription-versions.ts` 的純函式組出。`GET /api/transcriptions/:meeting_id/versions`（列表，回 `truncated`）與 `.../versions/:version_id/text`（下載）皆需 `transcription.update`——舊版本可能含後續被修正的內容，不隨公開逐字稿一起露出。除了「下載後重新上傳」，另有 `POST /api/restore-transcription`（由變更日誌回復逐字稿／大綱）與 `POST /api/delete-transcription`（刪除現行內容、保留全部版本），皆需 `transcription.update` + `context.fresh`。**不變量：最新版本＝現行內容**——任何改動現行逐字稿的路徑都要跟著寫一個新版本（回復也會寫），否則「變更前的版本」會算錯。大綱沒有版本鏈，改用「變更前即時快照」存到 `outlines/<meeting_id>/<versionId>.md`。#73 上線前上傳、R2 只有現行物件的逐字稿，在第一次被覆蓋／刪除前會先 `preserveLegacyVersion` 補存一版，避免舊內容永久消失。保留策略為全部保留，日後要縮減以 R2 lifecycle rule 處理。⚠️ **已知侷限**：上傳覆蓋會用 AI 重新產生大綱且不快照舊大綱，人工編輯過的大綱在覆蓋後救不回                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `/admin` 路由守衛  | Worker 端對 `/admin`（含子路徑）讀 session，非 admin 回 **403**（`src/index.ts`）；**HTML 內容不變，只覆寫狀態碼**——回不同內容會造成 hydration mismatch。前端於 `/profile` 與行動版 NavBar 依角色顯示入口、AdminView 顯示 403 守衛頁（顯示層 UX）——前後端雙重把關。此處**只看角色不看新鮮度**（否則使用者連重新登入的入口都看不到），不新鮮時 AdminView 整頁換成二次驗證畫面，實際資料則由 `/api/auth/admin/*` 擋                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |

### B. 專屬驗收檢查（改 admin/auth 必跑）

除了「驗證流程」章節的通用檢查，動到本工作線時額外把關以下項目：

| 改動類型                                            | 額外必跑 / 必查                                                                                                                                                                                                                                                                                                                                                                                      |
| --------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/server/lib/authorization.ts`（角色／權限）     | `vp test`（`authorization.test.ts` 綠燈——該測試逐字釘住權限集合，改動必須同步更新）。**不變量：每個 `Permission` 都必須有實際強制它的 Worker 端點**——新增權限時同一筆 commit 就要接上端點檢查，否則就是孤兒權限（`topic.manage` 曾是此類，已因議題內容改由 talk.vtaiwan.tw 管理而移除）。移除權限時記得一併清 `src/client/auth-session.ts`、`AdminView.vue` 的顯示矩陣與 l10n 三檔的 `admin.perms.*` |
| 新增受保護端點                                      | 三道關卡齊全：全域 `csrf()`（掛在 `/api/*`，**不要**在端點內自己再寫同源檢查）→ `getAuthContext`（401）→ `hasPermission`（403）；缺一即為授權破口。若屬敏感操作，最後再加 `context.fresh`（403 + `SESSION_NOT_FRESH`），並在 `step-up.test.ts` 補上對應斷言                                                                                                                                          |
| `createAuth.ts`（provider／plugin）                 | `.dev.vars.example` 同步新憑證 key；`vp check` + `vp run build`；別把密鑰寫進 tracked 檔。**動到 `adminRoleAccess` 必跑 `vp test`**——`authorization.test.ts` 釘住「admin 端點只有 super-admin 過得去」，那是管理端點唯一的授權設定點                                                                                                                                                                 |
| D1 schema（`migrations/auth/*.sql`）                | schema 由 `auth-cli.ts` 經 Better Auth CLI 生成——**改欄位改源頭重生，勿手改 SQL**；確認 `wrangler.jsonc` 的 `DB_AUTH` migrations_dir 對得上                                                                                                                                                                                                                                                          |
| `AdminView.vue`                                     | `vp check` + `vp test`（SSR 煙霧測試不得誤觸瀏覽器 API）；接真實 API 後，非 admin 角色須拿不到管理資料                                                                                                                                                                                                                                                                                               |
| client 授權（`auth-session.ts`／`SocialLogin.vue`） | client 權限判斷**只是 UX**，不可當安全邊界——真正把關一律在 Worker 端；SSR 路徑不得讀 `document`／`localStorage`。`src/client/**` 與 `src/views/**` **不得 import `src/server/lib/**`**（會把 Better Auth 拉進瀏覽器 bundle）；需要共用型別時放 `src/lib/` 或各自維護一份並在註解標明對齊對象                                                                                                         |
| 逐字稿版本（R2 key）                                | `vp test`（`transcription-versions.test.ts` 綠燈）；R2 key **一律由 `transcription-versions.ts` 的純函式組出**，端點內不得自行字串拼接——`meeting_id`／`version_id` 未先驗格式就進 key 等於開放路徑穿越                                                                                                                                                                                               |
| 新增後台變更事件（`AuditAction`）                   | 在 `src/lib/audit-log.ts` 加值後**三件事一起做**：`ACTION_LABEL_KEYS` 補對應、l10n 三檔補 `admin.logs.action.*`、`audit-log.test.ts` 的 `ALL_ACTIONS` 補上（該測試會抓到缺文案）。動到 `admin_audit_log` 欄位時，`migrations/0002_*.sql` 與 `/api/create-table` 的 bootstrap SQL **兩邊都要改**。新增會改變狀態的管理／內容端點時一併呼叫 `recordAudit`，否則該變更不會留痕                          |

> **鐵則**：授權判斷的真實邊界永遠在 **Worker 端**（`getAuthContext` + `hasPermission`）。client（`auth-session.ts`、頁面 `v-if`）只做顯示層取捨，任何「client 擋住就好」的做法都是漏洞。

### C. 已完成的工作線與剩餘缺口

#43 的短／中／長期目標**皆已落地並關閉 issue**：Google／GitHub 登入、角色權限模型、`/admin` 路由守衛、Admin 真實資料串接（成員／角色／停權／日誌）、變更日誌、逐字稿版本控制、二次驗證，以及 #81 用 Durable Object + WebSocket 取代 Firebase 即時逐字稿——**專案已無任何 Firebase 相依**。

**明確不做（刻意的範圍決定，別當成待辦）**

- **逐權限 checkbox 可寫**：權限由 `AppRole` 推導，權限矩陣維持唯讀；要改權限就改角色。
- **`topic.*` 權限**：議題的上架與內容修改由 talk.vtaiwan.tw（Discourse）的管理員負責，不屬本站授權範圍。

**已知缺口（動工前先與使用者確認範圍）**

1. **端點層級的授權整合測試** — 目前的測試都是純函式層級；「帶 session 打端點拿到 401／403」、「日誌實際寫進 D1」、「R2 版本列表內容」皆未自動化。需要真瀏覽器／真綁定的測試環境，屬「實作自動測試」範圍。
2. **一般 `admin`（非 super-admin）進後台的伺服器端把關** — 他不會觸及 `/api/auth/admin/*`，「能否進後台」目前只由 AdminView 前端判斷。可接受是因為後台對他而言沒有敏感資料可讀（成員列表與變更日誌都只放行 super-admin、逐字稿為公開資料），所有寫入仍由 Worker 端擋。要收緊就得在 `src/index.ts` 的 `/admin` 守衛加新鮮度或角色細分。
3. **大綱覆蓋不可回復的邊角** — 上傳覆蓋會用 AI 重新產生大綱且不快照舊大綱，人工編輯過的大綱在覆蓋後救不回（見上表「逐字稿版本控制」）。

**續作時的 commit 節奏**：每完成一個「`vp check` + `vp test` 綠燈」的子步驟打一筆 checkpoint commit（Conventional Commits，見「Git / Commit 慣例」）。

## Migration 基本原則

從 `vue.vTaiwan-neo`（及其搭配的後端 workers）搬移功能時，遵守以下原則：

### 接口整合

原本分散在**一個前端（vue.vTaiwan-neo）加兩個後端 worker**的所有接口，全部整合進 `vTaiwan-hono` 這個新專案。**新專案不能再打舊專案的外部 worker 路由。**

### 漸進增強

以漸進增強（progressive enhancement）的方式進行搬移——先確保 SSR 靜態殼可用，再逐步加入動態功能，不中斷現有服務。

每次增強單一功能時，都要先盤點並驗證對相關區塊與共用基礎設施的副作用（例如登入、資料存取、分析追蹤、CSP、安全標頭、SSR／hydration、路由與共用元件）；不能只確認新功能本身可用，卻讓既有功能退化或失效，避免顧此失彼。

### 路由完整性

**所有原專案的路由（含 alias 路由）在新專案都必須有對應。** 不能讓舊有連結失效。未完成的頁面先掛 `placeholderPaths`（回 404），上線前補完。

### 什麼不搬

- neo 的開發腳本、CI 配置、測試 fixture——hono 自行維護。
- 有疑問的功能，動工前先問使用者，不臆測。
