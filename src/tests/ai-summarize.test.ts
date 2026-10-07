import { afterEach, describe, expect, it, vi } from 'vite-plus/test'
import { generateOutline } from '../lib/ai-summarize'
import type { AppBindings } from '../server/api/types'

// 以原 worker（ai_summarize.ts，01c2efe）的實際請求與回傳行為為基準；
// 測試不依賴 sibling repo 或遠端 AI，讓 CI 也能把關搬移契約。
function aiResponse(text: string) {
  return {
    output: [
      { type: 'reasoning', summary: [] },
      { type: 'message', content: [{ type: 'output_text', text }] },
    ],
  }
}

function mockEnv(run = vi.fn(async (_model: string, _input: Record<string, unknown>): Promise<unknown> => aiResponse('## 討論重點\n- 開放資料授權'))) {
  return { run, env: { AI: { run } } as unknown as AppBindings }
}

afterEach(() => vi.restoreAllMocks())

describe('AI 大綱與原 worker 對齊', () => {
  it('短逐字稿使用相同的 120b 模型、正體中文 prompt 與完整原文，保留 Markdown 回應', async () => {
    const { run, env } = mockEnv()
    const transcription = '主持人：討論 A & B <資料集>。\n與會者：保留授權條款！'

    expect(await generateOutline(transcription, env)).toBe('## 討論重點\n- 開放資料授權')
    expect(run.mock.calls).toEqual([['@cf/openai/gpt-oss-120b', { instructions: '請用正體中文把以下內容整理出來，重點整理。：', input: transcription }]])
  })

  it('15000 字仍以單段處理', async () => {
    const { run, env } = mockEnv()
    const transcription = '字'.repeat(15000)

    await generateOutline(transcription, env)

    expect(run.mock.calls).toEqual([['@cf/openai/gpt-oss-120b', { instructions: '請用正體中文把以下內容整理出來，重點整理。：', input: transcription }]])
  })

  it('長逐字稿按段落分割，並行生成後仍按原順序合併', async () => {
    const first = '甲'.repeat(8000)
    const second = '乙'.repeat(8000)
    let finishFirst!: (value: unknown) => void
    const run = vi.fn((_model: string, input: Record<string, unknown>): Promise<unknown> => {
      if (input['input'] === first)
        return new Promise(resolve => {
          finishFirst = resolve
        })
      return Promise.resolve(aiResponse('乙段重點'))
    })
    const { env } = mockEnv(run)

    const pending = generateOutline(`${first}\n${second}`, env)
    expect(run.mock.calls).toEqual([
      ['@cf/openai/gpt-oss-120b', { instructions: '請為以下第1/2段內容生成重點摘要：', input: first }],
      ['@cf/openai/gpt-oss-120b', { instructions: '請為以下第2/2段內容生成重點摘要：', input: second }],
    ])
    finishFirst(aiResponse('甲段重點'))
    expect(await pending).toBe('## 第1部分\n甲段重點\n\n## 第2部分\n乙段重點')
  })

  it('過長段落依原 worker 的中文句子規則分割', async () => {
    const { run, env } = mockEnv()
    await generateOutline(`${'甲'.repeat(8000)}！${'乙'.repeat(8000)}？`, env)

    expect(run.mock.calls.map(call => call[1]['input'])).toEqual([`${'甲'.repeat(8000)}。`, `${'乙'.repeat(8000)}。`])
    expect(run.mock.calls.map(call => call[1]['instructions'])).toEqual(['請為以下第1/2段內容生成重點摘要：', '請為以下第2/2段內容生成重點摘要：'])
  })

  it('10 段仍按 15000 字處理，不提早改用大段落', async () => {
    const { run, env } = mockEnv()
    const paragraphs = Array.from({ length: 10 }, (_, i) => `${i}`.repeat(15000))

    await generateOutline(paragraphs.join('\n'), env)

    expect(run.mock.calls.map(call => call[1]['input'])).toEqual(paragraphs)
    expect(run.mock.calls[9]).toEqual(['@cf/openai/gpt-oss-120b', { instructions: '請為以下第10/10段內容生成重點摘要：', input: paragraphs[9] }])
  })

  it('超過 10 段改用 30000 字分段，沿用原 worker 的前 8 段上限', async () => {
    const { run, env } = mockEnv()
    const paragraphs = Array.from({ length: 18 }, (_, i) => String.fromCharCode(65 + i).repeat(14000))
    const outline = await generateOutline(paragraphs.join('\n'), env)
    const expectedChunks = Array.from({ length: 8 }, (_, i) => `${paragraphs[i * 2]}\n${paragraphs[i * 2 + 1]}`)

    expect(run.mock.calls.map(call => call[1]['input'])).toEqual(expectedChunks)
    expect(run.mock.calls[7]).toEqual(['@cf/openai/gpt-oss-120b', { instructions: '請為以下第8/8段內容生成重點摘要：', input: expectedChunks[7] }])
    expect(outline).toContain('## 第8部分\n')
    expect(outline).not.toContain('## 第9部分\n')
  })

  it.each(['', ' \n\t', null, { output: [] }, { output: [{ content: [{ text: 123 }] }] }])('空白或無效回應不當作成功的大綱：%j', async response => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const { env } = mockEnv(vi.fn(async () => (typeof response === 'string' ? aiResponse(response) : response)))

    expect(await generateOutline('討論內容', env)).toBe('第1段：AI處理失敗，原始內容長度 4 字符')
  })

  it('部分 AI 呼叫失敗時保留其他段落及失敗段的位置', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const run = vi.fn(async (_model: string, input: Record<string, unknown>) => {
      if (input['instructions'] === '請為以下第2/2段內容生成重點摘要：') throw new Error('AI unavailable')
      return aiResponse('第一段重點')
    })
    const { env } = mockEnv(run)

    expect(await generateOutline(`${'甲'.repeat(8000)}\n${'乙'.repeat(8000)}`, env)).toBe('## 第1部分\n第一段重點\n\n## 第2部分\n第2段：AI處理失敗，原始內容長度 8000 字符')
  })
})
