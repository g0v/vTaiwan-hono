// 轉錄中名單（#153 步驟 2）——純函式，MeetingRoom DO / Worker / 前端共用。
//
// 名單不落 D1：它是「各連線目前回報的錄音狀態」，由 DO 從每條 WebSocket 的
// attachment（名牌）聚合後廣播。這裡只負責「拿一組名牌，算出名單」；
// 什麼時候算、拿哪些名牌算、誰可以改名牌，都是 DO 的事（見 meeting-room.ts）。
//
// 去重以 userId 為準：同一帳號開兩個分頁只算一人，任一連線仍在錄音就留在名單。

/** 每條連線名牌上與名單有關的欄位（ConnectionMeta 的子集） */
export interface CaptureMeta {
  userId: string | null
  name: string | null
  capturing: boolean
}

/** 名單上的一個人 */
export interface Capturer {
  userId: string
  name: string
}

/**
 * 從名牌陣列算出轉錄中名單：過濾 capturing、以 userId 去重、依名字排序。
 * 沒有 userId 的連線（未登入）一律不列入——DO 不會讓它們改名牌，這裡再擋一次是防禦性的。
 */
export function capturersFromMetas(metas: readonly CaptureMeta[]): Capturer[] {
  const byUser = new Map<string, Capturer>()
  for (const meta of metas) {
    if (!meta.capturing || !meta.userId) continue
    const existing = byUser.get(meta.userId)
    // 同一人多條連線：名字以第一個非空的為準
    if (!existing) byUser.set(meta.userId, { userId: meta.userId, name: meta.name || '' })
    else if (!existing.name && meta.name) existing.name = meta.name
  }
  return [...byUser.values()].sort((a, b) => a.name.localeCompare(b.name, 'zh-Hant') || a.userId.localeCompare(b.userId))
}

/**
 * 使用者名稱 → 可放進 HTTP 標頭的字串。
 * 標頭值不能放非 ASCII（中文會讓 `Headers.set` 擲錯），Worker 轉送給 DO 前先編碼。
 */
export function encodeUserName(name: string): string {
  return encodeURIComponent(name)
}

/**
 * HTTP 標頭字串 → 使用者名稱。缺標頭、空字串或編碼損毀一律回 null，
 * 讓 DO 把它當「沒有名字」處理，而不是把 `%E7%8E%8B` 這種半截字串當名字顯示。
 */
export function decodeUserName(header: string | null | undefined): string | null {
  if (!header) return null
  try {
    const decoded = decodeURIComponent(header)
    return decoded || null
  } catch {
    return null
  }
}
