// Discourse 型別與純資料轉換（client / server 共用，無任何 runtime 相依，可安全進 client bundle）

export interface DiscoursePost {
  id: number
  raw: string
  cooked: string
  username: string
  avatar_template: string
  created_at: string
  post_number: number
}

export interface DiscourseTopic {
  id: number
  title: string
  posts_count: number
  views: number
  participant_count: number
  last_posted_at: string
  created_at: string
  tags: string[]
  pinned: boolean
  post_stream: {
    posts: DiscoursePost[]
  }
}

export interface FormattedTopicData {
  id: number
  title: string
  routeName: string
  status: string
  slogan: string
  owner: string
  cover: string
  tags: string[]
  views: number
  posts_count: number
  participant_count: number
  last_posted_at: string
  created_at: string
}

interface ParsedPostData {
  slogan: string
  owner: string
  cover: string
}

// 純函式：把 Discourse 原始 topic 轉為前端使用的精簡格式（無 I/O，可在任一端執行）
export function formatTopicData(topicData: DiscourseTopic): FormattedTopicData {
  const firstPost = topicData.post_stream.posts[0]
  const lastPost = topicData.post_stream.posts.slice(-1)[0]

  const parseFirstPost = (raw: string): ParsedPostData => {
    const sloganMatch = /slogan *: *(.*)/g.exec(raw)
    const ownerMatch = /@(\w+)/g.exec(raw)
    const coverMatch = /cover *: *(.*)/g.exec(raw)

    return {
      slogan: sloganMatch ? sloganMatch[1] : '',
      owner: ownerMatch ? ownerMatch[1] : '',
      cover: coverMatch ? coverMatch[1] : '',
    }
  }

  const parsedData = parseFirstPost(firstPost.raw)

  return {
    id: topicData.id,
    title: topicData.title.split(' ')[0],
    routeName: topicData.title.split(' ')[1],
    status: firstPost.id === lastPost.id ? '即將開始' : lastPost.raw.split(' ')[0],
    slogan: parsedData.slogan,
    owner: parsedData.owner,
    cover: parsedData.cover,
    tags: topicData.tags,
    views: topicData.views,
    posts_count: topicData.posts_count,
    participant_count: topicData.participant_count,
    last_posted_at: topicData.last_posted_at,
    created_at: topicData.created_at,
  }
}
