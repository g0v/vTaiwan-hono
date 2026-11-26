import { describe, expect, it } from 'vite-plus/test'
import { capturersFromMetas, decodeUserName, encodeUserName } from '../lib/capture-list'

describe('轉錄中名單：capturersFromMetas（#153 步驟 2）', () => {
  it('只列出 capturing 為真的連線', () => {
    const metas = [
      { userId: 'a', name: '小明', capturing: true },
      { userId: 'b', name: '阿華', capturing: false },
    ]
    expect(capturersFromMetas(metas)).toEqual([{ userId: 'a', name: '小明' }])
  })

  it('同一帳號開兩個分頁只算一人', () => {
    const metas = [
      { userId: 'a', name: '小明', capturing: true },
      { userId: 'a', name: '小明', capturing: true },
    ]
    expect(capturersFromMetas(metas)).toEqual([{ userId: 'a', name: '小明' }])
  })

  it('同一帳號只要還有任一連線在錄音就留在名單', () => {
    const metas = [
      { userId: 'a', name: '小明', capturing: false },
      { userId: 'a', name: '小明', capturing: true },
    ]
    expect(capturersFromMetas(metas)).toEqual([{ userId: 'a', name: '小明' }])
  })

  it('依名字排序，名字相同再依 userId', () => {
    const metas = [
      { userId: 'c', name: '阿華', capturing: true },
      { userId: 'b', name: '小明', capturing: true },
      { userId: 'a', name: '小明', capturing: true },
    ]
    expect(capturersFromMetas(metas).map(c => c.userId)).toEqual(['a', 'b', 'c'])
  })

  it('沒有 userId 的連線（未登入）即使 capturing 也不列入', () => {
    const metas = [
      { userId: null, name: '訪客', capturing: true },
      { userId: '', name: '訪客', capturing: true },
    ]
    expect(capturersFromMetas(metas)).toEqual([])
  })

  it('名字缺失時以同一人其他連線的名字補上，否則為空字串', () => {
    const metas = [
      { userId: 'a', name: null, capturing: true },
      { userId: 'a', name: '小明', capturing: true },
      { userId: 'b', name: null, capturing: true },
    ]
    expect(capturersFromMetas(metas)).toEqual([
      { userId: 'b', name: '' },
      { userId: 'a', name: '小明' },
    ])
  })

  it('空輸入回空陣列', () => {
    expect(capturersFromMetas([])).toEqual([])
  })
})

describe('使用者名稱的標頭編碼（Worker → DO）', () => {
  it('中文名稱編碼後可放進 Headers，解碼後完整還原', () => {
    const name = '王小明 Wang'
    const encoded = encodeUserName(name)
    // 標頭值只能是 ASCII：真的塞進 Headers 不會擲錯
    expect(() => new Headers({ 'X-User-Name': encoded })).not.toThrow()
    expect(decodeUserName(encoded)).toBe(name)
  })

  it('缺標頭、空字串、編碼損毀一律回 null', () => {
    expect(decodeUserName(null)).toBeNull()
    expect(decodeUserName(undefined)).toBeNull()
    expect(decodeUserName('')).toBeNull()
    expect(decodeUserName('%E7%8E')).toBeNull()
  })

  it('未編碼的中文直接塞進 Headers 會擲錯（說明為什麼要編碼）', () => {
    expect(() => new Headers({ 'X-User-Name': '王小明' })).toThrow()
  })
})
