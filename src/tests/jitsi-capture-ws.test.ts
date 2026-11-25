/**
 * JitsiView 的轉錄中名單：WebSocket 這一側（#153 步驟 2）
 *
 * 用假的 global WebSocket 直接呼叫 JitsiView 的 connectMeetingWs／disconnectWs／handleWsMessage，釘住：
 *   - onopen 沖出佇列時丟掉過期的 capture_status，最後依當下狀態補送一次（過期的 false 不能蓋掉現在的 true）
 *   - 意外斷線：清空名單並標示「無法同步」，但不動本機錄音狀態
 *   - 主動斷線（切歷史日期／離頁）：onclose 不會跑，清空名單要在 disconnectWs 做
 *   - 名單只以 init／capture_list 為準；captureListText 的三種顯示
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import JitsiView from '../views/JitsiView.vue'

class FakeSocket {
  static instances: FakeSocket[] = []
  static OPEN = 1
  readyState = 0
  sent: Array<Record<string, unknown>> = []
  onopen: (() => void) | null = null
  onmessage: ((event: { data: string }) => void) | null = null
  onclose: (() => void) | null = null
  onerror: ((err: unknown) => void) | null = null
  closed = false
  constructor(public url: string) {
    FakeSocket.instances.push(this)
  }
  send(payload: string) {
    this.sent.push(JSON.parse(payload) as Record<string, unknown>)
  }
  close() {
    this.closed = true
    this.readyState = 3
  }
  /** 模擬伺服器端完成握手 */
  open() {
    this.readyState = 1
    this.onopen?.()
  }
  /** 模擬網路意外中斷 */
  drop() {
    this.readyState = 3
    this.onclose?.()
  }
  get captureMessages() {
    return this.sent.filter(m => m.type === 'capture_status')
  }
}

const methodNames = ['connectMeetingWs', 'disconnectWs', 'sendMeetingMessage', 'handleWsMessage', 'announceCapture'] as const
type MethodName = (typeof methodNames)[number]

function wsState() {
  return {
    ws: null as FakeSocket | null,
    wsPendingMessages: [] as Array<Record<string, unknown>>,
    today: '20261125',
    capturers: [] as Array<{ userId: string; name: string }>,
    captureSyncLost: false,
    captureAnnounced: false,
    audioRecordingActive: false,
    meetingData: { recorder: '', recordingSpeaker: null as string | null, recordingStartTime: null as number | null },
    transcriptData: {},
    isRecorder: false,
    authUserData: { uid: 'uid-me', name: '我' },
    t: vi.fn((key: string, params?: Record<string, unknown>) => (params ? `${key}:${JSON.stringify(params)}` : key)),
  }
}
type WsContext = ReturnType<typeof wsState> & Record<MethodName, (...args: unknown[]) => unknown>
const methods = JitsiView.methods as unknown as Record<MethodName, (this: WsContext, ...args: unknown[]) => unknown>
const computed = JitsiView.computed as unknown as { captureListText: (this: WsContext) => string }

function context(): WsContext {
  const state = wsState() as WsContext
  for (const name of methodNames) state[name] = methods[name].bind(state)
  return state
}

