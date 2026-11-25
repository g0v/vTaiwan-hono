/**
 * MeetingRoom DO 的轉錄中名單協定（#153 步驟 2）
 *
 * 直接建構 DO、搭配 helpers/fake-ws.ts 的假 WebSocket／ctx／D1，呼叫真正的
 * webSocketMessage／webSocketClose／webSocketError／initMessage，斷言**其他連線收到的名單內容**，
 * 而不是只驗 mock 被呼叫。
 *
 * 純函式 capturersFromMetas 算得再對，也抓不到這裡釘住的三件事：
 *   - DO 在什麼時機、拿哪些名牌重算（CLOSING 連線要排除、斷線要移除）
 *   - 舊協定 sync_recording 是否也更新「送出者自己」的名牌（相容橋）
 *   - 未登入連線送 capture_status 是否被門口擋下
 */

import { describe, expect, it } from 'vite-plus/test'
import { MeetingRoom } from '../durable-objects/meeting-room'
import { FakeD1, FakeWebSocket, WS_CLOSING, fakeCtx } from './helpers/fake-ws'

const DATE = '20261125'

function room(sockets: FakeWebSocket[], db = new FakeD1()) {
  // shim 的 DurableObject 建構子只是存下 ctx / env
  return new MeetingRoom(fakeCtx(sockets), { DB: db.asD1() })
}

const user = (userId: string, name: string) => new FakeWebSocket({ isAuthenticated: true, userId, name, capturing: false, date: DATE })
const guest = () => new FakeWebSocket({ isAuthenticated: false, userId: null, name: null, capturing: false, date: DATE })

const captureStatus = (capturing: unknown) => JSON.stringify({ type: 'capture_status', capturing })
const syncRecording = (speaker: string | null) => JSON.stringify({ type: 'sync_recording', recording_speaker: speaker, recording_start_time: speaker ? 1_700_000_000_000 : null })

async function send(meeting: MeetingRoom, ws: FakeWebSocket, payload: string) {
  await meeting.webSocketMessage(ws.asWebSocket(), payload)
}

describe('MeetingRoom capture_status：基本動作', () => {
  it('小明開始錄：所有連線（含旁觀訪客與小明自己）收到含小明的 capture_list', async () => {
    const ming = user('uid-ming', '小明')
    const hua = user('uid-hua', '阿華')
    const watcher = guest()
    const meeting = room([ming, hua, watcher])

    await send(meeting, ming, captureStatus(true))

    for (const ws of [ming, hua, watcher]) {
      expect(ws.lastCaptureList).toEqual([{ userId: 'uid-ming', name: '小明' }])
    }
  })

  it('小明停止：名單變空並廣播', async () => {
    const ming = user('uid-ming', '小明')
    const hua = user('uid-hua', '阿華')
    const meeting = room([ming, hua])

    await send(meeting, ming, captureStatus(true))
    await send(meeting, ming, captureStatus(false))

    expect(hua.lastCaptureList).toEqual([])
  })

  it('狀態沒變就不重複廣播（每 30 秒換段重送 true 不會讓名單抖動）', async () => {
    const ming = user('uid-ming', '小明')
    const hua = user('uid-hua', '阿華')
    const meeting = room([ming, hua])

    await send(meeting, ming, captureStatus(true))
    await send(meeting, ming, captureStatus(true))
    await send(meeting, ming, captureStatus(true))

    expect(hua.captureListCount).toBe(1)
  })

  it('capture_status 只接受布林：字串／數字一律忽略，名單不變', async () => {
    const ming = user('uid-ming', '小明')
    const hua = user('uid-hua', '阿華')
    const meeting = room([ming, hua])

    await send(meeting, ming, captureStatus('true'))
    await send(meeting, ming, captureStatus(1))

    expect(hua.captureListCount).toBe(0)
    expect(ming.deserializeAttachment()).toMatchObject({ capturing: false })
  })
})

describe('MeetingRoom capture_status：名牌要真的存回 attachment', () => {
  it('送 true 後重新 deserializeAttachment 仍是 capturing: true（替身回傳副本，漏掉 serializeAttachment 會紅）', async () => {
    const ming = user('uid-ming', '小明')
    const meeting = room([ming])

    await send(meeting, ming, captureStatus(true))

    expect(ming.deserializeAttachment()).toMatchObject({ userId: 'uid-ming', name: '小明', capturing: true })
  })

  it('替身本身：改 deserializeAttachment 回傳的物件不會影響存著的名牌', () => {
    const ming = user('uid-ming', '小明')
    const copy = ming.deserializeAttachment() as { capturing: boolean }
    copy.capturing = true
    expect(ming.deserializeAttachment()).toMatchObject({ capturing: false })
  })

  it('舊連線的 attachment 沒有 name／capturing 欄位：視為沒在錄，不會噴錯', async () => {
    const legacy = new FakeWebSocket({ isAuthenticated: true, userId: 'uid-old', date: DATE })
    const hua = user('uid-hua', '阿華')
    const meeting = room([legacy, hua])

    await send(meeting, hua, captureStatus(true))

    expect(hua.lastCaptureList).toEqual([{ userId: 'uid-hua', name: '阿華' }])
  })
})

