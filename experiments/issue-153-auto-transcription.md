# 實驗日誌：#153 即時會議逐字稿自動分軌錄製

對應 upstream issue：https://github.com/g0v/vTaiwan-hono/issues/153
實作位置：fork `jiangzuojin226-sys/vTaiwan-hono`

這份日誌有兩個目的：

1. 記錄做了什麼、為什麼這樣做、卡在哪裡。做不完也能讓下一個人接手。
2. 寫給第一次接觸後端開發的人看。每個段落分三層：**做了什麼** → **為什麼** → **這是什麼意思**（名詞解釋用 💡 標示）。

---

## 先弄懂這個系統在做什麼（背景知識）

vTaiwan 開線上會議時，網頁的 `/jitsi` 頁面會做三件事：

1. 用 iframe 嵌入 8x8 公司的 Jitsi 視訊會議。
2. 有人按下「紫色麥克風」，瀏覽器就開始錄**他自己**的聲音，每 30 秒切一段，上傳到我們自己的伺服器。
3. 伺服器把音檔丟給 AI 模型（Whisper）轉成文字，存進資料庫，再透過 WebSocket 即時推給所有與會者看。

💡 **伺服器端在哪裡？** 這個專案沒有自己的機器，程式跑在 Cloudflare 的「Workers」上。你可以想成：把程式碼交給 Cloudflare，它在全世界的機房幫你執行，每次有人連進來就跑一次。

💡 **資料庫 D1**：Cloudflare 提供的資料庫，底層是 SQLite。資料存成一張張「表」，每張表像 Excel 工作表，有欄（column）和列（row）。

💡 **Durable Object（DO）**：Cloudflare 的一種特殊程式。一般 Worker 每次執行都是獨立的、不記得上次的事；DO 則是「一個名字對應一個長期存在的實例」。這個專案用「一個會議日期一個 DO」，所有人的 WebSocket 連線都接到同一個 DO 上，它負責收訊息、寫資料庫、再廣播給所有人。可以想成「這場會議的櫃台人員」。

💡 **WebSocket**：一般網頁是「你問一句、伺服器答一句」（HTTP）。WebSocket 是打開一條一直連著的線，伺服器隨時可以主動推訊息給你。即時逐字稿要讓所有人同時看到新句子，就靠這個。

💡 **主鍵（primary key）**：資料表裡用來「唯一識別一列」的欄位。逐字稿表的主鍵是 `(meeting_date, ts)`，意思是「同一天不能有兩筆時間戳一樣的條目」。

💡 **時間戳（timestamp）**：用「從 1970 年 1 月 1 日到現在經過幾毫秒」這個數字表示時間，例如 `1763539200000`。電腦比字串好處理、好排序。

---

## 2026-11-19 步驟 1：時間戳改成「開始說話的時間」，並避免互相覆蓋

分支：`feat/transcript-timestamp-fix`（從 `main` d40dfba 開出，與 upstream/main 同步）

💡 **分支（branch）**：Git 裡的「平行宇宙」。在分支上改東西不會影響 `main`，改好、測好再合併回去。命名 `feat/...` 是慣例，代表「新功能」。

### 1. 讀程式碼，核對 issue 裡的假設

**做了什麼**：用 `grep` 搜關鍵字、`sed -n` 印出特定行數，逐一對照 issue 寫的是不是真的。

**為什麼**：提案是「推論」出來的，動手前要確認每一句話都對得上程式碼，否則改錯地方。

| issue 的說法         | 程式碼位置                                                                       | 結果 |
| -------------------- | -------------------------------------------------------------------------------- | ---- |
| 固定 30 秒切段       | `JitsiView.vue` `maxRecordingTime: 30 * 1000`                                    | ✅   |
| 時間戳是轉錄完成時間 | `sendAudioToTranscription()` 在 fetch 回來後才 `timestamp: Date.now()`           | ✅   |
| 兩筆可能互相覆蓋     | `meeting-room.ts` `save_entry` 用 `INSERT OR REPLACE`，主鍵 `(meeting_date, ts)` | ✅   |
| 只記一位錄音者       | `meeting_sessions.recording_speaker` 單一欄位                                    | ✅   |
| 轉錄模型             | `src/lib/transcribe.ts` `@cf/openai/whisper-large-v3-turbo`                      | ✅   |

💡 **`INSERT OR REPLACE`**：SQL 指令。「插入一列，如果主鍵已經有人用了，就把那列整個換掉」。方便，但危險：它不會告訴你蓋掉了誰。

💡 **為什麼 `Date.now()` 放錯位置是 bug？** `Date.now()` 回傳「現在」。它寫在「等 AI 轉錄完成之後」，所以記到的是轉錄完成的時間，不是開口說話的時間。音檔排隊越久、AI 越慢，誤差就越大。

### 2. 讀的時候發現、原本沒想到的事

這一段最值得學：**計畫寫得再好，真正讀程式碼時一定會冒出新問題。**

- **編輯和新增走同一條訊息。** `TranscriptPanel` 編輯條目後 emit `update-data`，`JitsiView.updateTranscriptData()` 也是送 `save_entry`，靠 `INSERT OR REPLACE` 覆蓋同一個 ts。所以「撞到 ts 就順延」不能一視同仁，否則編輯會變成新增一筆重複的。
  → **決定**：客戶端新增時帶 `create: true`，編輯不帶。DO 看旗標決定「找空位」或「原地更新」。舊版客戶端不帶旗標 → 走原地更新、找不到就新增，行為跟現在一樣。

  💡 **向下相容（backward compatible）**：部署新版伺服器時，有些人瀏覽器還開著舊版網頁。新伺服器要能看懂舊網頁送來的訊息，不能讓他們壞掉。

