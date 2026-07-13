<template>
  <div class="container mx-auto px-2 py-8">
    <div class="mb-8 flex flex-col items-center justify-between md:flex-row">
      <h1 class="text-3xl font-bold md:w-1/2">{{ $t('header.mastodon') }}</h1>
      <p class="text-sm text-gray-500">
        {{ $t('blog.sourceDescription') }}
        <a
          href="https://g0v.social/tags/vTaiwan"
          target="_blank"
          rel="noopener noreferrer"
          class="text-sm text-democratic-red hover:underline"
        >g0v.social/tags/vTaiwan</a>
      </p>
    </div>

    <!-- 語言切換 Tabs -->
    <div class="mb-6 flex space-x-1 rounded-lg bg-gray-100 p-1">
      <button
        @click="renderSetting = 'all'"
        :class="['rounded-md px-4 py-2 text-sm font-medium transition-colors', renderSetting === 'all' ? 'bg-white text-gray-900 shadow-xs' : 'text-gray-600 hover:text-gray-900']"
      >
        {{ $t('blog.allLanguages') }}
      </button>
      <button
        @click="renderSetting = 'current'"
        :class="['rounded-md px-4 py-2 text-sm font-medium transition-colors', renderSetting === 'current' ? 'bg-white text-gray-900 shadow-xs' : 'text-gray-600 hover:text-gray-900']"
      >
        {{ $t('blog.currentLanguage') }}
      </button>
    </div>

    <div v-if="loading" class="py-8 text-center">
      <p class="text-gray-600">{{ $t('blog.loading') }}</p>
    </div>

    <div v-else-if="error" class="py-8 text-center">
      <p class="text-red-600">{{ error }}</p>
    </div>

    <div v-else class="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
      <article
        v-for="post in filteredPosts"
        :key="post.id"
        class="rounded-lg bg-white p-6 shadow-md transition-shadow hover:shadow-lg"
      >
        <!-- 貼文標頭 -->
        <div class="mb-4 flex items-center space-x-3">
          <img
            v-if="post.account.avatar"
            :src="post.account.avatar"
            :alt="post.account.display_name"
            class="h-12 w-12 rounded-full"
          />
          <div class="flex-1">
            <a :href="post.account.url" target="_blank" rel="noopener noreferrer" class="text-sm font-semibold text-democratic-red hover:underline">
              {{ post.account.display_name }}
            </a>
            <div class="text-sm text-gray-500">
              <a :href="post.url" target="_blank" rel="noopener noreferrer" class="text-sm text-gray-400 hover:text-democratic-red">
                {{ formatDate(post.created_at) }}
              </a>
            </div>
          </div>
        </div>

        <!-- 貼文摘要 -->
        <div class="mb-4">
          <div class="prose prose-sm max-w-none text-gray-700">{{ getSummary(post.content) }}</div>
        </div>

        <!-- 互動統計 -->
        <div class="flex items-center space-x-6 text-sm text-gray-500">
          <div class="flex items-center space-x-1">
            <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            <span>{{ post.replies_count }}</span>
          </div>
          <div class="flex items-center space-x-1">
            <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            <span>{{ post.reblogs_count }}</span>
          </div>
          <div class="flex items-center space-x-1">
            <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
            </svg>
            <span>{{ post.favourites_count }}</span>
          </div>
        </div>

        <!-- 標籤 -->
        <div v-if="post.tags && post.tags.length > 0" class="mt-4 flex flex-wrap gap-2">
          <span
            v-for="tag in post.tags"
            :key="tag.name"
            class="rounded-full bg-jade-green/10 px-2 py-1 text-sm text-jade-green"
          >#{{ tag.name }}</span>
        </div>

        <!-- 外部連結 -->
        <div class="mt-4">
          <a :href="post.url" target="_blank" rel="noopener noreferrer" class="text-sm text-democratic-red hover:underline">
            {{ $t('blog.viewOriginal') }}
          </a>
        </div>
      </article>
    </div>

    <!-- 無貼文時顯示 -->
    <div v-if="!loading && !error && filteredPosts.length === 0" class="py-8 text-center">
      <p class="text-gray-600">{{ $t('blog.noPosts') }}</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useI18n } from 'vue-i18n'

const { locale } = useI18n()

interface MastodonAccount {
  display_name: string
  avatar: string
  url: string
}

interface MastodonTag {
  name: string
}

interface MastodonPost {
  id: string
  content: string
  url: string
  created_at: string
  language: string | null
  replies_count: number
  reblogs_count: number
  favourites_count: number
  account: MastodonAccount
  tags: MastodonTag[]
}

const posts = ref<MastodonPost[]>([])
const loading = ref(true)
const error = ref<string | null>(null)
const renderSetting = ref<'all' | 'current'>('all')

const filteredPosts = computed(() => {
  if (renderSetting.value === 'all') return posts.value
  const lang = locale.value
  return posts.value.filter(post => {
    if (!post.language) return true
    if ((post.language === 'zh-TW' || post.language === 'zh') && lang === 'zh-TW') return true
    if (post.language === 'en' && lang === 'en') return true
    if (post.language === 'ja' && lang === 'ja') return true
    return false
  })
})

const formatDate = (dateString: string) =>
  new Date(dateString).toLocaleDateString(locale.value, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })

const getSummary = (content: string): string => {
  if (!content) return ''
  const text = content.replace(/<[^>]*>/g, '')
  return text.length > 80 ? text.substring(0, 80) + '...' : text
}

const fetchPosts = async () => {
  try {
    loading.value = true
    error.value = null
    const response = await fetch('/api/mastodon')
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    posts.value = await response.json()
  } catch (err) {
    console.error('取得 Mastodon 貼文失敗:', err)
    error.value = String(err instanceof Error ? err.message : err)
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  fetchPosts()
})
</script>

<style scoped>
.prose :deep(a) {
  @apply text-democratic-red underline hover:opacity-80;
}
.prose :deep(p) {
  @apply mb-2;
}
</style>