describe('MeetingRoom 斷線：離開的人要移出名單，之後的重算也不能再納入', () => {
  it('小明關分頁：阿華收到不含小明的名單', async () => {
    const ming = user('uid-ming', '小明')
    const hua = user('uid-hua', '阿華')
    const meeting = room([ming, hua])

    await send(meeting, ming, captureStatus(true))
    await meeting.webSocketClose(ming.asWebSocket(), 1000, 'bye')

    expect(hua.lastCaptureList).toEqual([])
    expect(ming.deserializeAttachment()).toMatchObject({ capturing: false })
  })

  it('CLOSING 連線仍在 getWebSockets() 裡：小美之後觸發重算，小明不會詐屍', async () => {
    const ming = user('uid-ming', '小明')
    const hua = user('uid-hua', '阿華')
    const mei = user('uid-mei', '小美')
    const sockets = [ming, hua, mei]
    const meeting = room(sockets)

    await send(meeting, ming, captureStatus(true))
    await meeting.webSocketClose(ming.asWebSocket(), 1000, 'bye')
    // 模擬 Cloudflare：close() 後連線還沒被移除
    expect(ming.readyState).toBe(WS_CLOSING)
    expect(sockets).toContain(ming)

    await send(meeting, mei, captureStatus(true))

    expect(hua.lastCaptureList).toEqual([{ userId: 'uid-mei', name: '小美' }])
  })

  it('連線出錯（webSocketError）比照斷線移出名單', async () => {
    const ming = user('uid-ming', '小明')
    const hua = user('uid-hua', '阿華')
    const meeting = room([ming, hua])

    await send(meeting, ming, captureStatus(true))
    await meeting.webSocketError(ming.asWebSocket(), new Error('boom'))

    expect(hua.lastCaptureList).toEqual([])
  })

  it('沒在錄的人斷線：不廣播（名單沒變）', async () => {
    const ming = user('uid-ming', '小明')
    const hua = user('uid-hua', '阿華')
    const meeting = room([ming, hua])

    await meeting.webSocketClose(ming.asWebSocket(), 1000, 'bye')

    expect(hua.captureListCount).toBe(0)
  })
})

describe('MeetingRoom 去重：同一帳號多個分頁', () => {
  it('小明兩個分頁都在錄：名單只有一個小明', async () => {
    const tab1 = user('uid-ming', '小明')
    const tab2 = user('uid-ming', '小明')
    const hua = user('uid-hua', '阿華')
    const meeting = room([tab1, tab2, hua])

    await send(meeting, tab1, captureStatus(true))
    await send(meeting, tab2, captureStatus(true))

    expect(hua.lastCaptureList).toEqual([{ userId: 'uid-ming', name: '小明' }])
  })

  it('關掉其中一個分頁：小明仍在名單；最後一個停止才移除', async () => {
    const tab1 = user('uid-ming', '小明')
    const tab2 = user('uid-ming', '小明')
    const hua = user('uid-hua', '阿華')
    const meeting = room([tab1, tab2, hua])

    await send(meeting, tab1, captureStatus(true))
    await send(meeting, tab2, captureStatus(true))
    await meeting.webSocketClose(tab1.asWebSocket(), 1000, 'bye')
    expect(hua.lastCaptureList).toEqual([{ userId: 'uid-ming', name: '小明' }])

    await send(meeting, tab2, captureStatus(false))
    expect(hua.lastCaptureList).toEqual([])
  })

  it('一個分頁停止、另一個仍在錄：小明仍在名單', async () => {
    const tab1 = user('uid-ming', '小明')
    const tab2 = user('uid-ming', '小明')
    const hua = user('uid-hua', '阿華')
    const meeting = room([tab1, tab2, hua])

    await send(meeting, tab1, captureStatus(true))
    await send(meeting, tab2, captureStatus(true))
    await send(meeting, tab1, captureStatus(false))

    expect(hua.lastCaptureList).toEqual([{ userId: 'uid-ming', name: '小明' }])
  })
})