- **不能用 entry_id 判斷是不是編輯。** Jitsi 字幕條目的 `id` 可能是 null，歷史資料也可能 entry_id 為 null，用 id 比對會誤判。所以才改用上面的旗標。

- **D1 呼叫不受 DO input gate 保護。** 兩個 `save_entry` 可能在 SELECT 與 INSERT 之間交錯。所以不做「先 SELECT 找空位再 INSERT」，直接 `INSERT OR IGNORE`，`changes === 0` 就代表撞到主鍵，ts + 1 再試。

  💡 **競態條件（race condition）**：兩件事幾乎同時發生、順序不確定，導致結果出錯。例：A 查「1000 這個位置空著」，B 也查「1000 空著」，兩人都寫進 1000，其中一人被蓋掉。解法是用「一步到位」的原子操作：`INSERT OR IGNORE` 是「有空位就寫、沒空位就什麼都不做並回報」，中間不會被插隊。

  💡 **`changes`**：D1 執行完 SQL 後回報「這次改了幾列」。`INSERT OR IGNORE` 回 0 就代表沒寫進去（位置被占了）。

- **歷史日期走 REST 不走 DO。** `/api/meeting/:date/transcript` 也是 `INSERT OR REPLACE`，要一起改，否則同一個 bug 留一半。兩邊共用 `src/server/lib/meeting-entries.ts`。

  💡 **REST**：一般的 HTTP API，「送一個請求、拿一個回應」。今天的會議用 WebSocket 即時同步；校對過去日期的逐字稿就用 REST 一次讀寫，不用一直連著。

  💡 **DRY（Don't Repeat Yourself）**：同一段邏輯只寫一次、兩邊共用。寫兩份的話將來修 bug 一定會忘記改其中一份。

- **樂觀更新會留下舊 key。** 客戶端新增時先把條目放進 `transcriptData[requestedTs]`，若伺服器順延成 ts+1 再廣播回來，本機會同時有 `requestedTs` 和 `ts+1` 兩筆。
  → `entry_saved` 訊息多帶 `replaces: requestedTs`，客戶端收到就把舊 key 刪掉。其他客戶端本來就沒有那個 key，刪了無副作用。

  💡 **樂觀更新（optimistic update）**：先在畫面上顯示「已完成」，再等伺服器確認。好處是感覺很快；壞處是伺服器如果改了什麼，要有辦法修正畫面。

- **TranscriptPanel 用 `Object.values()` 顯示。** JavaScript 對「看起來像整數的字串 key」會自動按數值排序，所以時間戳一改成開始說話時間，順序就自動對了，不用另外排序。這是 JS 的一個冷知識，剛好幫了我們。

- **`speaker_uid` 由伺服器填。** WebSocket 連線在 upgrade 時已把 `userId` 綁在 attachment 上，REST 也有 `authCtx.user.id`。不信任客戶端送來的 uid。

  💡 **為什麼不信任客戶端？** 網頁的程式碼在使用者電腦上跑，任何人都能打開開發者工具改掉送出的資料。所以「我是誰」這種事一律由伺服器根據登入狀態判斷，不看客戶端自己宣稱什麼。這是後端安全的基本原則。

- **測試環境有 `cloudflare:workers` 的 shim**（`src/shims/cloudflare-workers.ts`），所以 DO 和 server lib 可以在 vitest 裡用假的 D1 直接測。

  💡 **shim**：一個「假的替身」。真的 `cloudflare:workers` 只有在 Cloudflare 上才有，本機跑測試時沒有，就放一個長得一樣但什麼都不做的替身讓程式能載入。

### 2.5 測試抓到一個我自己設計上的 bug（這段最值得看）

**發生什麼事**：第一版我讓伺服器把 `entry_saved` 連同 `replaces: 1000` **廣播給所有人**。寫測試時模擬這個情境：

1. Alice 的條目已經正當占用 ts=1000。
2. Bob 同一毫秒新增，被伺服器順延到 1001，廣播 `{ entry: Bob@1001, replaces: 1000 }`。
3. Alice 的瀏覽器收到後，照 `applyEntrySaved` 的規則把 key 1000 刪掉。**Alice 自己的條目從畫面上消失了。**

測試在 `expect` 那行紅燈，我才發現 `replaces` 的語意是「**你**樂觀放在 1000 的那筆要換掉」，這句話只對 Bob 成立，對 Alice 不成立。

**怎麼修**：伺服器改成兩種訊息。

- 給其他所有人：`{ type: 'entry_saved', entry: Bob@1001 }`（不帶 replaces）。
- 只給 Bob 這條連線：`{ type: 'entry_saved', entry: Bob@1001, replaces: 1000 }`。

`broadcast()` 多一個 `except` 參數跳過送出者，再用 `send()` 單獨回給他。

**學到什麼**：

- 「廣播」和「回覆」是兩種不同的訊息。只有送出請求的人才知道自己剛才樂觀地放了什麼，所以修正指令只能給他。
- 寫測試不是「驗證我寫對了」，而是「逼自己把每個角色的視角都走一遍」。這個 bug 在單人測試永遠不會出現，只有「第三個人在旁邊看」的情境才會。
- 這就是為什麼 issue 裡說要「單機、雙機、三人以上」三輪實測。

