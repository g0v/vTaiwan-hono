import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import { createAudioRecorder, recordingErrorKey, recordingFilename } from '../lib/audio-recording'
import JitsiView from '../views/JitsiView.vue'

class FakeRecorder {
  static isTypeSupported = vi.fn((type: string) => type === 'audio/mp4')
  static instances: FakeRecorder[] = []
  static startError: Error | null = null
  state = 'inactive'
  mimeType: string
  ondataavailable: ((event: { data: Blob }) => void) | null = null
  onstop: (() => void) | null = null
  onerror: ((event: { error: Error }) => void) | null = null
  constructor(
    public stream: MediaStream,
    options?: MediaRecorderOptions
  ) {
    this.mimeType = options?.mimeType || 'audio/mp4'
    FakeRecorder.instances.push(this)
  }
  start = vi.fn(() => {
    if (FakeRecorder.startError) throw FakeRecorder.startError
    this.state = 'recording'
  })
  stop = vi.fn(() => {
    this.state = 'inactive'
    // 模擬瀏覽器：stop() 回傳後才送出最後一段資料與 stop 事件。
    setTimeout(() => {
      this.ondataavailable?.({ data: new Blob(['最後一段音訊'], { type: this.mimeType }) })
      this.onstop?.()
    }, 0)
  })
}

const Recorder = FakeRecorder as unknown as typeof MediaRecorder
const methodNames = [
  'startAudioRecording',
  'stopAudioRecording',
  'stopAudioRecordingForNextRound',
  'startNextRecordingRound',
  'processRecordedAudio',
  'sendAudioToTranscription',
  'cleanupAudioRecording',
  'clearAudioRecordingTimers',
  'handleAudioRecordingError',
] as const
type MethodName = (typeof methodNames)[number]

function recordingState() {
  return {
    canUseMeetingFeatures: true,
    isRecordingAudio: false,
    isStartingAudio: false,
    audioRecordingActive: false,
    audioRecordingGeneration: 0,
    audioRecordingFinished: null as Promise<void> | null,
    resolveAudioRecording: null as (() => void) | null,
    audioMediaRecorder: null as MediaRecorder | null,
    audioStream: null as MediaStream | null,
    audioChunks: [] as Blob[],
    audioQueue: [] as { blob: Blob }[],
    audioRecordingTimer: null as ReturnType<typeof setTimeout> | null,
    countdownInterval: null as ReturnType<typeof setInterval> | null,
    recordingTimeLeft: 0,
    recordingTimer: 0,
    maxRecordingTime: 30_000,
    selectedAudioDeviceId: '',
    transcriptionLanguage: 'zh-TW',
    transcriptionApiUrl: '/api/transcription/',
    authUserData: { name: '測試者' },
    meetingData: { recordingStartTime: null, recordingSpeaker: null },
    t: vi.fn((key: string) => key),
    syncRecordingStatus: vi.fn(),
    stopAudioTest: vi.fn(),
    startQueueProcessing: vi.fn(),
    sendBrowserNotification: vi.fn(),
    addTranscriptData: vi.fn(),
  }
}
type RecordingContext = ReturnType<typeof recordingState> & Record<MethodName, (...args: unknown[]) => unknown>
const methods = JitsiView.methods as unknown as Record<MethodName, (this: RecordingContext, ...args: unknown[]) => unknown>

function context(): RecordingContext {
  const state = recordingState() as RecordingContext
  for (const name of methodNames) state[name] = methods[name].bind(state)
  return state
}

let track: { readyState: string; stop: ReturnType<typeof vi.fn> }
let stream: MediaStream
let getUserMedia: ReturnType<typeof vi.fn>