describe('MeetingRoom 授權：未登入連線改不了名牌', () => {
  it('訪客送 capture_status：收到 error，名單沒變、沒有廣播', async () => {
    const watcher = guest()
    const hua = user('uid-hua', '阿華')
    const meeting = room([watcher, hua])

    await send(meeting, watcher, captureStatus(true))

    expect(watcher.errors).toEqual(['需要登入才能寫入'])
    expect(hua.captureListCount).toBe(0)
    expect(watcher.deserializeAttachment()).toMatchObject({ capturing: false })
  })

  it('訊息內塞別人的身分沒有用：名單身分一律取自 attachment', async () => {
    const ming = user('uid-ming', '小明')
    const hua = user('uid-hua', '阿華')
    const meeting = room([ming, hua])

    await send(meeting, ming, JSON.stringify({ type: 'capture_status', capturing: true, userId: 'uid-admin', name: 'bestian' }))

    expect(hua.lastCaptureList).toEqual([{ userId: 'uid-ming', name: '小明' }])
  })
})

describe('MeetingRoom 相容橋：舊版頁面只會送 sync_recording', () => {
  it('舊訊息帶 recording_speaker：送出者自己進名單；帶 null：移除', async () => {
    const hua = user('uid-hua', '阿華')
    const ming = user('uid-ming', '小明')
    const db = new FakeD1()
    const meeting = room([hua, ming], db)

    await send(meeting, hua, syncRecording('阿華'))
    expect(ming.lastCaptureList).toEqual([{ userId: 'uid-hua', name: '阿華' }])
    // 舊協定的 D1 寫入與 recording_synced 廣播照舊
    expect(db.sessions.get(DATE)).toMatchObject({ recording_speaker: '阿華' })
    expect(ming.sent.some(m => m.type === 'recording_synced')).toBe(true)

    await send(meeting, hua, syncRecording(null))
    expect(ming.lastCaptureList).toEqual([])
  })

  it('舊版每 30 秒重送 sync_recording：名單不重複廣播', async () => {
    const hua = user('uid-hua', '阿華')
    const ming = user('uid-ming', '小明')
    const meeting = room([hua, ming])

    await send(meeting, hua, syncRecording('阿華'))
    await send(meeting, hua, syncRecording('阿華'))
    await send(meeting, hua, syncRecording('阿華'))

    expect(ming.captureListCount).toBe(1)
  })

  it('新舊訊息交錯：誰都不會把對方踢出名單', async () => {
    const ming = user('uid-ming', '小明') // 新版
    const hua = user('uid-hua', '阿華') // 舊版
    const mei = user('uid-mei', '小美')
    const meeting = room([ming, hua, mei])

    await send(meeting, ming, captureStatus(true))
    await send(meeting, hua, syncRecording('阿華'))
    await send(meeting, hua, syncRecording('阿華')) // 舊版換段重送
    await send(meeting, ming, captureStatus(true)) // 新版重送（實作上不會，但送了也要安全）

    expect(mei.lastCaptureList).toEqual([
      { userId: 'uid-ming', name: '小明' },
      { userId: 'uid-hua', name: '阿華' },
    ])

    // 舊版停止只移除自己
    await send(meeting, hua, syncRecording(null))
    expect(mei.lastCaptureList).toEqual([{ userId: 'uid-ming', name: '小明' }])
  })

  it('舊訊息的 recording_speaker 不會反推成別人的名單：名字一律取自送出者的名牌', async () => {
    const hua = user('uid-hua', '阿華')
    const ming = user('uid-ming', '小明')
    const meeting = room([hua, ming])

    await send(meeting, hua, syncRecording('冒充的名字'))

    expect(ming.lastCaptureList).toEqual([{ userId: 'uid-hua', name: '阿華' }])
  })
})

describe('MeetingRoom init：中途加入者一進來就拿到現有名單', () => {
  it('小明在錄，小美才進來：init 的 capturers 含小明，與現場廣播一致', async () => {
    const ming = user('uid-ming', '小明')
    const hua = user('uid-hua', '阿華')
    const sockets = [ming, hua]
    const meeting = room(sockets)

    await send(meeting, ming, captureStatus(true))
    await send(meeting, hua, syncRecording('阿華'))

    const init = await meeting.initMessage(DATE)
    expect(init.type).toBe('init')
    if (init.type !== 'init') return
    expect(init.capturers).toEqual(hua.lastCaptureList)
    expect(init.capturers).toEqual([
      { userId: 'uid-ming', name: '小明' },
      { userId: 'uid-hua', name: '阿華' },
    ])
  })

  it('沒人在錄：init 的 capturers 為空陣列（不是 undefined）', async () => {
    const meeting = room([user('uid-ming', '小明')])
    const init = await meeting.initMessage(DATE)
    expect(init).toMatchObject({ type: 'init', capturers: [] })
  })

  it('init 不納入 CLOSING 連線', async () => {
    const ming = user('uid-ming', '小明')
    const meeting = room([ming])

    await send(meeting, ming, captureStatus(true))
    ming.readyState = WS_CLOSING // 直接模擬「名牌還是 true、連線卻已在關閉」的極端情況

    const init = await meeting.initMessage(DATE)
    expect(init).toMatchObject({ capturers: [] })
  })
})