💡 **為了不讓這個錯誤回來**，加了 `src/tests/meeting-room.test.ts`：直接建構 Durable Object（靠 shim），用假的 WebSocket 和假的 D1 模擬三條連線，斷言「只有送出者收到 replaces」。以後有人改回廣播，CI 會紅燈。

### 2.7 考古：原先的程式為什麼不記開口時間（2026-11-19 晚上補）

修完之後回頭問：當初為什麼會這樣寫？看了 hono 第一版（Firebase 時代）、原站 `vue.vTaiwan-neo` 的 git 歷史和對應 issue，整理如下。

**演化時間線（neo）**

| 日期       | commit / issue | 發生什麼                                                                                                                 |
| ---------- | -------------- | ------------------------------------------------------------------------------------------------------------------------ |
| 2025-06-16 | ee7e5b6，#28   | 先建 Jitsi 會議元件，逐字稿還沒做                                                                                        |
| 2025-06-21 | e75f7da        | 接 JaaS 的**英文字幕**。字幕事件來一句存一句，`timestamp: new Date().getTime()` 第一次出現                               |
| 2025-06-30 | 00b6972，#42   | 中文字幕等不到客服，改成**自己錄音上傳 Whisper**。直接複製字幕那段的寫法：轉錄回來後 `timestamp: Date.now()`。每段 10 秒 |
| 2025-07-09 | #44            | 使用者反映太短想調 2 分鐘，最後折衷 30 秒                                                                                |
| 2025-08-17 | a074e00，#85   | 改成「按一下開始、按一下停止」                                                                                           |
| 2025-08-17 | e7f7424，#87   | 轉錄中也能按停，音檔**排隊**延後上傳                                                                                     |
| 2026-07-15 | hono 3732066   | 整段原樣搬進 vTaiwan-hono                                                                                                |
| 2026-08    | hono #81       | Durable Object + D1 取代 Firebase，timestamp 變成資料表主鍵                                                              |

**四個推論**

1. **timestamp 一開始的用途是「當 key」，不是「記時間」。** 最早的字幕版本把每句存成 `transcriptData[timestamp]`，timestamp 的功能是給這句一個不重複的編號。字幕幾乎即時到達，「收到」和「說話」差不到一秒，沒有人需要區分兩者。
2. **錄音功能是從字幕程式碼複製來的，沿用了同一行。** 6/30 的 commit 是為了繞過 JaaS 中文字幕問題的實驗，`sendAudioToTranscription` 結尾和字幕的 `commitTranscriptCache` 幾乎一樣。那時每段只有 10 秒、轉錄完立刻顯示，晚幾秒在畫面上看不出來。
3. **當時沒有排隊，延遲不會累積。** 6/30 版本是錄完一段、送出、等結果、再錄下一段。到 8/17 #87 加佇列後誤差才會隨排隊變長。那次 commit 其實在佇列項目存了 `timestamp: new Date().toISOString()`，代表作者意識到「這段音檔是什麼時候的」，但只拿來印 log，**沒有接到條目上**。資料有了、線沒牽。
4. **Firebase 時代不存在「覆蓋」問題，timestamp 不需要精確。** hono 第一版的 `updateMeetingData()` 是把**整個** `transcriptData` 一次 `set` 到 `/meetings/{日期}/transcripts`，每次有新句子就重寫整本，誰最後寫誰贏。timestamp 只要在同一個人的瀏覽器裡不重複就好。#81 換成 D1 後，timestamp 升格成主鍵 `(meeting_date, ts)` 並用 `INSERT OR REPLACE` 逐筆寫，但產生它的那行沒跟著升級。這次修的就是這個落差。

💡 **這是很常見的 bug 成因**：一個欄位原本只有 A 用途（編號），系統演化後多了 B 用途（排序、唯一鍵），但產生它的程式還停在 A 的假設上。每一步單獨看都合理，合起來就出問題。沒有人做錯，只是換底層時沒人回頭看這一行。

💡 **一人錄音永遠看不出來**：單人時條目依序產生，就算時間晚幾秒，順序仍對。要兩人同時錄、其中一人的音檔在排隊，順序才會錯。

💡 **怎麼考古**：`git log -S '某段字串' -- 檔案` 可以找出「這段字串是哪次 commit 加進來的」；`git show <commit>:<路徑>` 可以看當時整個檔案長什麼樣。配合 issue 編號就能還原當初的決策脈絡。

### 3. 改動清單

- `migrations/0004_add_transcript_entry_provenance.sql`：加 `speaker_uid`、`source` 兩欄。

  💡 **migration**：資料庫結構的「變更紀錄」。每個檔案是一次改動（加欄位、建表），依編號順序執行。這樣所有環境（本機、正式）的資料庫結構才會一致，也能追溯誰在什麼時候改了什麼。

- `src/lib/transcript-entries.ts`（新，前後端共用純邏輯）：`TranscriptEntry` 型別、`normalizeTranscriptSource()`、`applyEntrySaved()`。

  💡 **純函式（pure function）**：給同樣輸入一定得到同樣輸出、不碰外界（不讀資料庫、不碰網頁）的函式。最好測試，因為不需要準備環境。這個專案的規矩是：能抽成純函式的邏輯就抽出來放 `src/lib/`。