beforeEach(() => {
  FakeSocket.instances = []
  vi.stubGlobal('WebSocket', FakeSocket)
  vi.stubGlobal('location', { protocol: 'https:', host: 'www.vtaiwan.tw' })
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('onopen：佇列沖出順序', () => {
  it('過期的 capture_status 全部丟掉，其他訊息照送，最後依當下狀態補送一次 true', () => {
    const state = context()
    state.captureAnnounced = true
    state.wsPendingMessages = [
      { type: 'capture_status', capturing: true },
      { type: 'save_entry', entry: { timestamp: 1, text: 'hi' } },
      { type: 'capture_status', capturing: false }, // 若照順序沖出，這筆會把下面補送的 true 蓋掉
    ]
    state.connectMeetingWs()
    const socket = FakeSocket.instances[0]
    socket.open()

    expect(socket.sent).toEqual([
      { type: 'save_entry', entry: { timestamp: 1, text: 'hi' } },
      { type: 'capture_status', capturing: true },
    ])
    expect(state.wsPendingMessages).toEqual([])
  })

  it('本機沒在錄：丟掉過期的 capture_status 後不補送任何狀態', () => {
    const state = context()
    state.captureAnnounced = false
    state.wsPendingMessages = [{ type: 'capture_status', capturing: true }]
    state.connectMeetingWs()
    FakeSocket.instances[0].open()

    expect(FakeSocket.instances[0].captureMessages).toEqual([])
  })

  it('連線中 announceCapture 會先排隊，open 後以最新狀態送出一次', () => {
    const state = context()
    state.connectMeetingWs()
    state.announceCapture(true)
    state.announceCapture(false)
    state.announceCapture(true)
    expect(state.wsPendingMessages).toHaveLength(3)

    FakeSocket.instances[0].open()
    expect(FakeSocket.instances[0].captureMessages).toEqual([{ type: 'capture_status', capturing: true }])
  })

  it('連線開著時 announceCapture 直接送，狀態沒變不重送', () => {
    const state = context()
    state.connectMeetingWs()
    const socket = FakeSocket.instances[0]
    socket.open()
    state.announceCapture(true)
    state.announceCapture(true)
    state.announceCapture(false)
    expect(socket.captureMessages).toEqual([
      { type: 'capture_status', capturing: true },
      { type: 'capture_status', capturing: false },
    ])
  })
})

describe('斷線時的名單顯示', () => {
  it('意外斷線：清空名單、標示無法同步，本機錄音狀態不動', () => {
    const state = context()
    state.connectMeetingWs()
    const socket = FakeSocket.instances[0]
    socket.open()
    state.handleWsMessage({ type: 'capture_list', capturers: [{ userId: 'uid-hua', name: '阿華' }] })
    state.audioRecordingActive = true
    state.captureAnnounced = true

    socket.drop()

    expect(state.ws).toBeNull()
    expect(state.capturers).toEqual([])
    expect(state.captureSyncLost).toBe(true)
    expect(state.audioRecordingActive).toBe(true)
    expect(state.captureAnnounced).toBe(true)
  })

  it('重新連上：無法同步的標示解除，等 init 填回名單', () => {
    const state = context()
    state.connectMeetingWs()
    FakeSocket.instances[0].open()
    FakeSocket.instances[0].drop()
    expect(state.captureSyncLost).toBe(true)

    state.connectMeetingWs()
    FakeSocket.instances[1].open()
    expect(state.captureSyncLost).toBe(false)
    state.handleWsMessage({ type: 'init', meeting: {}, transcripts: {}, capturers: [{ userId: 'uid-hua', name: '阿華' }] })
    expect(state.capturers).toEqual([{ userId: 'uid-hua', name: '阿華' }])
  })

  it('主動斷線（disconnectWs）：onclose 被拔掉不會跑，名單仍被清空，且不標示無法同步', () => {
    const state = context()
    state.connectMeetingWs()
    const socket = FakeSocket.instances[0]
    socket.open()
    state.handleWsMessage({ type: 'capture_list', capturers: [{ userId: 'uid-hua', name: '阿華' }] })

    state.disconnectWs()

    expect(socket.closed).toBe(true)
    expect(socket.onclose).toBeNull()
    expect(state.capturers).toEqual([])
    expect(state.captureSyncLost).toBe(false)
  })

  it('舊的連線在被換掉之後才觸發 onclose：不會清掉新連線的名單', () => {
    const state = context()
    state.connectMeetingWs()
    const first = FakeSocket.instances[0]
    first.open()
    // 不經 disconnectWs 直接換新連線（極端時序）
    const staleClose = first.onclose
    state.connectMeetingWs()
    const second = FakeSocket.instances[1]
    second.open()
    state.handleWsMessage({ type: 'capture_list', capturers: [{ userId: 'uid-hua', name: '阿華' }] })

    staleClose?.()

    expect(state.ws).toBe(second)
    expect(state.capturers).toEqual([{ userId: 'uid-hua', name: '阿華' }])
    expect(state.captureSyncLost).toBe(false)
  })
})

describe('名單資料來源與顯示文字', () => {
  it('init 與 capture_list 都更新名單；recording_synced 不影響名單', () => {
    const state = context()
    state.handleWsMessage({ type: 'init', meeting: { recordingSpeaker: '阿華' }, transcripts: {}, capturers: [{ userId: 'uid-ming', name: '小明' }] })
    expect(state.capturers).toEqual([{ userId: 'uid-ming', name: '小明' }])

    state.handleWsMessage({ type: 'recording_synced', recording_speaker: '小美', recording_start_time: 1 })
    expect(state.capturers).toEqual([{ userId: 'uid-ming', name: '小明' }])

    state.handleWsMessage({ type: 'capture_list', capturers: [] })
    expect(state.capturers).toEqual([])
  })

  it('舊版 DO 的 init 沒有 capturers 欄位：視為空名單，不會噴錯', () => {
    const state = context()
    state.handleWsMessage({ type: 'init', meeting: {}, transcripts: {} })
    expect(state.capturers).toEqual([])
  })

  it('captureListText：沒人在錄回空字串；有人時以分隔符串起；名字缺失補「未知說話者」', () => {
    const state = context()
    expect(computed.captureListText.call(state)).toBe('')

    state.capturers = [
      { userId: 'a', name: '小明' },
      { userId: 'b', name: '' },
    ]
    expect(computed.captureListText.call(state)).toBe('jitsi.capturingList:{"names":"小明jitsi.capturingListSeparatorjitsi.unknownSpeaker"}')
  })

  it('captureListText：斷線時一律顯示無法同步，即使名單還有殘值', () => {
    const state = context()
    state.capturers = [{ userId: 'a', name: '小明' }]
    state.captureSyncLost = true
    expect(computed.captureListText.call(state)).toBe('jitsi.captureUnavailable')
  })
})
