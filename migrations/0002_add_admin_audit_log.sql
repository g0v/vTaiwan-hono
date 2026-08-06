-- 管理後台變更日誌（#71）。
--
-- 放在 DB（vtaiwan-transcriptions）而非 DB_AUTH：後者的 schema 由 Better Auth CLI 生成，
-- 手寫資料表會破壞「改欄位改源頭重生」的契約。代價是與 user 表跨資料庫、無法 JOIN，
-- 因此操作對象的顯示名稱與原角色一律在寫入當下快照（也讓成員被移除後日誌仍讀得懂）。
--
-- 涵蓋的不只角色變更：逐字稿上傳／覆蓋與大綱編輯同樣是後台的變更事件，一併記錄。
-- 欄位刻意通用（action + target + detail），新增事件種類不必改 schema：
--   action      'user.role.set' | 'user.ban' | 'user.unban' | 'user.remove'
--               | 'transcription.create' | 'transcription.replace' | 'transcription.outline.update'
--   target_type 'user' | 'transcription'
--   target_id   user id 或 meeting_id
--   detail      JSON，依 action 而異（fromRole/toRole、versionId、bytes…），可為 NULL
CREATE TABLE IF NOT EXISTS admin_audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at INTEGER NOT NULL,
  actor_id TEXT NOT NULL,
  actor_name TEXT NOT NULL,
  actor_email TEXT NOT NULL,
  action TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id TEXT NOT NULL,
  target_label TEXT NOT NULL,
  detail TEXT
);

CREATE INDEX IF NOT EXISTS admin_audit_log_created_at_idx ON admin_audit_log (created_at DESC);