- `src/server/lib/meeting-entries.ts`（新，只在 Worker）：`insertTranscriptEntry()` 找空位寫入、`updateTranscriptEntry()` 原地更新、找不到退回新增。
- `src/durable-objects/meeting-room.ts`：`save_entry` 改用上面兩個函式；`entry_saved` 多帶 `replaces`；讀取時回傳 `speakerUid`、`source`。
- `src/server/api/meeting.ts`：REST 新增／編輯比照 DO；回應帶實際寫入的 `timestamp`。
- `src/views/JitsiView.vue`：
  - 每輪錄音開始時記 `startedAt`，跟著音檔進 `audioQueue`，轉錄完成後用它當 `timestamp`。
  - 新增條目送 `create: true`，編輯不送。
  - 錄音條目 `source: 'manual'`，Jitsi 字幕條目 `source: 'jitsi'`。
  - `entry_saved` 用 `applyEntrySaved()` 處理 `replaces`。
- 測試：新增 `transcript-entries.test.ts`、`meeting-entries.test.ts`；調整 `audio-recording.test.ts`。

### 4. 部署時要注意

- **先套 migration 再部署程式。** 新程式的 INSERT 會寫 `speaker_uid`／`source`，欄位不存在會 500。
  ```
  vp exec wrangler d1 migrations apply vtaiwan-transcriptions --remote
  ```
  本機開發同理（`--local`）。
- 舊版前端（部署前已開著的分頁）送的 `save_entry` 不帶 `create`，會走原地更新→找不到就新增，行為與現在一致。

### 5. 驗收結果（2026-11-19 18:55）

依 AGENTS.md 的四道關卡：

| 關卡               | 指令                 | 結果                                                       |
| ------------------ | -------------------- | ---------------------------------------------------------- |
| 型別 + lint + 格式 | `vp check`           | ✅ 160 檔格式正確，143 檔無錯                              |
| 自動測試           | `vp test`            | ✅ 32 個測試檔、322 個測試全過（新增 3 檔 + 2 個案例）     |
| 建置               | `vp run build`       | ✅ server + client 都建成                                  |
| 形式驗證基底       | `vp run lemma:gen`   | ✅ 3/3 模組生成成功                                        |
| Dafny 驗證         | `vp run lemma:check` | ⏭ 本機沒裝 Dafny，交給 CI（本次沒動到帶 `//@` 標注的檔案） |

💡 **為什麼要四道關卡？** 型別檢查抓「寫錯型別」、lint 抓「寫法不好」、測試抓「行為錯」、建置抓「組不起來」。每一道抓的錯不一樣，少一道就有一類 bug 溜過去。

💡 **`vp check --fix`**：格式工具自動把縮排、換行排整齊。團隊共用同一套格式，diff 才不會被「我習慣兩格你習慣四格」淹沒。

### 5.5 本機實測前的環境問題（2026-11-19 19:00–19:15）

**做了什麼**：套本機 migration、開 `vp run dev`，請使用者在瀏覽器登入後按紫色麥克風。

**卡住的地方與解法**，按發生順序：

1. **「無法取得會議權杖」**：本機 `.dev.vars` 的 `JAAS_*` 三個值是範本佔位字，簽不出 8x8 的 JWT。真金鑰只有 g0v 維護者有。
   → 不影響測試：紫色麥克風與逐字稿同步只看登入與 `meeting.join` 權限，不用進 Jitsi 會議。
2. **轉錄請求 23 ms 就回應、資料庫沒新條目**：Whisper 不可能這麼快，代表還沒呼叫 AI 就失敗了。
   用不需登入的 `POST /api/transcription/test-ai` 探測，伺服器 log 寫 `Binding AI needs to be run remotely`。
   → 一般 `vp run dev` 不開 AI 綁定（Workers AI 只能在雲端跑）。專案的 `dev:remote` 會開，**但它同時把 D1 / R2 也切到正式站**，
   而且這些資料庫在 g0v 的 Cloudflare 帳號下，使用者的帳號看不到，更不該拿正式資料庫做實驗。
3. **解法：一份只給實驗用的設定，放在 scratchpad 不進 repo**：
   - `wrangler.local.jsonc`：D1 / R2 拿掉 `remote: true`（留本機），`ai` 加 `remote: true`。
   - `vite.local.config.mts`：指定上面的 configPath、`remoteBindings: true`、`persistState` 指回專案的 `.wrangler/state`（本機 D1 已套好 0004）。
   - scratchpad 裡放 `node_modules` 與 `.dev.vars` 的符號連結，讓設定檔找得到套件與本機密鑰。
   - 啟動：`npx vp dev -c <scratchpad>/vite.local.config.mts`，跑在 **http://localhost:5176**。
   - 驗證：`test-ai` 端點回傳了 gpt-oss-120b 產生的大綱 → AI 綁定可用；`/api/meeting/20261119` 讀本機 D1 正常。
4. 中途還撞到一次 `This package is ESM only but it was tried to load by require`：設定檔放在沒有 `package.json` 的目錄會被當 CommonJS，副檔名改 `.mts` 即可。

💡 **綁定（binding）**：Worker 程式碼裡用 `env.DB`、`env.AI` 這些名字取用資源，名字和實際資源的對應寫在 wrangler 設定裡，這個對應就叫綁定。本機開發時每個綁定可以各自決定「用本機模擬」或「連雲端真的」。

