-- 即時會議資料表（#81）
-- 用於取代 Firebase Realtime Database，搭配 MeetingRoom Durable Object 使用。
--
-- meeting_sessions：每場次（日期）的會議 metadata
--   date           'YYYYMMDD' 格式，主鍵
--   recorder_uid   目前擔任錄音員的 user id（Better Auth）
--   recording_speaker   正在錄音的說話者名稱
--   recording_start_time  錄音開始時間（Unix ms），null 表示目前沒有錄音
--
-- meeting_transcript_entries：逐字稿條目
--   meeting_date   對應 meeting_sessions.date
--   ts             條目的時間戳（Unix ms），來自 Date.now()，同一場次唯一
--   entry_id       Jitsi messageID 或音訊序號（nullable）
--   speaker        說話者名稱
--   text           逐字稿文字（不得為 null）
--
-- 資料寫入路徑：
--   今日即時 → MeetingRoom DO 接受 WebSocket 訊息後寫入
--   歷史日期 → /api/meeting/:date REST 端點直接讀寫
--
CREATE TABLE IF NOT EXISTS meeting_sessions (
  date TEXT PRIMARY KEY,
  recorder_uid TEXT,
  recording_speaker TEXT,
  recording_start_time INTEGER
);

CREATE TABLE IF NOT EXISTS meeting_transcript_entries (
  meeting_date TEXT NOT NULL,
  ts INTEGER NOT NULL,
  entry_id TEXT,
  speaker TEXT,
  text TEXT NOT NULL,
  PRIMARY KEY (meeting_date, ts)
);

CREATE INDEX IF NOT EXISTS meeting_transcript_entries_date_idx
  ON meeting_transcript_entries (meeting_date, ts ASC);
