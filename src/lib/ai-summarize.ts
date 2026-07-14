import type { AppBindings } from "../api/types";
import { extractGptOssText } from "./transcribe";

// gpt-oss-120b 使用 Responses API 格式，型別尚未登錄；回應由 extractGptOssText() 做 runtime 驗證
type AiRunner = { run(model: string, input: Record<string, unknown>): Promise<unknown> };

// 智能分段函數：優先按段落分割，如果段落太大則按句子分割
function splitTextIntoChunks(text: string, maxCharsPerChunk: number = 15000): string[] {
  const chunks: string[] = [];
  const paragraphs = text.split(/\n/).filter((p) => p.trim().length > 0);
  let currentChunk = "";

  for (const paragraph of paragraphs) {
    if (paragraph.length > maxCharsPerChunk) {
      if (currentChunk.trim()) {
        chunks.push(currentChunk.trim());
        currentChunk = "";
      }
      const sentences = paragraph.split(/[。！？]/).filter((s) => s.trim().length > 0);
      for (const sentence of sentences) {
        const sentenceWithPunctuation = sentence + "。";
        if (currentChunk.length + sentenceWithPunctuation.length > maxCharsPerChunk) {
          if (currentChunk.trim()) chunks.push(currentChunk.trim());
          currentChunk = sentenceWithPunctuation;
        } else {
          currentChunk += sentenceWithPunctuation;
        }
      }
    } else {
      if (currentChunk.length + paragraph.length + 1 > maxCharsPerChunk) {
        if (currentChunk.trim()) chunks.push(currentChunk.trim());
        currentChunk = paragraph;
      } else {
        currentChunk = currentChunk ? currentChunk + "\n" + paragraph : paragraph;
      }
    }
  }

  if (currentChunk.trim()) chunks.push(currentChunk.trim());
  return chunks;
}

async function generateChunkSummary(
  chunk: string,
  env: AppBindings,
  chunkIndex: number,
  totalChunks: number,
): Promise<string> {
  const prompt =
    totalChunks > 1
      ? `請為以下第${chunkIndex + 1}/${totalChunks}段內容生成重點摘要：`
      : `請用正體中文把以下內容整理出來，重點整理。：`;

  try {
    // gpt-oss-120b 使用 Responses API 格式（{ instructions, input }），Ai 型別尚未登錄，以 as unknown 橋接
    const runner = env.AI! as unknown as AiRunner;
    const response = await runner.run("@cf/openai/gpt-oss-120b", {
      instructions: prompt,
      input: chunk,
    });
    return extractGptOssText(response);
  } catch (error) {
    console.error(`Chunk ${chunkIndex + 1} AI處理失敗:`, error);
    return `第${chunkIndex + 1}段：AI處理失敗，原始內容長度 ${chunk.length} 字符`;
  }
}

function mergeSummaries(summaries: string[]): string {
  if (summaries.length === 1) return summaries[0];
  return summaries
    .filter((s) => s.replace(/\s/g, "").length > 0)
    .map((s, i) => `## 第${i + 1}部分\n${s}`)
    .join("\n\n");
}

async function processChunks(chunks: string[], env: AppBindings): Promise<string> {
  if (chunks.length === 1) {
    return await generateChunkSummary(chunks[0], env, 0, 1);
  }

  const summaryPromises = chunks.map((chunk, i) =>
    generateChunkSummary(chunk, env, i, chunks.length),
  );

  try {
    const summaries = await Promise.all(summaryPromises);
    return mergeSummaries(summaries);
  } catch (error) {
    console.error("並行處理失敗:", error);
    return await processChunksSequentially(chunks, env);
  }
}

async function processChunksSequentially(chunks: string[], env: AppBindings): Promise<string> {
  const summaries: string[] = [];
  for (let i = 0; i < Math.min(chunks.length, 5); i++) {
    const summary = await generateChunkSummary(chunks[i], env, i, chunks.length);
    summaries.push(summary);
  }
  if (chunks.length > 5) {
    summaries.push(`註：由於時間限制，僅處理前5段內容（共${chunks.length}段）`);
  }
  return summaries.map((s, i) => `## 第${i + 1}部分\n${s}`).join("\n\n");
}

export async function generateOutline(transcription: string, env: AppBindings): Promise<string> {
  if (transcription.length <= 15000) {
    return await generateChunkSummary(transcription, env, 0, 1);
  }

  const chunks = splitTextIntoChunks(transcription, 15000);
  if (chunks.length === 0) return "無法處理空內容";

  if (chunks.length > 10) {
    const largerChunks = splitTextIntoChunks(transcription, 30000);
    const selected = largerChunks.length <= 8 ? largerChunks : largerChunks.slice(0, 8);
    return await processChunks(selected, env);
  }

  return await processChunks(chunks, env);
}