💡 **為什麼 Google 登入的 cookie 在 5176 也能用？** 瀏覽器的 cookie 只認主機名（localhost），不分埠號。所以在 5173 登入過，5176 也帶著同一個 session。

💡 **教訓**：環境問題花的時間常常比寫程式多。先用最便宜的探測（這裡是一個不需登入的端點加 curl）把問題縮小到一句錯誤訊息，再決定要改什麼。

### 5.6 實機測試：單機（2026-11-19 19:14）✅

使用者在 http://localhost:5176/jitsi 登入後（未進 Jitsi 會議），按紫色麥克風講了兩段話，各按一次停止。

**伺服器側證據**（本機 D1 `meeting_transcript_entries`，時間為台北時間）：

| 條目 ts（開口時間） | 上傳請求抵達 | 差距          | speaker_uid             | source   | 文字              |
| ------------------- | ------------ | ------------- | ----------------------- | -------- | ----------------- |
| 19:14:11.640        | 19:14:17.524 | 開口早 5.9 秒 | `ag21…HjxT`（伺服器填） | `manual` | 測試測試測試測試  |
| 19:14:20.899        | 19:14:25.137 | 開口早 4.2 秒 | 同上                    | `manual` | 再次測試 再次測試 |

**判讀**：

- 條目時間比上傳時間早好幾秒，證明 timestamp 已經是「開始錄」的時間，不是轉錄完成的時間。改之前這兩個數字會幾乎一樣（甚至條目時間更晚，因為還要等 Whisper）。
- `speaker_uid` 是 Better Auth 的 user.id，由伺服器從 session 填入；`source = manual` 對應紫色麥克風。
- `entry_id = audio_<開口時間>`，與 ts 一致。

💡 **怎麼讀這張表？** 「上傳請求抵達」是伺服器 log 裡 `POST /api/transcription/zh-TW` 的時間，「條目 ts」是資料庫裡存的時間。兩者相減就是「錄音長度 + 上傳時間」。如果 bug 沒修，條目 ts 會比上傳請求還晚（要再加 Whisper 處理時間）。

**編輯測試（19:20）✅**：使用者在面板上把兩條各加了幾個字後儲存。D1 查詢結果：仍是 2 筆、ts 不變、`speaker_uid` 與 `source` 保留、只有 `text` 變成「測試測試測試測試＋編輯測試」「再次測試 再次測試＋編輯」。伺服器無錯誤。證明「編輯走原地更新、不順延」與「編輯不會蓋掉伺服器填的 speaker_uid」兩條規則在實機成立。

**還沒驗的**：

- 雙機同時錄音的 ts 衝突順延：單元測試 `meeting-room.test.ts` 已覆蓋協定；實機要兩個帳號在同一毫秒開口才會觸發，機率極低，屬「理論正確、實機難重現」的那種。

### 6. 進度

- [x] 開分支
- [x] migration 0004
- [x] 共用純邏輯模組
- [x] server 寫入模組
- [x] DO 改動（含 replaces 只回送出者的修正）
- [x] REST 改動
- [x] JitsiView 改動
- [x] 測試（transcript-entries / meeting-entries / meeting-room / audio-recording）
- [x] `vp check` / `vp test` / `vp run build` / `vp run lemma:gen` 全綠
- [x] commit 到 `feat/transcript-timestamp-fix`、push 到 fork，開 draft PR #154
- [x] 本機目視：套 migration（`--local`）後按紫色麥克風，確認條目時間是開口時間（見 5.6）
- [x] 實機測試（單機：錄音 + 編輯）
- [ ] ~~實機測試（雙機同時錄，驗證不互相覆蓋）~~ 已隨碰撞處理一併撤回（見下一節）
- [x] 回 issue #153 更新進度

---

## 2026-11-20 步驟 1 縮減：只留時間戳修正，撤回 migration 與碰撞處理

維護者 2026-11-19 晚上在 issue #153 回覆四點意見，其中兩點直接影響這個 PR：

- **同意**「時間戳改為每輪錄音開始的時間」。
- **暫不新增 `migrations/0004`**：依目前使用情境，同毫秒碰撞的機率極低，資料庫調整與處理成本超過效益，請以不新增 migration 的方式調整 PR。

另外兩點（保留主動轉錄的 UX、顯示所有轉錄中的參與者）屬於後續步驟，與本 PR 無關；issue 方向的討論見 issue 留言。

💡 **為什麼聽維護者的，而不是堅持「我已經寫好了」？** 開源專案的維護者要對整個系統的長期複雜度負責。一個功能寫好了不等於應該合進去——每多一張欄位、一條特殊路徑，之後每個人讀程式碼都要多理解一件事。這叫**維護成本**，而且是由維護者承擔，不是由貢獻者承擔。碰撞處理解的是「幾乎不會發生」的問題，撤回是合理的取捨。寫過的程式碼與測試留在 git 歷史（commit 149f2b1），將來真的需要時可以撿回來。

### 1. 撤回的東西

