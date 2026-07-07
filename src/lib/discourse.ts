const DISCOURSE_BASE_URL = 'https://talk.vtaiwan.tw'

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

export interface DiscourseTopicList {
  topic_list: {
    topics: DiscourseTopic[]
  }
}

export interface DiscourseSearchResult {
  topics: DiscourseTopic[]
  posts: DiscoursePost[]
}

export interface TopicStats {
  views: number
  posts_count: number
  participant_count: number
  last_posted_at: string
  created_at: string
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

interface TopicListResponse {
  topic_list?: {
    topics?: DiscourseTopic[]
  }
}

interface TopicResponse extends DiscourseTopic {}

interface PostStreamResponse {
  post_stream?: {
    posts?: DiscoursePost[]
  }
}

const cache = new Map<string, unknown>()

function processUrl(url: string): string {
  if (url.startsWith('https://talk.vtaiwan.tw')) {
    return url.replace('https://talk.vtaiwan.tw', '')
  }
  return url
}

async function cachedGet<T>(path: string): Promise<T> {
  const cacheKey = path
  if (cache.has(cacheKey)) {
    return cache.get(cacheKey) as T
  }

  const url = path.startsWith('http') ? path : `${DISCOURSE_BASE_URL}${path}`
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 10000)

  try {
    const response = await fetch(url, {
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    })
    if (!response.ok) {
      throw new Error(`Discourse API error: ${response.status}`)
    }
    const data = (await response.json()) as T
    cache.set(cacheKey, data)
    return data
  } catch (error) {
    console.error('Discourse API Error:', error)
    throw error
  } finally {
    clearTimeout(timeoutId)
  }
}

function clearCache(url?: string): void {
  if (url) {
    const keysToDelete = Array.from(cache.keys()).filter((key) => key.startsWith(url))
    keysToDelete.forEach((key) => cache.delete(key))
  } else {
    cache.clear()
  }
}

async function fetchPaginatedTopics(categoryUri: string): Promise<DiscourseTopic[]> {
  const allTopics: DiscourseTopic[] = []

  const getTopics = async (uri: string, page: number): Promise<DiscourseTopic[]> => {
    try {
      const processedUri = processUrl(uri)
      const path =
        processedUri + (processedUri.includes('?') ? '&' : '?') + `include_raw=1&page=${page}`
      const data = await cachedGet<TopicListResponse>(path)

      if (!data?.topic_list?.topics) {
        console.warn('Invalid response format for topics')
        return allTopics
      }

      const topics = data.topic_list.topics
      if (topics.length > 0) {
        allTopics.push(...topics)
        return getTopics(uri, page + 1)
      }
      return allTopics
    } catch (error) {
      console.error('Failed to fetch topics page', page, ':', error)
      if (page === 0) throw error
      return allTopics
    }
  }

  return getTopics(categoryUri, 0)
}

export interface DiscourseAPI {
  getAllTopics(categoryUri?: string): Promise<DiscourseTopic[]>
  getAllCategoryTopics(categoryUri: string): Promise<DiscourseTopic[]>
  getTopic(topicId: string | number): Promise<DiscourseTopic>
  getCategoryDiscussion(category: string): Promise<DiscourseTopicList>
  searchTopics(category: string, query?: string): Promise<DiscourseSearchResult>
  getAllPosts(categoryUri: string): Promise<DiscoursePost[]>
  getTopicStats(topicId: string | number): Promise<TopicStats>
  formatTopicData(topicData: DiscourseTopic): FormattedTopicData
  clearCache(url?: string): void
  getDiscourseUrl(): string
}

const discourseAPI: DiscourseAPI = {
  async getAllTopics(categoryUri = '/c/meta-data.json'): Promise<DiscourseTopic[]> {
    try {
      return await fetchPaginatedTopics(categoryUri)
    } catch (error) {
      console.error('Failed to fetch all topics:', error)
      throw error
    }
  },

  async getAllCategoryTopics(categoryUri: string): Promise<DiscourseTopic[]> {
    try {
      return await fetchPaginatedTopics(categoryUri)
    } catch (error) {
      console.error('Failed to fetch all category topics:', error)
      throw error
    }
  },

  async getTopic(topicId: string | number): Promise<DiscourseTopic> {
    try {
      return await cachedGet<TopicResponse>(`/t/${topicId}.json?include_raw=1`)
    } catch (error) {
      console.error('Failed to fetch topic:', error)
      throw error
    }
  },

  async getCategoryDiscussion(category: string): Promise<DiscourseTopicList> {
    try {
      return await cachedGet<DiscourseTopicList>(`/c/${category}/l/latest.json`)
    } catch (error) {
      console.error('Failed to fetch category discussion:', error)
      throw error
    }
  },

  async searchTopics(category: string, query = ''): Promise<DiscourseSearchResult> {
    try {
      const searchQuery = query ? `category:${category} ${query}` : `category:${category}`
      return await cachedGet<DiscourseSearchResult>(`/search.json?q=${encodeURIComponent(searchQuery)}`)
    } catch (error) {
      console.error('Failed to search topics:', error)
      throw error
    }
  },

  async getAllPosts(categoryUri: string): Promise<DiscoursePost[]> {
    try {
      const result = await cachedGet<PostStreamResponse>(categoryUri + '?include_raw=1')
      return result.post_stream?.posts ?? []
    } catch (error) {
      console.error('Failed to fetch posts:', error)
      throw error
    }
  },

  async getTopicStats(topicId: string | number): Promise<TopicStats> {
    try {
      const data = await cachedGet<TopicResponse>(`/t/${topicId}.json`)
      return {
        views: data.views,
        posts_count: data.posts_count,
        participant_count: data.participant_count,
        last_posted_at: data.last_posted_at,
        created_at: data.created_at,
      }
    } catch (error) {
      console.error('Failed to fetch topic stats:', error)
      throw error
    }
  },

  formatTopicData(topicData: DiscourseTopic): FormattedTopicData {
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
  },

  clearCache,

  getDiscourseUrl(): string {
    return DISCOURSE_BASE_URL
  },
}

export default discourseAPI
