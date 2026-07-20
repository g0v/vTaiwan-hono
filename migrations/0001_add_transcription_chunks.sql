CREATE TABLE IF NOT EXISTS transcription_chunks (
  meeting_id TEXT NOT NULL,
  chunk_index INTEGER NOT NULL,
  content TEXT NOT NULL,
  PRIMARY KEY (meeting_id, chunk_index)
);