| 項目                                                                                                    | 處理                                                                                                             |
| ------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `migrations/0004_add_transcript_entry_provenance.sql`（`speaker_uid`／`source` 欄位）                   | 刪除                                                                                                             |
| `src/lib/transcript-entries.ts`（`TranscriptEntry`／`normalizeTranscriptSource`／`applyEntrySaved`）    | 刪除                                                                                                             |
| `src/server/lib/meeting-entries.ts`（`insertTranscriptEntry` 找空位／`updateTranscriptEntry` 原地更新） | 刪除                                                                                                             |
| `src/durable-objects/meeting-room.ts`                                                                   | 還原成 main：`save_entry` 回到 `INSERT OR REPLACE`，`entry_saved` 不帶 `replaces`，`broadcast()` 不再有 `except` |
| `src/server/api/meeting.ts`                                                                             | 還原成 main：不收 `create`／`source`，回應不帶 `timestamp`                                                       |
| `JitsiView.vue` 的 `create: true/false` 旗標、`source: 'manual'/'jitsi'`、`applyEntrySaved`             | 移除                                                                                                             |
| 測試 `transcript-entries` / `meeting-entries` / `meeting-room` 與 `helpers/fake-d1.ts`                  | 刪除（測的對象已不存在）                                                                                         |

### 2. 保留的東西（PR 的全部內容）

- `JitsiView.vue`：每輪錄音開始時記 `roundStartedAt`，跟著音檔進 `audioQueue.startedAt`，轉錄完成後拿它當條目的 `timestamp` 與 `id`。`meetingData.recordingStartTime` 也改用同一個值。
- `audio-recording.test.ts` 新增的兩個案例：音檔帶著開始時間進佇列、條目 timestamp 是開始時間而非轉錄完成時間。只拿掉對 `source: 'manual'` 的斷言。
- 這份實驗日誌。

### 3. 縮減後的驗收（2026-11-20 14:00）

| 關卡                 | 結果                                                                        |
| -------------------- | --------------------------------------------------------------------------- |
| `vp check`           | ✅ 154 檔格式正確，137 檔無錯                                               |
| `vp test`            | ✅ 29 個測試檔、291 個測試全過（比昨天少 3 檔 31 個，是刪掉的那三個測試檔） |
| `vp run build`       | ✅                                                                          |
| `vp run lemma:gen`   | ✅ 3/3                                                                      |
| `vp run lemma:check` | ⏭ 本機沒裝 Dafny，交給 CI；本次未動帶 `//@` 標注的檔案                      |

💡 **為什麼刪了程式碼還要全部重跑？** 刪東西比加東西更容易漏：某個檔案 import 了被刪的模組、某個測試還在斷言被拿掉的欄位，都只有跑過才知道。這次 `vp check` 的型別檢查就是抓「有沒有人還在 import 已刪除模組」的那道閘。

### 4. 部署時要注意（更新）

**不再需要套 migration。** 昨天寫的「先套 migration 再部署」已失效；縮減後的 PR 只改前端 `JitsiView.vue`，部署流程與平常一樣。本機 D1 若已套過 0004，多出來的兩欄不影響程式運作（`INSERT OR REPLACE` 沒列出的欄位會是 NULL），不必回滾。

### 5. 方向討論：issue 寫錯了什麼、原意是什麼（2026-11-20 上午）

**做了什麼**：重讀 issue 內文，對照維護者的回覆，發現 issue 把兩個不同的想法混在一起寫，維護者讀到的是錯的那一個。

**issue 裡互相矛盾的兩組敘述**

- 原意（只出現在提案方向第 2 點與步驟 3）：「Jitsi 裡靜音就停、取消靜音就錄。Jitsi 的麥克風開關就是轉錄開關。」也就是跟 Zoom／Teams 一樣，每個人自己管麥克風，開麥才會被轉錄。
- 蓋過原意的敘述（標題、背景第 1 點、提案方向第 1 點、步驟 4）：「自動分軌錄製」「要有人記得按」是缺點、「入會即自動開始」「本會議全程轉錄」。這些讀起來是「一進會議就錄所有人」。

**關鍵事實**：`JitsiView.vue` 已設定 `startWithAudioMuted: true`，所有人入會時麥克風預設是關的。所以在原意的模式下，「入會即自動開始錄」根本不會發生——這兩組敘述在現有設定下是互斥的，寫的時候沒抓到。

💡 **寫提案的教訓**：把「機制」（麥克風開關觸發）和「效果」（不用再按）分開寫。這次把效果寫成「自動」，讀者就把它理解成「不受控」。真正要表達的是「開關換了一個位置」，不是「沒有開關」。

**原意與維護者要求的實際差距**

| 面向             | 維護者要求         | 原意               |
| ---------------- | ------------------ | ------------------ |
| 誰決定自己被轉錄 | 使用者自己         | 使用者自己         |
| 開關在哪         | 紫色麥克風         | Jitsi 麥克風按鈕   |
| 預設狀態         | 不轉錄             | 不轉錄（預設靜音） |
| 多人同時轉錄     | 顯示所有轉錄中的人 | 同樣需要           |

差距只有一個：**保留紫色麥克風當第二個開關（方案 B），還是讓 Jitsi 麥克風直接兼任（方案 A）**。

### 6. 考古：為什麼原先會有紫色麥克風（2026-11-20 上午）

**做了什麼**：讀 neo 的 issue 時間線，找「為什麼要加按鈕」的理由。沒有任何文件寫明，但可以拼出來。

