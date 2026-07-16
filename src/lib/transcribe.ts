import { tify } from 'chinese-conv'
import type { AppBindings } from '../api/types'

// Workers AI 部分模型的型別定義與實際輸入/輸出格式不一致：
// - whisper-large-v3-turbo：實際接受 { audio: base64字串, language, task }，型別定義為 { audio: number[] }
// - gpt-oss-20b/120b：使用 Responses API 格式（{ instructions, input }），型別尚未登錄
// ⇒ 以 unknown 橋接 run()，回應由各自的 runtime 驗證函式提取
type AiRunner = { run(model: string, input: Record<string, unknown>): Promise<unknown> }
function aiRunner(ai: NonNullable<AppBindings['AI']>): AiRunner {
  return ai as unknown as AiRunner // 以名稱明確的轉接器吸收 Workers AI runtime 與型別定義的落差
}

export async function translateToZh(userText: string, source_lang: string, env: AppBindings): Promise<string> {
  const response = await aiRunner(env.AI!).run('@cf/meta/m2m100-1.2b', {
    text: userText,
    source_lang,
    target_lang: 'zh',
  })
  const translatedText = extractStringField(response, 'translated_text')

  const twResponse = await aiRunner(env.AI!).run('@cf/openai/gpt-oss-20b', {
    instructions: '請把以下內容修成台灣常用正體中文用語，避免中國大陸地區慣用語，只在必要時替換詞彙與語序，不要改變意思。',
    input: translatedText,
  })
  return extractGptOssText(twResponse)
}

export async function readAudioToText(audioBuffer: ArrayBuffer, env: AppBindings, language: string): Promise<string> {
  try {
    if (!env.AI) throw new Error('AI 模型未配置')

    // 分 8192 byte 批次 base64 編碼，避免 call stack 溢出
    const uint8Array = new Uint8Array(audioBuffer)
    let binaryString = ''
    const chunkSize = 8192
    for (let i = 0; i < uint8Array.length; i += chunkSize) {
      const chunk = uint8Array.slice(i, i + chunkSize)
      binaryString += String.fromCharCode(...(chunk as unknown as number[]))
    }
    const base64Audio = btoa(binaryString)

    const response = await aiRunner(env.AI).run('@cf/openai/whisper-large-v3-turbo', {
      audio: base64Audio,
      language,
      task: 'transcribe',
    })

    if (!response) throw new Error('AI 模型未返回任何結果')

    // Whisper 可能回傳純字串或 { text } 物件
    let result: string
    if (typeof response === 'string') {
      result = response
    } else if (response !== null && typeof response === 'object' && 'text' in response) {
      const r = response as Record<string, unknown>
      const text = r['text']
      if (typeof text !== 'string') throw new Error('AI 模型返回了未知格式的結果')
      result = text
    } else {
      throw new Error('AI 模型返回了未知格式的結果')
    }

    if (!result.trim()) throw new Error('AI 模型返回了空的結果')

    const trimmed = result.trim()
    const isHallucination =
      (trimmed.startsWith('字幕志願者') || trimmed.startsWith('字幕志愿者') || trimmed.includes('感謝觀看') || trimmed.includes('謝謝觀看') || trimmed.includes('打賞支持')) && trimmed.length < 40

    if (isHallucination) {
      throw new Error(`音檔音量過低，AI 產生幻覺回應: "${trimmed}"`)
    }

    if (language !== 'zh') {
      const translated = await translateToZh(result, language, env)
      return result + '\n\n(自動翻譯)\n' + tify(translated)
    }
    return tify(result)
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    throw new Error(`音頻轉文字失敗: ${message}`)
  }
}

// --- response 抽取ヘルパー（runtime 検証のみ、キャストで property アクセスしない） ---

/**
 * gpt-oss 系列モデルの Responses API 形式から text を抽出する。
 * 期待する形状: { output: [{ content: [{ text: string }] }] }
 */
export function extractGptOssText(response: unknown): string {
  if (response === null || typeof response !== 'object') {
    throw new Error('AI 回應非物件')
  }
  if (!('output' in response)) {
    throw new Error('AI 回應缺少 output 欄位')
  }
  const r = response as Record<string, unknown>
  const output = r['output']
  if (!Array.isArray(output) || output.length === 0) {
    throw new Error('AI output 為空陣列')
  }
  const last: unknown = output[output.length - 1]
  if (last === null || typeof last !== 'object' || !('content' in last)) {
    throw new Error('AI output 最後項目缺少 content')
  }
  const lastRecord = last as Record<string, unknown>
  const content = lastRecord['content']
  if (!Array.isArray(content) || content.length === 0) {
    throw new Error('AI content 為空')
  }
  const first: unknown = content[0]
  if (first === null || typeof first !== 'object' || !('text' in first)) {
    throw new Error('AI content[0] 缺少 text')
  }
  const firstRecord = first as Record<string, unknown>
  const textVal = firstRecord['text']
  if (typeof textVal !== 'string') {
    throw new Error('AI text 非字串')
  }
  return textVal
}

/**
 * response 物件から指定フィールドを string として取り出す。
 */
function extractStringField(response: unknown, field: string): string {
  if (response === null || typeof response !== 'object') {
    throw new Error(`AI 回應非物件（取 ${field}）`)
  }
  const r = response as Record<string, unknown>
  const val = r[field]
  if (typeof val !== 'string') {
    throw new Error(`AI 回應 ${field} 欄位非字串`)
  }
  return val
}
