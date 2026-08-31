import { describe, expect, it } from 'vite-plus/test'
import { parseBookmarkedTopicIds, toggleBookmarkedTopicId } from '../lib/topic-bookmarks'

describe('議題書籤', () => {
  it('只從瀏覽器儲存資料保留有效且不重複的議題 ID', () => {
    expect(parseBookmarkedTopicIds('[1, "2", 1, 0, -3, 4.5, 8]')).toEqual([1, 8])
    expect(parseBookmarkedTopicIds('{"id": 1}')).toEqual([])
    expect(parseBookmarkedTopicIds('invalid json')).toEqual([])
  })

  it('可切換單一議題的收藏狀態且不變更既有陣列', () => {
    const bookmarkedIds = [1, 2]

    expect(toggleBookmarkedTopicId(bookmarkedIds, 3)).toEqual([1, 2, 3])
    expect(toggleBookmarkedTopicId(bookmarkedIds, 2)).toEqual([1])
    expect(toggleBookmarkedTopicId(bookmarkedIds, 0)).toBe(bookmarkedIds)
    expect(bookmarkedIds).toEqual([1, 2])
  })
})