| 日期        | 事件                                                                                                                                            |
| ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| 2025-06-15  | neo #28：想用 JaaS 付費字幕（每分鐘 0.06 美元），英文可用、中文等不到客服。原本就是「開麥就有字幕」，沒有按鈕                                   |
| 2025-06-30  | neo #42 ＋ transcription-worker #4：「優先嘗試自架轉錄分軌音訊」。第一版按鈕文案「開始錄音轉錄（最多 10 秒）」。按鈕誕生                        |
| 2025-07-09  | neo #44：10 秒太短，調到 30 秒                                                                                                                  |
| 2025-07-30  | neo #77：分享螢幕時換頁會中斷，改成不在焦時自動續錄                                                                                             |
| 2025-08-01  | **neo #82（維護者自提）：「自動記錄模式：只要有開麥克風就自動開啟語音記錄，解決忘記開的問題」**。唯一留言自問「跟 #77 重疊？」，8/13 關閉未實作 |
| 2025-08-03  | neo #81：社群要求入會預設關麥、關鏡頭，當天改好                                                                                                 |
| 2025-08-11  | neo #83：顯示「誰按了紫色麥克風正在發言」                                                                                                       |
| 2025-08-13  | neo #84：研究用 JaaS「主要發言者藍框」觸發轉錄。結論：藍框是出聲之後才偵測到，用它觸發會漏掉開頭                                                |
| 2025-08-16  | neo #85、#87：按一下開始、按一下停止，加上傳佇列。按鈕定型                                                                                      |
| 2026-09、10 | neo #157 顏色改回紫色加 tooltip、#165 修「某某人轉錄中」不顯示給別人                                                                            |

**第一版是按鈕的三個技術理由（推論）**

1. Jitsi 在 `8x8.vc` 的 iframe 裡，同源政策下拿不到它的音訊。第一版程式碼註解寫「獨立的音訊流，不影響 Jitsi Meet」，網頁要自己再開一次 `getUserMedia`，按鈕是最直接的觸發方式。
2. 它是從字幕流程複製出來的實驗，只想驗證 Whisper 轉中文行不行，10 秒一段、按了才錄是最小驗證方式。
3. 每段音檔都要花 Whisper 算力，按了才錄可以避免轉錄靜音。

**為什麼後來沒改成「開麥即轉錄」（推論）**：#82 被 #77 的解法岔開——「不在焦時自動續錄」解掉了最痛的情境，痛感降低後 #82 就關了。#84 繼續找的是「發言偵測觸發」，沒有往「麥克風開關事件」想，而 `audioMuteStatusChanged` 一直都在。之後一年按鈕累積了 #83、#157、#165 等功能與修 bug，成為大家認得的介面；到 2026-11-19 的回覆，它被賦予「知情同意的保障」這層意義——這是事後長出來的理由，不是 2025 年 6 月設計它的原因。

💡 **考古的價值**：知道「現狀是怎麼來的」才能判斷它是「刻意的設計」還是「實驗留下來的慣性」。這次的發現讓討論從「新人要推翻既有設計」變成「接續維護者自己擱置的想法（#82）」，說服力完全不同。

### 7. 「後端已能處理多人同時轉錄」是真的嗎？（2026-11-20 上午）

維護者回覆說「目前後端已能處理多人同時轉錄，但 UI 只顯示一位轉錄者」。對了一次程式碼，結論是**「不阻擋」，不是「有管理」**：

- `/api/transcription/:lang` 只檢查 `meeting.join` 權限，不看誰是錄音者；DO 的 `save_entry` 收到什麼就寫什麼。多人同時錄，各自的條目都會進表。這部分對。
- 但 `meeting_sessions` 只有一格 `recording_speaker`、一格 `recording_start_time`。`sync_recording` 是誰最後送誰贏。甲在錄、乙按下又停掉送 `null`，所有人看到「沒人在錄」，但甲還在錄。每輪 30 秒重開時還會再 sync 一次，兩人同時錄時名字每 30 秒互相蓋。
- 前端 `toggleAudioRecording` 沒有「別人在錄就不給按」的檢查，自己的 `isRecordingAudio` 存在本機不受別人影響，所以多人可以同時錄、不會被互相停掉。

**結論**：「只改前端顯示」不夠，資料模型只有一格。要讓 DO 在 WebSocket attachment 維護一份「轉錄中名單」並以新訊息廣播，前端改顯示名單。不需要 migration。

### 8. 方案 A 的技術可行性與費用（2026-11-20 上午）

兩件事都查了官方文件，不憑印象。**以方案 A（拿掉紫色麥克風、Jitsi 麥克風兼任開關）為前提**。

**iframe 架構不會擋住這個做法**：iframe API 的 `audioMuteStatusChanged` 事件（送 `{ muted: boolean }`）與 `isAudioMuted()` 函式都是官方文件列出的功能。收到 `muted: false` 就呼叫現有的 `startAudioRecording()`、`muted: true` 就 `stopAudioRecording()`，30 秒切段、佇列、倒數全部沿用。

**要實測的三件事**（都是「頁面自己開第二條麥克風」造成的，A／B 都有，A 會從偶爾變成必然）：

1. **麥克風對不上**：`deviceId` 依網域不同，Jitsi 用的跟我們錄的可能不是同一支。用 `getCurrentDevices()` 取裝置名稱比對本站 `enumerateDevices()` 清單。名稱要在權限同意後才看得到。
2. **同一支麥克風同時兩條音訊流**：桌機 Chrome 沒問題；neo #120 回報某些 iOS 版本紫色麥克風不能用，iPhone 要重點測。
3. **權限視窗跳兩次**：iframe 一次、本站一次。時機會從「按紫色時」變成「第一次開麥時」。

