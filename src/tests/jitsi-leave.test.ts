import { afterEach, describe, expect, it, vi } from 'vite-plus/test'
import JitsiView from '../views/JitsiView.vue'

type TestContext = {
  jitsiApi: {
    executeCommand: ReturnType<typeof vi.fn>
    removeEventListener: ReturnType<typeof vi.fn>
    dispose: ReturnType<typeof vi.fn>
  } | null
  hasJoined: boolean
  showLeaveConfirm: boolean
  leaveFallbackTimer: ReturnType<typeof setTimeout> | null
  $refs: { jitsiContainer: { innerHTML: string } }
  disarmBackGuard: ReturnType<typeof vi.fn>
  handleMeetingLeft: () => void
}

const methods = JitsiView.methods as unknown as {
  confirmLeaveMeeting: (this: TestContext) => void
  handleMeetingLeft: (this: TestContext) => void
}

function meetingContext(): TestContext {
  const context: TestContext = {
    jitsiApi: { executeCommand: vi.fn(), removeEventListener: vi.fn(), dispose: vi.fn() },
    hasJoined: true,
    showLeaveConfirm: true,
    leaveFallbackTimer: null,
    $refs: { jitsiContainer: { innerHTML: '<iframe></iframe>' } },
    disarmBackGuard: vi.fn(),
    handleMeetingLeft: () => methods.handleMeetingLeft.call(context),
  }
  return context
}

describe('Jitsi 離開會議確認', () => {
  afterEach(() => vi.useRealTimers())

  it('iframe 沒有回傳離會事件時，仍會移除會議並回到加入畫面', () => {
    vi.useFakeTimers()
    const context = meetingContext()
    const api = context.jitsiApi!

    methods.confirmLeaveMeeting.call(context)
    expect(api.executeCommand).toHaveBeenCalledWith('hangup')

    vi.advanceTimersByTime(1000)
    expect(api.dispose).toHaveBeenCalledOnce()
    expect(context.jitsiApi).toBeNull()
    expect(context.$refs.jitsiContainer.innerHTML).toBe('')
    expect(context.hasJoined).toBe(false)
    expect(context.disarmBackGuard).toHaveBeenCalledOnce()
  })

  it('Jitsi 有回傳離會事件時，取消備援清理', () => {
    vi.useFakeTimers()
    const context = meetingContext()
    const api = context.jitsiApi!

    methods.confirmLeaveMeeting.call(context)
    context.handleMeetingLeft()
    vi.advanceTimersByTime(1000)

    expect(api.dispose).toHaveBeenCalledOnce()
    expect(context.disarmBackGuard).toHaveBeenCalledOnce()
    expect(vi.getTimerCount()).toBe(0)
  })

  it('iframe 指令拋錯時，立即清理會議畫面', () => {
    const context = meetingContext()
    const api = context.jitsiApi!
    api.executeCommand.mockImplementation(() => {
      throw new Error('iframe unavailable')
    })
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})

    try {
      methods.confirmLeaveMeeting.call(context)

      expect(api.dispose).toHaveBeenCalledOnce()
      expect(context.hasJoined).toBe(false)
      expect(context.disarmBackGuard).toHaveBeenCalledOnce()
    } finally {
      log.mockRestore()
    }
  })
})
