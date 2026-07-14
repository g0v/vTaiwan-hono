import { corsFor } from "./cors";
import { readAudioToText } from "../lib/transcribe";
import { generateOutline } from "../lib/ai-summarize";
import type { App } from "./types";

const LANG_MAP: Record<string, string> = {
  "zh-TW": "zh",
  en: "en",
  ja: "ja",
};

export function registerTranscriptionApi(app: App) {
  // POST /api/transcription/:lang — 音頻檔轉文字（分軌本地錄音端點）
  app.use("/api/transcription/*", corsFor(["POST"]));
  app.post("/api/transcription/:lang", async (c) => {
    const rawLang = c.req.param("lang") || "zh-TW";
    const language = LANG_MAP[rawLang] ?? rawLang;

    let formData: FormData;
    try {
      formData = await c.req.formData();
    } catch {
      return c.text("No file uploaded", 400);
    }

    const file = formData.get("file");
    if (!(file instanceof File)) return c.text("No file uploaded", 400);

    try {
      const audioBuffer = await file.arrayBuffer();
      const text = await readAudioToText(audioBuffer, c.env, language);
      return c.text(text);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      if (message.includes("音檔音量過低")) {
        return c.json({ error: "音檔音量過低", message, code: "LOW_VOLUME" }, 422);
      }
      return c.json({ error: "轉錄失敗", message, code: "TRANSCRIPTION_ERROR" }, 400);
    }
  });

  // POST /api/upload-transcription — 上傳逐字稿 .txt 至 D1 + R2，並生成 AI 大綱
  app.use("/api/upload-transcription", corsFor(["POST"]));
  app.post("/api/upload-transcription", async (c) => {
    let formData: FormData;
    try {
      formData = await c.req.formData();
    } catch {
      return c.text("No file uploaded", 400);
    }

    const file = formData.get("file");
    if (!(file instanceof File)) return c.text("No file uploaded", 400);

    const filename = file.name;
    const meeting_id = filename.replace(".txt", "").replace("transcript-", "").split("-").join("");
    const transcription = await file.text();

    if (c.env.R2) {
      await c.env.R2.put(`${meeting_id}.txt`, file.stream(), {
        httpMetadata: { contentType: "text/plain; charset=utf-8" },
      });
    }

    const outline = await generateOutline(transcription, c.env);

    const db = c.env.DB;
    if (!db) return c.json({ error: "DB binding not configured" }, 500);

    const existing = await db
      .prepare("SELECT * FROM transcriptions WHERE meeting_id = ?")
      .bind(meeting_id)
      .first();

    if (!existing) {
      await db
        .prepare("INSERT INTO transcriptions (meeting_id, transcription, outline) VALUES (?, ?, ?)")
        .bind(meeting_id, transcription, outline)
        .run();
      return c.json({
        message: "Transcription created successfully",
        meeting_id,
        r2_key: `${meeting_id}.txt`,
      });
    } else {
      await db
        .prepare("UPDATE transcriptions SET transcription = ?, outline = ? WHERE meeting_id = ?")
        .bind(transcription, outline, meeting_id)
        .run();
      return c.json({
        message: "Transcription updated successfully",
        meeting_id,
        r2_key: `${meeting_id}.txt`,
      });
    }
  });

  // POST /api/update-outline — 手動更新大綱
  app.use("/api/update-outline", corsFor(["POST"]));
  app.post("/api/update-outline", async (c) => {
    const { meeting_id, outline } = await c.req.json<{ meeting_id: string; outline: string }>();
    const db = c.env.DB;
    if (!db) return c.json({ error: "DB binding not configured" }, 500);
    await db
      .prepare("UPDATE transcriptions SET outline = ? WHERE meeting_id = ?")
      .bind(outline, meeting_id)
      .run();
    return c.json({ message: "Outline updated successfully" });
  });

  // GET /api/query-table — 取得所有逐字稿列表
  app.use("/api/query-table", corsFor(["GET"]));
  app.get("/api/query-table", async (c) => {
    const db = c.env.DB;
    if (!db) return c.json({ error: "DB binding not configured" }, 500);
    const result = await db.prepare("SELECT * FROM transcriptions").all();
    return c.json(result.results);
  });

  // POST /api/create-table — 建立 D1 資料表（idempotent；本地 D1 bootstrap 用）
  app.use("/api/create-table", corsFor(["POST"]));
  app.post("/api/create-table", async (c) => {
    const db = c.env.DB;
    if (!db) return c.json({ error: "DB binding not configured" }, 500);
    await db
      .prepare(
        "CREATE TABLE IF NOT EXISTS transcriptions (meeting_id TEXT, transcription TEXT, outline TEXT)",
      )
      .run();
    return c.json({ message: "Table created successfully" });
  });

  // POST /api/test-ai — 測試 AI 摘要（前端未使用；為介面完整性保留）
  app.use("/api/test-ai", corsFor(["POST"]));
  app.post("/api/test-ai", async (c) => {
    let formData: FormData;
    try {
      formData = await c.req.formData();
    } catch {
      return c.text("No file uploaded", 400);
    }
    const file = formData.get("file");
    if (!(file instanceof File)) return c.text("No file uploaded", 400);
    const transcription = await file.text();
    const outline = await generateOutline(transcription, c.env);
    return c.text(outline);
  });

  // GET /api/transcriptions/:meeting_id/text — 讀取逐字稿純文字（取代公開 R2 網域）
  app.use("/api/transcriptions/*", corsFor(["GET"]));
  app.get("/api/transcriptions/:meeting_id/text", async (c) => {
    const meeting_id = c.req.param("meeting_id");
    const db = c.env.DB;
    if (!db) return c.json({ error: "DB binding not configured" }, 500);
    const row = await db
      .prepare("SELECT transcription FROM transcriptions WHERE meeting_id = ?")
      .bind(meeting_id)
      .first<{ transcription: string }>();
    if (!row) return c.text("", 404);
    return new Response(row.transcription, {
      status: 200,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  });
}