回音問題照舊：錄的是自己麥克風，別人的聲音從喇叭出來也會被收到，戴耳機才解。這是物理限制。

**費用**：JaaS、D1、R2、DO 都不變，只有 Workers AI 的 Whisper 會變。`whisper-large-v3-turbo` 每分鐘音檔 0.0005 美元（46.63 neurons），免費額度每天 10,000 neurons 約 214 分鐘。**算式對 A／B 一樣：所有人轉錄開關開著的分鐘數加總，不管有沒有在說話。** 2 小時、10 人會議試算：

| 情境                                   | 音檔分鐘 | 費用（美元） |
| -------------------------------------- | -------- | ------------ |
| 方案 B（現況）：一人按紫色麥克風錄全場 | 120      | 0.06         |
| 方案 A：大家守規矩，平均 2 人開麥      | 240      | 0.12         |
| 方案 A：10 人全程不關麥                | 1,200    | 0.60         |

金額小，但 A 的靜音分鐘變多會帶來兩個副作用：Whisper 對靜音的幻覺輸出變多（現有過濾「字幕志願者」等假字的邏輯會更吃重）、免費額度可能單場會議就用完。這就是原提案要有 VAD 那一步的原因；先擱置，用「大家自己管麥克風」當成本控制。

💡 **neuron**：Cloudflare 自訂的 AI 用量單位，不同模型換算不同，可以想成「AI 算力的點數」。

來源：Cloudflare Workers AI Pricing、whisper-large-v3-turbo 模型頁、Jitsi IFrame API Events／Functions 文件。

### 9. 回 issue 與更新 PR（2026-11-20 下午）

- issue #153 第一則留言：承認寫法誤導、說明原意、提出方案 A／B 請裁定、附上三個地雷與費用試算、其餘三點照辦。
- **踩到一個 GitHub 的坑**：留言寫 `neo #82`、`#84`，貼在 vTaiwan-hono 會被自動連到 **hono 自己的** #82、#84（後者是「修訂貢獻者」，所以句子裡冒出這串字）。改成 `g0v/vue.vTaiwan-neo#82` 這種跨 repo 完整寫法才會連對。

  💡 **跨 repo 參照**：GitHub 的 `#數字` 永遠指「這個 repo」的 issue。要指別的 repo 要寫 `owner/repo#數字`。

- PR #154：commit 03b2114 推到 fork，PR 標題改為「fix: 逐字稿時間戳改為開口時間（#153 步驟 1）」，說明改寫為縮減後範圍並加「歷史」段落註明第一版留在 149f2b1。從 draft 轉為 ready for review。
- issue #153 第二則留言：回報 PR 已縮減、等方案 A／B 裁定、裁定後才修 issue 標題與內文。不 tag 任何人，參與者會自動收到通知。

### 10. 進度（2026-11-20）

- [x] 重讀 issue，找出與原意矛盾的敘述
- [x] 考古 neo 的紫色麥克風由來（#28 → #42 → #82 → #84）
- [x] 核對「後端已能處理多人同時轉錄」的實際程度
- [x] 查 Jitsi iframe API 與 Whisper 計費，整理三個地雷與費用試算
- [x] 回 issue #153 澄清原意、提方案 A／B
- [x] PR #154 縮減、驗收全綠、push、改標題說明、轉 ready for review
- [x] 回 issue #153 回報縮減進度
- [x] 等維護者裁定方案 A／B → 方案 B
- [x] 裁定後修訂 issue #153 標題與內文（拿掉「自動」「全程」「入會即」）
- [ ] 依 PR #154 審閱意見修改
- [ ] 步驟 2（轉錄中名單）等 PR #154 合併後開新分支

### 11. 維護者裁定方案 B，修訂 issue（2026-11-20 下午）

維護者 15:03 回覆：**採方案 B**，保留紫色麥克風作為獨立開關，再加轉錄名單顯示。理由：vTaiwan 小松有社群聚會性質，不是全程轉錄的工作會議；Jitsi 麥克風開著時與會者可能在閒聊或私人溝通，不是每句都想被轉錄，知情同意要保留。

💡 **為什麼接受**：原本的 Zoom 模式假設是「開麥等於對全場發言」。在小松的場域裡開麥聊天是常態，這個假設不成立。這是場域特性，不是技術問題。

**修訂 issue 前先釐清「提案跟現況差在哪」**：對照程式碼後確認，現行程式已經可以多人同時按紫色麥克風，各自的條目都會寫進同一份逐字稿。方案 B 沒有新增任何能力，剩下的只有兩件事：讓已有的能力**被看見**（名單取代單格顯示）、讓多人的條目**排對順序**（PR #154）。issue 內文照這個角度改寫，新增「現況」與「不會改變的事」兩節，避免讀者以為是新功能。

**修訂結果**：標題改為「改善多人同時轉錄的體驗：顯示所有轉錄中的參與者，並修正逐字稿時間戳」，內文全面改寫，原文備份在 [`issue-153-original-proposal.md`](./issue-153-original-proposal.md)。

**過程中的一個小插曲**：改 issue 內文的指令被 Claude Code 自動模式的安全分類器擋下（覆寫公開 issue 屬不可逆的外部修改），改由使用者在提示列以 `!` 前綴親自執行三行指令：備份原文、改標題與內文、留言。這個設計是對的——AI 代理不該自行覆寫別人也在看的公開內容。