beforeEach(() => {
  vi.useFakeTimers()
  FakeRecorder.instances = []
  FakeRecorder.startError = null
  FakeRecorder.isTypeSupported = vi.fn((type: string) => type === 'audio/mp4')
  track = { readyState: 'live', stop: vi.fn() }
  stream = { getTracks: () => [track], getAudioTracks: () => [track] } as unknown as MediaStream
  getUserMedia = vi.fn().mockResolvedValue(stream)
  vi.stubGlobal('navigator', { mediaDevices: { getUserMedia } })
  vi.stubGlobal('MediaRecorder', FakeRecorder)
  vi.stubGlobal('alert', vi.fn())
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('跨瀏覽器錄音格式', () => {
  it('僅支援 MP4 的舊版 Safari 使用 MP4；支援 WebM 的瀏覽器優先使用 Opus', () => {
    expect(createAudioRecorder(stream, Recorder).mimeType).toBe('audio/mp4')
    FakeRecorder.isTypeSupported.mockImplementation(type => type === 'audio/webm;codecs=opus' || type === 'audio/mp4')
    expect(createAudioRecorder(stream, Recorder).mimeType).toBe('audio/webm;codecs=opus')
  })

  it('未回報候選格式或沒有能力偵測時，使用瀏覽器預設格式', () => {
    FakeRecorder.isTypeSupported.mockReturnValue(false)
    expect(createAudioRecorder(stream, Recorder).mimeType).toBe('audio/mp4')
    class DefaultRecorder extends FakeRecorder {}
    Object.defineProperty(DefaultRecorder, 'isTypeSupported', { value: undefined })
    expect(createAudioRecorder(stream, DefaultRecorder as unknown as typeof MediaRecorder).mimeType).toBe('audio/mp4')
  })

  it('能力回報支援但建構失敗時，繼續選擇可用格式', () => {
    class MisreportedRecorder extends FakeRecorder {
      static isTypeSupported = vi.fn((_type: string) => true)
      constructor(input: MediaStream, options?: MediaRecorderOptions) {
        if (options?.mimeType?.startsWith('audio/webm')) throw new DOMException('unsupported', 'NotSupportedError')
        super(input, options)
      }
    }
    expect(createAudioRecorder(stream, MisreportedRecorder as unknown as typeof MediaRecorder).mimeType).toBe('audio/mp4;codecs=mp4a.40.2')
  })

  it.each([
    ['audio/mp4;codecs=mp4a.40.2', 'recording.mp4'],
    ['audio/webm;codecs=opus', 'recording.webm'],
    ['audio/ogg;codecs=opus', 'recording.ogg'],
    ['', 'recording.audio'],
  ])('實際格式 %s 對應檔名 %s', (mimeType, filename) => {
    expect(recordingFilename(mimeType)).toBe(filename)
  })

  it.each([
    ['NotAllowedError', 'jitsi.micPermissionError'],
    ['SecurityError', 'jitsi.micPermissionError'],
    ['NotFoundError', 'jitsi.micDeviceError'],
    ['OverconstrainedError', 'jitsi.micDeviceError'],
    ['NotSupportedError', 'jitsi.micFormatError'],
    ['NotReadableError', 'jitsi.micError'],
  ])('%s 顯示對應錯誤，而非一律要求修改權限', (name, key) => {
    expect(recordingErrorKey(new DOMException('failed', name))).toBe(key)
  })
})

describe('Jitsi 錄音生命週期', () => {
  it('手動停止等最後一段音訊入隊才釋放音源，且不自動重啟', async () => {
    const state = context()
    await state.startAudioRecording()
    const stopped = state.stopAudioRecording()
    expect(state.audioQueue).toHaveLength(0)
    expect(track.stop).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(0)
    await stopped
    expect(state.audioQueue).toHaveLength(1)
    expect(await state.audioQueue[0].blob.text()).toBe('最後一段音訊')
    expect(state.audioQueue[0].blob.type).toBe('audio/mp4')
    expect(state.startQueueProcessing).toHaveBeenCalledOnce()
    expect(track.stop).toHaveBeenCalledOnce()
    expect(FakeRecorder.instances).toHaveLength(1)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('跨兩輪自動錄音重用同一音源，保留獨立音檔並可手動停止', async () => {
    const state = context()
    await state.startAudioRecording()
    await vi.advanceTimersByTimeAsync(60_010)
    expect(getUserMedia).toHaveBeenCalledOnce()
    expect(FakeRecorder.instances).toHaveLength(3)
    expect(state.audioQueue).toHaveLength(2)
    expect(track.stop).not.toHaveBeenCalled()
    const stopped = state.stopAudioRecording()
    await vi.advanceTimersByTimeAsync(0)
    await stopped
    expect(state.audioQueue).toHaveLength(3)
    expect(track.stop).toHaveBeenCalledOnce()
    expect(vi.getTimerCount()).toBe(0)
  })

  it('開始失敗釋放已取得的麥克風，清除狀態並顯示格式錯誤', async () => {
    FakeRecorder.startError = new DOMException('unsupported', 'NotSupportedError')
    const state = context()
    expect(await state.startAudioRecording()).toBe(false)
    expect(track.stop).toHaveBeenCalledOnce()
    expect(state.audioMediaRecorder).toBeNull()
    expect(state.audioRecordingActive).toBe(false)
    expect(state.isStartingAudio).toBe(false)
    expect(alert).toHaveBeenCalledWith('jitsi.micFormatError')
    expect(vi.getTimerCount()).toBe(0)
  })

  it('錄音中的非同步錯誤釋放資源並禁止再次啟動', async () => {
    const state = context()
    await state.startAudioRecording()
    FakeRecorder.instances[0].onerror?.({ error: new DOMException('busy', 'NotReadableError') })
    await vi.advanceTimersByTimeAsync(30_000)
    expect(track.stop).toHaveBeenCalledOnce()
    expect(state.audioQueue).toHaveLength(0)
    expect(FakeRecorder.instances).toHaveLength(1)
    expect(alert).toHaveBeenCalledWith('jitsi.micError')
  })

  it('權限拒絕與已失效的裝置顯示不同提示', async () => {
    const state = context()
    getUserMedia.mockRejectedValueOnce(new DOMException('denied', 'NotAllowedError'))
    await state.startAudioRecording()
    expect(alert).toHaveBeenLastCalledWith('jitsi.micPermissionError')
    getUserMedia.mockRejectedValueOnce(new DOMException('device', 'OverconstrainedError'))
    await state.startAudioRecording()
    expect(alert).toHaveBeenLastCalledWith('jitsi.micDeviceError')
  })

  it('離頁後才取得權限的音源立即釋放，不建立錄音器', async () => {
    let grant!: (value: MediaStream) => void
    getUserMedia.mockReturnValue(
      new Promise<MediaStream>(resolve => {
        grant = resolve
      })
    )
    const state = context()
    const pending = state.startAudioRecording()
    state.cleanupAudioRecording()
    grant(stream)
    await pending
    expect(track.stop).toHaveBeenCalledOnce()
    expect(FakeRecorder.instances).toHaveLength(0)
    expect(state.audioRecordingActive).toBe(false)
    expect(state.isStartingAudio).toBe(false)
  })

  it('離頁清理時丟棄遲到事件，不上傳或重啟錄音', async () => {
    const state = context()
    await state.startAudioRecording()
    await state.stopAudioRecordingForNextRound()
    state.cleanupAudioRecording()
    await vi.advanceTimersByTimeAsync(30_000)
    expect(state.audioQueue).toHaveLength(0)
    expect(FakeRecorder.instances).toHaveLength(1)
    expect(track.stop).toHaveBeenCalledOnce()
  })

  it('同時按兩次開始只申請一次麥克風', async () => {
    const state = context()
    await Promise.all([state.startAudioRecording(), state.startAudioRecording()])
    expect(getUserMedia).toHaveBeenCalledOnce()
    expect(FakeRecorder.instances).toHaveLength(1)
    state.cleanupAudioRecording()
  })

  it('MP4 上傳保持實際檔案型別與副檔名', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('測試逐字稿'))
    vi.stubGlobal('fetch', fetchMock)
    const state = context()
    await state.sendAudioToTranscription(new Blob(['mp4 audio'], { type: 'audio/mp4;codecs=mp4a.40.2' }))
    const [url, request] = fetchMock.mock.calls[0] as [string, { method: string; body: FormData }]
    expect(url).toBe('/api/transcription/zh-TW')
    expect(request.method).toBe('POST')
    const file = request.body.get('file') as File
    expect(file.name).toBe('recording.mp4')
    expect(file.type).toBe('audio/mp4;codecs=mp4a.40.2')
    expect(await file.text()).toBe('mp4 audio')
    expect(state.addTranscriptData).toHaveBeenCalledWith(expect.objectContaining({ text: '測試逐字稿' }))
  })
})
