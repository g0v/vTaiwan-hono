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
- [ ] commit 到 `feat/transcript-timestamp-fix`、push 到 fork
- [x] 本機目視：套 migration（`--local`）後按紫色麥克風，確認條目時間是開口時間（見 5.6）
- [x] 實機測試（單機：錄音 + 編輯）
- [ ] 實機測試（雙機同時錄，驗證不互相覆蓋）
- [ ] 回 issue #153 更新進度
