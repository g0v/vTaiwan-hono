# insight：#124／#125 Jitsi 手機版跑版與返回鍵（調查筆記）

> 分支：`fix/issue-124-125-jitsi-mobile-rwd`　調查日期：2026-09-21
> 狀態：**調查完成，已依使用者裁定實作**（見文末「決議與實作」）。Android 實機驗證尚待進行。

## TL;DR

1. **#124 的主因不是 sticky，而是 `100vh`。** Android Chrome 的 `100vh` 算的是「網址列收起後」的大視窗高度；網址列顯示時，iframe 比可視區多出一條工具列的高度（實測約 57 CSS px ≈ 56dp 的 Chrome 工具列），Jitsi 底部工具列就被推到畫面外。
2. **sticky NavBar 是 #125「✕ 被 navbar 壓住」的直接原因**，但它是 #124 的*後果*：因為要往下捲才看得到工具列，一捲 iframe 頂端就滑到 sticky header 底下，面板的標題與 ✕ 剛好被蓋住。**把高度修好、頁面不必捲動，這半個 #125 會一起消失。**
3. **電腦模擬手機測不出來是預期的**：DevTools 的裝置模擬沒有會伸縮的網址列，`100vh` 恆等於可視高度。
4. **#125 的返回鍵在 Android 上特別容易踩到**（系統返回鍵一按就觸發；iOS 的邊緣滑動走同一套 history，只是不易誤觸）。Jitsi 開面板／抽屜時自己不會 `pushState`，history 裡沒有「面板已開」這一筆，所以返回鍵直接回到上一頁、離開會議。可用「加入會議時 push 一筆 history + 攔 `popstate`」處理，但 **Jitsi 的「⋯ 更多」選單沒有任何 API 可關／可偵測**，只能做到「先跳確認視窗」。

## 證據

### 1. 議題影片的瀏覽器不是一般 Chrome 分頁

兩段影片的頂列都是「✕　⌄　標題／網域　分享　書籤　⋮」。`⌄` 是 Chrome Custom Tab 的「最小化」按鈕——也就是**從其他 App（LINE／Google App 等）點連結開啟的內嵌瀏覽器**，裝置為 Samsung（底部 `||| ○ <` 三鍵導覽列）。

- Custom Tab 與 Chrome 同核心，`100vh` 行為相同。
- 兩段影片是**不同次錄影**（#124：720×1600@90fps；#125：720×1280@30fps），不能假設是同一支手機／同一個 App。
- #125 影片中頂列時有時無，代表該次的工具列**會隨捲動收合**，符合「動態工具列」模型。
- #124 影片則相反：往下捲了約 91 CSS px 之後，頂列（y=0–164）與捲動前**完全相同、沒有收合**，但 `100vh` 仍比可視區多約 57px。也就是在這個 Custom Tab 裡，那 57px 缺口是**永久的**，怎麼捲都拿不回來——對這位回報者而言 `svh` 比 `dvh` 更保險。
- ⚠️ 是哪個 App 開的仍是推測，見「待驗證」。

### 2. 影格像素量測（#124 影片，720×1600）

抽 t=1s（頁面在頂端）與 t=13s（往下捲之後）兩張全解析度影格，沿垂直線量顏色邊界：

| 量測項目                                       | 裝置 px | 換算 CSS px（DPR 1.875）                      |
| ---------------------------------------------- | ------- | --------------------------------------------- |
| NavBar 區塊高度（166→322）                     | 156     | 83.2（≈ `pt-3` 12 + 72 = 84 ✓，DPR 由此反推） |
| 可視區高度（166→1510）                         | 1344    | 716.8                                         |
| 兩影格間捲動量（頭像 785→614）                 | 171     | 91.2                                          |
| iframe 高度（322→1452+171）                    | 1301    | 693.9                                         |
| 反推 `100vh`（線上版 iframe = `100vh − 80px`） | —       | **773.9**                                     |
| `100vh` − 可視區高度                           | —       | **57.1 ≈ Chrome 工具列 56dp**                 |

