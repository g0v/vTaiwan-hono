/**
 * MeetingRoom DO 的 save_entry 協定（#153 步驟 1）
 *
 * 透過 `src/shims/cloudflare-workers.ts` 直接建構 DO，用假的 WebSocket 與 D1 釘住：
 *   - 新增條目撞到 ts 時：所有人拿到順延後的條目；**只有送出者**拿到 `replaces`
 *   - 編輯條目：維持原 ts，所有人（含送出者）拿到不帶 `replaces` 的 entry_saved
 *   - speaker_uid 來自連線的認證身分，不是客戶端送的值
 *   - 未認證連線一律拒絕寫入
 *
 * 第一版實作把 `replaces` 廣播給所有人，會讓正當占用該 ts 的別人把自己的條目刪掉；
 * 這組測試就是為了不讓那個錯誤再回來。
 */

import { describe, expect, it } from 'vite-plus/test'
import { MeetingRoom, type ServerMessage } from '../durable-objects/meeting-room'
import { FakeD1 } from './helpers/fake-d1'

const DATE = '20261119'

class FakeWebSocket {
  sent: ServerMessage[] = []
  constructor(private meta: { isAuthenticated: boolean; userId: string | null; date: string }) {}
  deserializeAttachment() {
    return this.meta
  }
  send(payload: string) {
    this.sent.push(JSON.parse(payload) as ServerMessage)
  }
  /** 只回傳 entry_saved 訊息，方便斷言 */
  get saved() {
    return this.sent.filter(m => m.type === 'entry_saved') as Extract<ServerMessage, { type: 'entry_saved' }>[]
  }
}

function room(sockets: FakeWebSocket[], db: FakeD1) {
  const ctx = { getWebSockets: () => sockets }
  // shim 的 DurableObject 建構子只是存下 ctx / env；fetch／handleWebSocketUpgrade 不會在此測試被呼叫
  return new MeetingRoom(ctx as unknown as DurableObjectState, { DB: db.asD1() })
}

const user = (userId: string) => new FakeWebSocket({ isAuthenticated: true, userId, date: DATE })
const guest = () => new FakeWebSocket({ isAuthenticated: false, userId: null, date: DATE })

describe('MeetingRoom save_entry：新增', () => {
  it('兩人同一毫秒新增：後到者順延；replaces 只回給送出者，旁觀者與先到者都不會收到', async () => {
    const db = new FakeD1()
    const alice = user('uid-alice')
    const bob = user('uid-bob')
    const watcher = guest()
    const meeting = room([alice, bob, watcher], db)

    await meeting.webSocketMessage(
      alice as unknown as WebSocket,
      JSON.stringify({ type: 'save_entry', create: true, entry: { id: 'audio_1000', timestamp: 1000, speaker: 'Alice', text: '甲', source: 'manual' } })
    )
    await meeting.webSocketMessage(
      bob as unknown as WebSocket,
      JSON.stringify({ type: 'save_entry', create: true, entry: { id: 'audio_1000', timestamp: 1000, speaker: 'Bob', text: '乙', source: 'manual' } })
    )

    // D1：兩筆都在，Bob 被順延到 1001
    expect(db.rows.get(`${DATE}:1000`)).toMatchObject({ speaker: 'Alice', speaker_uid: 'uid-alice', source: 'manual' })
    expect(db.rows.get(`${DATE}:1001`)).toMatchObject({ speaker: 'Bob', speaker_uid: 'uid-bob', source: 'manual' })

    // Bob（送出者）：第二則 entry_saved 帶 replaces: 1000，讓他把樂觀放在 1000 的自己換掉
    expect(bob.saved.at(-1)).toEqual({ type: 'entry_saved', entry: expect.objectContaining({ timestamp: 1001, speaker: 'Bob' }), replaces: 1000 })

    // Alice 與旁觀者：拿到 Bob 的條目，但**沒有** replaces——否則 Alice 會把自己正當占用的 1000 刪掉
    for (const other of [alice, watcher]) {
      const bobEntry = other.saved.find(m => m.entry.speaker === 'Bob')
      expect(bobEntry).toBeDefined()
      expect(bobEntry?.entry.timestamp).toBe(1001)
      expect(bobEntry).not.toHaveProperty('replaces')
    }
  })

  it('沒撞到 ts：送出者仍收到 replaces（等於自己的 ts），其他人不收到', async () => {
    const db = new FakeD1()
    const alice = user('uid-alice')
    const watcher = guest()
    const meeting = room([alice, watcher], db)

    await meeting.webSocketMessage(alice as unknown as WebSocket, JSON.stringify({ type: 'save_entry', create: true, entry: { id: null, timestamp: 2000, speaker: 'Alice', text: '丙' } }))

    expect(alice.saved).toEqual([{ type: 'entry_saved', entry: expect.objectContaining({ timestamp: 2000 }), replaces: 2000 }])
    expect(watcher.saved).toEqual([{ type: 'entry_saved', entry: expect.objectContaining({ timestamp: 2000 }) }])
    expect(watcher.saved[0]).not.toHaveProperty('replaces')
  })

  it('speaker_uid 取連線身分、source 只收合法值；客戶端自稱的 speakerUid 被忽略', async () => {
    const db = new FakeD1()
    const alice = user('uid-alice')
    const meeting = room([alice], db)

    await meeting.webSocketMessage(
      alice as unknown as WebSocket,
      JSON.stringify({ type: 'save_entry', create: true, entry: { id: null, timestamp: 3000, speaker: 'Alice', text: '丁', speakerUid: 'uid-fake', source: 'firebase' } })
    )

    expect(db.rows.get(`${DATE}:3000`)).toMatchObject({ speaker_uid: 'uid-alice', source: null })
    expect(alice.saved[0].entry).toMatchObject({ speakerUid: 'uid-alice', source: null })
  })
})

