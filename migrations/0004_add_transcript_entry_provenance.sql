-- 逐字稿條目加上來源資訊（#153 步驟 1）
--
-- meeting_transcript_entries 新增兩個欄位：
--   speaker_uid   說話者的帳號 ID（Better Auth user.id）。顯示名稱 `speaker` 可能改名或重名，
--                 帳號 ID 不會；由伺服器端依 WebSocket／REST 的認證結果寫入，不信任客戶端。
--   source        條目怎麼產生的：
--                   'manual' 紫色麥克風手動錄音轉錄
--                   'auto'   自動分軌錄音轉錄（#153 後續步驟）
--                   'jitsi'  Jitsi 內建字幕
--                 舊資料與未知來源為 NULL。
--
-- 同一 migration 也配合程式端把 `ts` 從「轉錄完成時間」改成「開始說話時間」，
-- 並在寫入時避開已被占用的 ts（不再 INSERT OR REPLACE 無聲覆蓋）。
-- schema 本身不變：PRIMARY KEY (meeting_date, ts) 仍是條目的唯一識別。
ALTER TABLE meeting_transcript_entries ADD COLUMN speaker_uid TEXT;
ALTER TABLE meeting_transcript_entries ADD COLUMN source TEXT;