結論：`100vh` 比實際可視高度多出恰好一條瀏覽器工具列。量測與「`vh` = large viewport」的模型在 1–2px 誤差內吻合。

另外在捲動後的影格，x=40 處 y=166–190 是黑色——那是 iframe 內容滑進 sticky header 透明的 `pt-3` 內距底下，**直接證明 iframe 頂端已被 NavBar 蓋住**。

### 3. 網路查證

- Android Chrome 的 `100vh` 以「工具列全收起」的最大視窗計算，首屏（工具列顯示時）全高元素會被裁掉；`svh`＝工具列顯示時的小視窗、`lvh`＝大視窗、`dvh`＝隨工具列即時變動。三者已於 2025-06 達 Baseline Widely Available。（[OpenReplay](https://blog.openreplay.com/fix-100vh-mobile-viewport/)、[modern-css](https://modern-css.com/mobile-viewport-height-without-100vh-hack/)、[CSSWG #6113](https://github.com/w3c/csswg-drafts/issues/6113)）
- **沒有查到「`position: sticky` 在 Android 上壞掉」的已知 bug。** 查到的 sticky／fixed 問題全是同一件事的變形：工具列伸縮改變視窗高度，連帶讓貼底元素位移或抖動（[Steve Fenton](https://stevefenton.co.uk/blog/2022/12/mobile-position-sticky-issue/)、[Bricks forum](https://forum.bricksbuilder.io/t/no-bug-chrome-mobile-url-bar-impacting-sticky-fixed-footer-section/38714)）。我們的 NavBar 是 `sticky top-0`（貼頂），不受這類問題影響。
- Jitsi iframe API：
  - 指令有 `toggleParticipantsPane(enabled)`、`toggleChat`、`toggleFilmStrip`、`toggleTileView`；事件有 `participantsPaneToggled {open}`、`chatUpdated {isOpen}`、`toolbarVisibilityChanged {visible}`、`toolbarButtonClicked`。（[Commands](https://jitsi.github.io/handbook/docs/dev-guide/dev-guide-iframe-commands/)、[Events](https://jitsi.github.io/handbook/docs/dev-guide/dev-guide-iframe-events/)）
  - **「⋯ 更多」選單（手機上是底部抽屜）沒有任何指令或事件。** #125 影片裡找不到關閉鈕的正是這個抽屜與 participants pane。
  - `chatUpdated.isOpen` 曾有「關閉時仍回 true」的 bug（[jitsi-meet #9262](https://github.com/jitsi/jitsi-meet/issues/9262)），用之前要實測。
  - 工具列自動隱藏由 `toolbarConfig` 控制：`alwaysVisible: false`、`timeout: 4000`、`initialTimeout: 20000`（[jitsi-meet `config.js`](https://github.com/jitsi/jitsi-meet/blob/master/config.js)；handbook 的 Configuration 頁沒列）。
  - iframe API 的 `configOverwrite` 只放行白名單內的 key。已確認 `toolbarConfig`（與我們已在用的 `toolbarButtons`、`breakoutRooms`）都在 [`configWhitelist.ts`](https://github.com/jitsi/jitsi-meet/blob/master/react/features/base/config/configWhitelist.ts) 裡；舊式的 `TOOLBAR_ALWAYS_VISIBLE` 也在 [`interfaceConfigWhitelist.ts`](https://github.com/jitsi/jitsi-meet/blob/master/react/features/base/config/interfaceConfigWhitelist.ts)。所以 `alwaysVisible` 從 iframe 端設定是走得通的（JaaS 部署版本是否一致仍需實測）。
- Chrome「history manipulation intervention」：沒有 user activation 就 `pushState` 的 entry，按返回時會被跳過且不觸發 `popstate`；有 user activation 就不會被標記。Android 與 WebView 皆適用。（[Chromium docs](https://chromium.googlesource.com/chromium/src/+/main/docs/history_manipulation_intervention.md)、[blink-dev PSA](https://groups.google.com/a/chromium.org/g/blink-dev/c/T8d4_BRb2xQ/m/WSdOiOFcBAAJ)）

## 因果模型：三層疊加，只有一層是 Android 獨有

### A 層（所有瀏覽器都有）：文件高度天生超過一個畫面

`App.vue` 的結構是 `<NavBar>`（sticky，但**仍佔 in-flow 高度** 84px；`sm:` 以上 88px）→ `<RouterView>` → `<Footer>`；而 `JitsiView` 根元素是 `h-screen`（100vh）。

文件總高 = 84 + 100vh + Footer，**無論如何都會出現捲軸**。這個結構是從 neo 繼承來的：`../vue.vTaiwan-neo/src/views/JitsiView.vue` 同樣用 `h-[calc(100vh-5rem)]` 與 `:deep(iframe) { height: calc(100vh - 80px) }`，`App.vue` 同樣是 Header → RouterView → Footer，所以原站在 Android 上理應有相同問題，沒有現成解法可抄。線上版 iframe 是 `100vh − 80px`，與 NavBar 的 84 只差 4px，所以桌機與 DevTools 模擬下「幾乎剛好」，看不出問題。

### B 層（Android Chrome／Custom Tab）：`100vh` ≠ 可視高度

工具列顯示時 `100vh` 多出約 56px，iframe 底部（Jitsi 工具列所在）落到畫面外。這就是 #124「需下滑」的部分，也是電腦上模擬不出來的原因。

### C 層（Jitsi 自身行為）：工具列 4 秒自動隱藏

#124「需下滑 **+ 點選**」的「點選」是 Jitsi 預設行為（`toolbarConfig.alwaysVisible: false`），與版面無關，是獨立的設定旋鈕。議題要求「能固定顯現」對應的就是這個選項。

### sticky 的角色（回答「和 navbar 的 sticky 有無相關」）

- **與 #124：無直接關係。** sticky 本身在 Android 上運作正常；溢出來自 A + B 層的高度計算。sticky 只貢獻了「NavBar 佔 84px in-flow」這個常數。
- **與 #125：直接相關，但屬連鎖反應。** 使用者被迫往下捲 → sticky NavBar（`z-50`）留在頂端 → iframe 頂端滑到它底下 → Jitsi 面板的標題列與 ✕ 被蓋住。頁面不必捲動時就不會發生。

### 為什麼 iPhone「沒問題」——尚未能解釋，不要當成已驗證

iOS Safari 的 `100vh` 同樣是 large viewport，照 A + B 層模型 iPhone 也應該溢出。可能原因（皆未驗證）：測試時走的是工具列不收合的內嵌瀏覽器、Jitsi 在 iOS 的版面不同、或溢出量小到沒注意。**建議在 iPhone 上「剛加入會議、尚未捲動」時重看一次。**

## 對分支上未提交變更（`JitsiView.vue`）的評估

目前分支帶著一份未提交的變更：`80px → 88px`、新增 `#joinMeetingBlock { height: calc(100vh - 88px) }`。

- 方向對（想扣掉 NavBar 高度），但**仍用 `100vh`，B 層沒解**——Android 上照樣溢出約 56px。
- `88px` 是 `sm:` 以上的 NavBar 高度；手機是 84px。而且硬寫數值違反不變量 5——`app.css` 已有 `--spacing-vt-navbar-overlap`（86px）／`-sm`（90px）token。
- 根元素的 `h-screen` 沒動，A 層的「文件必然可捲」也還在。

## 修正方向（調查當時的提案；實際採用的做法見「決議與實作」）

**#124**

1. 高度單位由 `vh` 改為 `dvh`／`svh`（`NavBar.vue` 的手機選單已經在用 `100dvh`，有前例；Tailwind v4 內建 `h-dvh`／`h-svh`／`h-lvh`，不需 arbitrary value）。依 #124 影片「工具列不收合」的證據，傾向 `svh`。
2. 讓「NavBar + 會議區」剛好等於一個可視畫面，頁面不可捲：根元素改為 `calc(100svh − navbar token)`（單位依第 1 點的結論），iframe 用 `100%` 填滿，而不是再各自算一次 `100vh`。
3. `/jitsi` 是否該隱藏 `<Footer>`（或至少讓它不影響首屏）——**需使用者裁定**，這會動到 `App.vue` 的共用外框。
4. `configOverwrite.toolbarConfig.alwaysVisible: true` 讓工具列常駐（key 已確認在白名單內，實機驗一次即可）。

**#125**

1. ✕ 被壓住：隨 #124 修好而消失，不需另外處理。
2. 返回鍵：加入會議（使用者點擊＝有 user activation）時 `history.pushState` 一筆哨兵 entry，攔 `popstate`：
   - chat／participants pane 開著 → 用 API 關掉並重新 push；
   - 否則 → 顯示站內「要離開會議嗎？」確認框（走 i18n 三檔），確認才真的返回。
   - 「⋯ 更多」抽屜無 API，**做不到「返回鍵關閉它」**，只能落到確認框這一支——這點要如實回覆議題。
3. 不可行的做法：只靠 `onBeforeRouteLeave`（上一頁不是 SPA 路由時——例如從 LINE 直接開 `/jitsi`——返回是離開整份文件，router guard 不會跑）；`beforeunload` 對話框在手機上不可靠。
4. SSR 安全：`history`／`popstate` 一律放在 `mounted` 之後（不變量 1）。

**順帶發現（不在兩個議題範圍內）**

- 手機上自家的浮動按鈕組（`fixed right-6 bottom-16 z-50`：設定／麥克風／逐字稿）會壓到 Jitsi 工具列右側的紅色掛斷鍵（#124 影片 t≈13s 可見）。高度修好後工具列會固定在畫面底部，這個碰撞會變成常態，值得另開議題或一併處理。

## 待驗證

- [ ] 回報者是用哪個 App 開的連結？（確認 Custom Tab 推測；#124 影片已顯示該次工具列不收合）
- [ ] 實機用 `chrome://inspect` 比對 `window.innerHeight`、`document.documentElement.clientHeight` 與一個 `100vh` 探針元素的高度，確認約 56px 的差值。
- [ ] JaaS（8x8.vc）實際部署的版本是否與 jitsi-meet master 的白名單一致（`toolbarConfig.alwaysVisible` 實機設一次看工具列是否常駐）。
- [ ] `chatUpdated.isOpen` 在目前 JaaS 版本是否可靠。
- [ ] iPhone 在「剛加入、未捲動」時是否真的沒有溢出。

## 決議與實作（2026-09-21）

使用者裁定：① `/jitsi` 隱藏 Footer；② 返回鍵改跳「離開會議？」確認框；③ 三顆浮動按鈕上移約 50px；④ 其餘依調查結果一次修正，高度用 `svh`，注意 mobile-first。

### 做了什麼

| 檔案                          | 改動                                                                                                                                                                                  |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/router/routes.server.ts` | `/jitsi` 加 `meta.fitViewport: true`                                                                                                                                                  |
| `src/App.vue`                 | `fitViewport` 時外框由 `min-h-screen` 改為 `h-svh overflow-hidden`、內容區加 `min-h-0`、不渲染 `<Footer>`；其他頁面完全不變                                                           |
| `src/views/JitsiView.vue`     | 根元素／會議區／加入畫面／iframe 一律 `h-full`（移除所有 `100vh` 與寫死的 `80px`／`88px`）；浮動按鈕 `bottom-16 → bottom-28`；`toolbarConfig.alwaysVisible: true`；返回鍵守衛＋確認框 |
| `src/l10n/{zh-TW,en,ja}.json` | 新增 `jitsi.leaveConfirm.{title,message,stay,leave}`                                                                                                                                  |

### 與原提案不同之處

- **沒有用 `calc(100svh − navbar token)`。** NavBar 的 in-flow 高度是 84／88px，而 token 是 86／90px（給 `.vt-under-navbar` 的重疊量用的），硬套會差 2px 且要永遠同步兩個斷點。改成「外框鎖 `100svh`、flex 讓會議區吃掉 NavBar 以外的剩餘空間」，整條鏈上沒有任何一個寫死的高度數字。
- **取代了分支上原本的 WIP**（`80px → 88px`、`#joinMeetingBlock`）：那份變更仍以 `100vh` 為基準，B 層問題沒解，已整段換掉。
- **浮動按鈕上移 48px 而非 50px**：`bottom-28`＝112px（原 64px）。剛好 50px 需要 arbitrary value `bottom-[114px]`，違反不變量 5；2px 之差肉眼無感。
- **確認離開＝掛斷並回到加入畫面，不是直接跳回上一頁。** 從 LINE 等 App 直接開 `/jitsi` 時根本沒有上一頁，`history.go(-2)` 會無聲失敗。掛斷後哨兵 entry 會被收掉，使用者再按一次返回鍵就是瀏覽器原生行為。
- **返回鍵不會去關 Jitsi 的 chat／participants 面板**（原提案的加分項）：使用者裁定只要確認框；且 `chatUpdated.isOpen` 有不可靠的前科（jitsi-meet #9262），少一個變數。

### 返回鍵守衛的機制（`JitsiView.vue`）

1. 加入會議時 `history.pushState({ ...history.state, vtJitsiBackGuard: true })` 墊一筆同網址的哨兵。**一定要展開既有 state**：vue-router 把 `position` 等欄位放在 `history.state`，它的 `popstate` 處理遇到空 state 會把那筆 entry 整個 replace 掉。
2. 返回鍵消耗的是哨兵 → `popstate` → 立刻補一筆新哨兵（連按也逃不出去）→ 顯示確認框。
3. 會議結束（Jitsi 自己的掛斷鍵，或確認框的「離開會議」）→ `handleMeetingLeft` → `disarmBackGuard` 以 `history.back()` 收掉哨兵，並用 `ignoreNextPop` 略過這次自己觸發的 `popstate`。
4. 已知邊角：會議中直接點 NavBar 連結離開時，哨兵來不及收，之後一路按返回會多出一格「沒反應」的 `/jitsi`。不影響功能，未處理。

### 已驗證

- `vp check --no-fmt --no-lint`、`vp run build`、`vp run lemma:gen`、`vp check`、`vp test`（25 檔 236 測試）全綠；`vp run lemma:check` 三模組 4 VCs `verified, 0 errors`。
- SSR 輸出：`/jitsi` 外框為 `h-svh overflow-hidden`、無 `<footer>`；`/about` 仍為 `min-h-screen`、有 `<footer>`。
- headless Chrome（384×717 直向、717×384 橫向、1280×800 桌機）：`/jitsi` 的 `scrollHeight === innerHeight`（**完全不可捲**），會議區從 NavBar 底部剛好填到螢幕底；無 hydration 警告。
- `overflow-hidden` 外框不會裁掉 NavBar 手機選單：直向（384×717）與橫向（717×384）下選單面板都完整落在可視區內，最後一個連結可點（橫向時由選單面板自己捲動）。
- 返回鍵守衛在真瀏覽器中逐步驗證（直接驅動元件實例模擬入會）：返回 → 出現確認框且仍在 `/jitsi`；「留在會議」後可再次觸發；間隔 150ms 連按兩次仍留在頁面；「離開會議」後哨兵消失；再按返回正常回到上一頁 `/about`。console 無錯誤，vue-router 的 `position` 全程不變。

### 尚未驗證（需要實機／登入態）

- [ ] **Android 實機**：`svh` 是否真的讓工具列貼齊螢幕底——桌機無法重現 `vh`／`svh` 的差異，目前的依據是影格量測出的 57px 模型，不是實測修復結果。
- [ ] 登入後實際入會：`toolbarConfig.alwaysVisible` 在 JaaS 上是否生效；三顆浮動按鈕在 `bottom-28` 是否確實避開掛斷鍵。
- [ ] Android 系統返回鍵（而非 `history.back()`）觸發確認框——Chrome 的 history manipulation intervention 只作用在瀏覽器 UI 的返回鍵，程式呼叫測不到；入會那一下點擊提供了 user activation，理論上不會被跳過。
- [ ] iPhone 迴歸：確認沒有因 `overflow-hidden` 外框而出現新問題。
