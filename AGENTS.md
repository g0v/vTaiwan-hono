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
2. **SSR 只出靜態殼，動態資料 hydration 後才抓。** 不在 Worker 端接 Firebase／外部 API 做動態 SSR；Firebase 僅限 client 端使用（登入）。要改這個策略，先與使用者確認。
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
5. 驗證：`vp check --no-fmt --no-lint` + `vp run build`，`vp run dev` 目視 SSR 與 hydration。

## 設計系統：只收斂 design token

套用新視覺的方式是**把 `../vtaiwan-design-system/project/colors_and_type.css` 的設計變數收斂進 `src/styles/app.css` 的 `@theme`**，模板一律用這些 token / Tailwind 工具類別，**不硬寫顏色、字級、間距數值**。

- Token 命名：主用 `--color-vt-*`、`--font-vt-*`、`--text-vt-*`、`--spacing-vt-*`、`--radius-vt-*` 等（對應 `text-vt-democratic-red`、`bg-vt-bg-2`、`font-vt-serif` 這類工具類別）。
- **既有樣板用的 legacy 別名**（`text-democratic-red`、`font-serif`、`bg-jade-green/10` 等）在 `app.css` 已保留對應——沿用即可，不用一次全換。
- 少數難用工具類別表達的效果（hero 漸層、frosted glass header、pill 按鈕 `.vt-btn*`、標題紅底線 `.vt-title-underline`）放在 `app.css` 的 `@layer components`。
- **元件外觀自行對齊即可**：以 token 為準重刻頁面／元件，**不要求**逐一照抄 `vtaiwan-design-system` 內的 `_source_reference` SFC；那些檔案與 `project/preview/*.html` 當作視覺規格參考。
- 新增 token 時：先在 `app.css` 的 `@theme` 定義，再於模板使用，然後 `vp run build:css`。

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

### 按改動類型的必跑檢查

每完成一個邏輯完整的子步驟就跑對應檢查——不要等功能全部完成才驗證，累積改動後出錯難以定位。

| 改動類型                                                  | 必跑檢查                                                                                  |
| --------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| 文件（`.md`）                                             | `vp check`；核對文中引用的指令／檔案／設定與現實一致                                      |
| 樣式／token（`src/styles/app.css`）                       | `vp run build:css` + `vp check`；互動 session 加 `vp run dev` 目視                        |
| 元件／頁面（`.vue`）                                      | `vp check` + `vp test`（SSR 煙霧會抓到瀏覽器 API 違規）                                   |
| 新增／修改路由                                            | `vp check` + `vp test` + `vp run build`（靜態 import 驗證）；同步 `heads.ts` 與 l10n 三檔 |
| i18n / l10n JSON                                          | `vp test`（三檔同步 gate）+ `vp check`                                                    |
| SSR 管線（`render.ts`／`heads.ts`／`app.ts`／`index.ts`） | `vp check` + `vp test` + `vp run build`；`heads.ts` 另跑 `vp run lemma:gen`               |
| 帶 `//@` 標注的檔案（`heads` / `i18n` / `routes`）        | `vp run lemma:check` 看到 `verified, 0 errors` + `vp check`                               |
| 依賴／`package.json`                                      | `vp install` + `vp check` + `vp test` + `vp run build`                                    |
| Vite／wrangler 設定                                       | `vp check` + `vp run build` + `vp test`                                                   |
| CI workflow（`.github/workflows/`）                       | `actionlint`；確認每個 step 在本機有等價指令且為綠燈                                      |

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

| Milestone                                                                          | 狀態                      | 核心目標                                                                                                                    | 主要 issues                                                                                                                                                        |
| ---------------------------------------------------------------------------------- | ------------------------- | --------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| [打樣](https://github.com/g0v/vTaiwan-hono/milestone/1)                            | ✅ 已完成                 | 讓首頁、NavBar、Footer 的視覺對齊 `vtaiwan-design-system`；確保多語言切換不會切版。                                         | #1 導航列、#2 首頁、#4 Footer、#5 logo/favicon/og、#8 隱私條款頁、#14 LanguageSwitcher bug、#17 Title、#21 make.vtaiwan.tw 連結                                    |
| [MVP](https://github.com/g0v/vTaiwan-hono/milestone/2)                             | ✅ 已完成                 | **即時會議以外**的所有頁面與功能全部完工，可正式部署取代現行站。                                                            | #3 hydration/vue-router、#10 vue-i18n、#11 共用元件、#12 Manifest、#15 語言偵測、#16 議題頁、#18 Title i18n、#20 三個文章頁（含後端 proxy）、#23 貢獻者/FAQ 靜態頁 |
| [完整功能](https://github.com/g0v/vTaiwan-hono/milestone/3)                        | 🚧 進行中（預計 10 月初） | 完成即時會議（JAAS worker + 轉錄 worker）及其餘收尾項目，達成功能完整搬移。                                                 | open: #24 會議頁、#25 所有路由 alias、#28 CORS 標頭、#29 即時會議；closed: #13 登入、#19 lazy-import、#22 hydration fix                                            |
| [實作自動測試](https://github.com/g0v/vTaiwan-hono/milestone/5)                    | 📋 待開始                 | 尚無 issue，細節待定。動工前先與使用者確認範圍。                                                                            | —                                                                                                                                                                  |
| [從 Firebase 搬移到全 Cloudflare](https://github.com/g0v/vTaiwan-hono/milestone/4) | 📋 待開始                 | 登入改為 BetterAuth；資料庫改用 D1 / R2；即時校對資料考慮使用 Durable Objects (DO)。進行到此 milestone 前**不要**提前動工。 | —                                                                                                                                                                  |

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