describe('MeetingRoom save_entry：編輯與相容', () => {
  it('編輯（不帶 create）維持原 ts，所有人收到不帶 replaces 的 entry_saved', async () => {
    const db = new FakeD1()
    const alice = user('uid-alice')
    const editor = user('uid-editor')
    const meeting = room([alice, editor], db)

    await meeting.webSocketMessage(
      alice as unknown as WebSocket,
      JSON.stringify({ type: 'save_entry', create: true, entry: { id: 'audio_1000', timestamp: 1000, speaker: 'Alice', text: '甲', source: 'manual' } })
    )
    await meeting.webSocketMessage(editor as unknown as WebSocket, JSON.stringify({ type: 'save_entry', entry: { id: 'audio_1000', timestamp: 1000, speaker: 'Alice', text: '甲（校對）' } }))

    expect(db.rows.size).toBe(1)
    expect(db.rows.get(`${DATE}:1000`)).toEqual({ entry_id: 'audio_1000', speaker: 'Alice', text: '甲（校對）', speaker_uid: 'uid-alice', source: 'manual' })
    for (const ws of [alice, editor]) {
      const last = ws.saved.at(-1)
      expect(last?.entry).toMatchObject({ timestamp: 1000, text: '甲（校對）' })
      expect(last).not.toHaveProperty('replaces')
    }
  })

  it('舊版客戶端（不帶 create）對不存在的 ts 送 save_entry：仍能建立條目', async () => {
    const db = new FakeD1()
    const legacy = user('uid-legacy')
    const meeting = room([legacy], db)

    await meeting.webSocketMessage(legacy as unknown as WebSocket, JSON.stringify({ type: 'save_entry', entry: { id: null, timestamp: 4000, speaker: 'Legacy', text: '戊' } }))

    expect(db.rows.get(`${DATE}:4000`)).toMatchObject({ text: '戊', speaker_uid: 'uid-legacy' })
    expect(legacy.saved).toHaveLength(1)
  })

  it('未認證連線寫入被拒，D1 不動', async () => {
    const db = new FakeD1()
    const watcher = guest()
    const meeting = room([watcher], db)

    await meeting.webSocketMessage(watcher as unknown as WebSocket, JSON.stringify({ type: 'save_entry', create: true, entry: { id: null, timestamp: 5000, speaker: 'X', text: '己' } }))

    expect(db.rows.size).toBe(0)
    expect(watcher.sent).toEqual([{ type: 'error', message: '需要登入才能寫入' }])
  })
})
