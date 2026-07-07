<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import IconWrapper from '../components/IconWrapper.vue'
import discourseApi, { type FormattedTopicData } from '../lib/discourse'

const router = useRouter()
const { t } = useI18n()

const STEP_KEYS = ['即將開始', '意見徵集', '研擬草案', '送交院會', '歷史案件'] as const

const topics = ref<FormattedTopicData[]>([])
const loading = ref(true)
const searchQuery = ref('')
const sortBy = ref<'latest' | 'participants' | 'views'>('latest')
const lastUpdated = ref('')

const steps = ref(
  STEP_KEYS.map((key) => ({
    key,
    shortKey: key.slice(0, 2),
    active: false,
    current: false,
  })),
)

const bookmarkedIds = ref<number[]>([])
const showBookmarksOnly = ref(false)
const selectedStep = ref('')

const recentTopics = computed(() => {
  const threeMonthsAgo = new Date()
  threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3)

  return topics.value
    .filter((topic) => {
      if (topic.title === '網站基本設定') return false
      const topicDate = new Date(topic.last_posted_at || topic.created_at)
      return topicDate >= threeMonthsAgo
    })
    .sort((a, b) => {
      const dateA = new Date(a.last_posted_at || a.created_at).getTime()
      const dateB = new Date(b.last_posted_at || b.created_at).getTime()
      return dateB - dateA
    })
    .slice(0, 6)
})

const filteredTopics = computed(() => {
  let filtered = topics.value.filter((topic) => topic.title !== '網站基本設定')

  if (showBookmarksOnly.value) {
    filtered = filtered.filter((topic) => bookmarkedIds.value.includes(topic.id))
  }

  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase()
    filtered = filtered.filter(
      (topic) =>
        topic.title.toLowerCase().includes(query) ||
        topic.slogan?.toLowerCase().includes(query) ||
        topic.status.toLowerCase().includes(query),
    )
  }

  if (selectedStep.value !== '') {
    const stepKey = steps.value[Number(selectedStep.value)]?.key
    if (stepKey) {
      filtered = filtered.filter((topic) => topic.status === stepKey)
    }
  }

  const activeSteps = steps.value.filter((step) => step.active || step.current)
  if (activeSteps.length > 0) {
    const activeStatuses = activeSteps.map((step) => step.key)
    filtered = filtered.filter((topic) => activeStatuses.includes(topic.status as (typeof STEP_KEYS)[number]))
  }

  const sorted = [...filtered]
  switch (sortBy.value) {
    case 'participants':
      sorted.sort((a, b) => (b.participant_count || 0) - (a.participant_count || 0))
      break
    case 'views':
      sorted.sort((a, b) => (b.views || 0) - (a.views || 0))
      break
    case 'latest':
    default:
      sorted.sort(
        (a, b) =>
          new Date(b.last_posted_at || b.created_at).getTime() -
          new Date(a.last_posted_at || a.created_at).getTime(),
      )
      break
  }

  return sorted
})

const filteredTopicsBigImg = computed(() =>
  filteredTopics.value.filter((topic) => topic.status === '即將開始' || !topic.status),
)

const filteredTopicsSmallImg = computed(() =>
  filteredTopics.value.filter((topic) => topic.status !== '即將開始'),
)

const getStatusText = (status: string): string => {
  const textMap: Record<string, string> = {
    即將開始: '即將開始',
    意見徵集: '意見徵集',
    研擬草案: '研擬草案',
    送交院會: '送交院會',
    歷史案件: '歷史案件',
  }
  return textMap[status] || status
}

const formatDate = (dateString?: string): string => {
  if (!dateString) return ''
  const date = new Date(dateString)
  return date.toLocaleDateString('zh-TW', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
}

const clearSearch = () => {
  searchQuery.value = ''
}

const toggleBookmarksOnly = () => {
  showBookmarksOnly.value = !showBookmarksOnly.value
}

const goToTopic = (topic: FormattedTopicData) => {
  router.push(`/topic/${topic.routeName}`)
}

const shareTopic = (topic: FormattedTopicData) => {
  const url = `${window.location.origin}/topic/${topic.routeName}`
  if (navigator.share) {
    navigator.share({ title: topic.title, text: topic.slogan, url })
  } else {
    navigator.clipboard.writeText(url)
  }
}

const loadBookmarks = () => {
  if (typeof window === 'undefined') return
  const stored = localStorage.getItem('bookmarkedTopics')
  if (stored) {
    try {
      bookmarkedIds.value = JSON.parse(stored) as number[]
    } catch {
      bookmarkedIds.value = []
    }
  } else {
    bookmarkedIds.value = []
  }
}

const saveBookmarks = () => {
  if (typeof window === 'undefined') return
  localStorage.setItem('bookmarkedTopics', JSON.stringify(bookmarkedIds.value))
}

const isBookmarked = (topic: FormattedTopicData): boolean => {
  return bookmarkedIds.value.includes(topic.id)
}

const bookmarkTopic = (topic: FormattedTopicData) => {
  const idx = bookmarkedIds.value.indexOf(topic.id)
  if (idx === -1) {
    bookmarkedIds.value.push(topic.id)
  } else {
    bookmarkedIds.value.splice(idx, 1)
  }
  saveBookmarks()
}

const loadTopics = async () => {
  try {
    loading.value = true
    const allTopics = await discourseApi.getAllTopics()
    const processedTopics: FormattedTopicData[] = []

    for (const topic of allTopics) {
      try {
        const topicData = await discourseApi.getTopic(topic.id)
        processedTopics.push(discourseApi.formatTopicData(topicData))
      } catch (error) {
        console.error('Error processing topic:', topic.id, error)
      }
    }

    topics.value = processedTopics
    lastUpdated.value = new Date().toLocaleString('zh-TW')
  } catch (error) {
    console.error('Error loading topics:', error)
  } finally {
    loading.value = false
  }
}

watch(topics, () => {
  loadBookmarks()
})

onMounted(() => {
  loadTopics()
  loadBookmarks()
})
</script>

<template>
  <section class="vt-hero-bg -mt-[84px] text-white sm:-mt-[88px]">
    <div class="relative z-10 mx-auto max-w-5xl px-2 pb-24 pt-[156px] sm:pt-[184px]">
      <div class="mx-auto max-w-7xl">
        <h1 class="mb-4 text-3xl font-bold md:text-4xl">{{ t('topics.title') }}</h1>
        <p class="mb-6 text-lg opacity-90">
          {{ t('topics.description') }}
          <RouterLink to="/polis" class="ml-1 inline-block font-medium text-democratic-red underline underline-offset-4 transition hover:text-white">
            {{ t('topics.tryPolisLink') }}
          </RouterLink>
        </p>
      </div>
    </div>
  </section>

  <section class="bg-gray-50 py-12">
    <div class="mx-auto px-2">
      <div class="mx-auto max-w-7xl">
        <h2 class="mb-3 text-left text-2xl font-bold md:text-3xl">{{ t('topics.recentTitle') }}</h2>
        <p class="mb-8 max-w-2xl text-left text-gray-600">{{ t('topics.recentDesc') }}</p>

        <div v-if="loading" class="py-8 text-center">
          <IconWrapper name="calendar" :size="48" color="#9CA3AF" class="mx-auto mb-4" />
          <p class="text-gray-500">{{ t('common.loading') }}</p>
        </div>
        <div v-else-if="recentTopics.length > 0" class="grid grid-cols-1 gap-6 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3">
          <div
            v-for="topic in recentTopics"
            :key="topic.id"
            class="vt-topic-card min-h-[260px] max-w-sm cursor-pointer p-6"
            @click="goToTopic(topic)"
          >
            <div class="vt-topic-card-arrow">
              <IconWrapper name="arrow-up-right" :size="14" type="primary" />
            </div>

            <div class="mb-5 flex items-start gap-4 pr-10">
              <div class="vt-topic-card-halo">
                <IconWrapper name="message-circle" :size="24" type="primary" />
              </div>
              <div class="min-w-0">
                <h3 class="mb-2 line-clamp-2 text-[19px] font-bold leading-tight tracking-[-0.01em] text-vt-gray-800">{{ topic.title }}</h3>
                <div class="vt-topic-eyebrow flex-wrap">
                  <span class="vt-topic-status-dot" aria-hidden="true" />
                  <span>{{ t('topics.steps.' + getStatusText(topic.status)) }}</span>
                  <span class="text-vt-fg-3">・{{ formatDate(topic.last_posted_at || topic.created_at) }}</span>
                </div>
              </div>
            </div>

            <p v-if="topic.slogan" class="mb-4 line-clamp-2 text-sm leading-[1.55] text-vt-fg-2">{{ topic.slogan }}</p>

            <div
              v-if="topic.cover"
              class="vt-topic-cover-slice relative mb-4"
              :style="{ backgroundImage: `url(${topic.cover})` }"
            />

            <div class="vt-topic-card-footer mt-auto flex-wrap">
              <span class="vt-topic-pill text-xs">
                <IconWrapper name="users" :size="14" />
                <span>{{ topic.participant_count || 0 }}</span>
              </span>
              <span class="vt-topic-stat">
                <IconWrapper name="message-circle" :size="14" />
                <span>{{ topic.posts_count || 0 }}</span>
              </span>
              <span class="vt-topic-stat">
                <IconWrapper name="eye" :size="14" />
                <span>{{ topic.views || 0 }}</span>
              </span>
            </div>
          </div>
        </div>
        <div v-else class="py-8 text-center">
          <IconWrapper name="calendar" :size="48" color="#9CA3AF" class="mx-auto mb-4" />
          <p class="text-gray-500">{{ t('topics.noRecent') }}</p>
        </div>
      </div>
    </div>
  </section>

  <div class="mb-8 rounded-lg bg-white p-8 shadow-md">
    <div class="mx-auto px-2">
      <div class="mx-auto flex max-w-7xl flex-col items-start gap-4 lg:flex-row lg:items-center">
        <div class="max-w-md flex-1">
          <div class="relative">
            <input
              v-model="searchQuery"
              type="text"
              :placeholder="t('topics.search.placeholder')"
              class="w-full min-w-64 rounded-lg border border-gray-300 bg-white px-4 py-3 pl-12 pr-12 text-gray-900 focus:outline-hidden focus:ring-2 focus:ring-jade-green"
            />
            <IconWrapper name="search" :size="20" class="absolute left-4 top-1/2 -translate-y-1/2 transform text-gray-400" />
            <button
              v-if="searchQuery"
              class="absolute right-4 top-1/2 -translate-y-1/2 transform text-gray-400 transition-colors hover:text-gray-600"
              @click="clearSearch"
            >
              <IconWrapper name="x" :size="16" />
            </button>
          </div>
        </div>

        <div class="flex w-full items-center justify-start gap-2 lg:justify-between">
          <div class="flex gap-2">
            <button
              :class="['rounded-lg px-4 py-2 font-medium transition-colors', sortBy === 'latest' ? 'bg-black text-white' : 'bg-gray-100 text-black hover:bg-gray-200']"
              @click="sortBy = 'latest'"
            >
              {{ t('topics.sort.latest') }}
            </button>
            <button
              :class="['rounded-lg px-4 py-2 font-medium transition-colors', sortBy === 'participants' ? 'bg-black text-white' : 'bg-gray-100 text-black hover:bg-gray-200']"
              @click="sortBy = 'participants'"
            >
              {{ t('topics.sort.participants') }}
            </button>
            <button
              :class="['rounded-lg px-4 py-2 font-medium transition-colors', sortBy === 'views' ? 'bg-black text-white' : 'bg-gray-100 text-black hover:bg-gray-200']"
              @click="sortBy = 'views'"
            >
              {{ t('topics.sort.views') }}
            </button>
          </div>
          <button
            :class="[
              'ml-2 flex items-center gap-1 rounded-lg px-4 py-2 font-medium transition-colors',
              showBookmarksOnly ? 'bg-democratic-red text-white shadow-sm' : 'bg-gray-100 text-black hover:bg-gray-200',
            ]"
            @click="toggleBookmarksOnly"
          >
            <IconWrapper name="bookmark" :size="18" :class="showBookmarksOnly ? 'fill-white' : 'fill-none'" />
            <span>{{ t('topics.bookmarks.myBookmarks') }}</span>
          </button>
        </div>

        <div class="relative mx-auto mt-4 w-64 lg:mt-0">
          <select
            v-model="selectedStep"
            class="w-full appearance-none rounded-sm border border-gray-300 bg-white px-4 py-2 pr-10 leading-tight text-gray-700 focus:border-gray-500 focus:bg-white focus:outline-hidden"
          >
            <option value="">{{ t('topics.steps.all') }}</option>
            <option v-for="(step, index) in steps" :key="index" :value="String(index)">
              {{ t('topics.steps.' + step.key) }}
            </option>
          </select>
          <span class="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 transform">
            <IconWrapper name="chevron-down" :size="20" />
          </span>
        </div>
      </div>
    </div>
  </div>

  <section class="py-8">
    <div class="mx-auto px-2">
      <div class="mx-auto max-w-7xl">
        <div class="mb-6 flex items-center justify-between">
          <div class="text-gray-600">{{ t('topics.list.found', { count: filteredTopics.length }) }}</div>
          <div class="text-sm text-gray-500">{{ t('topics.list.lastUpdated') }}: {{ lastUpdated }}</div>
        </div>

        <div v-if="loading" class="py-12 text-center">
          <div class="mx-auto h-12 w-12 animate-spin rounded-full border-b-2 border-democratic-red" />
          <p class="mt-4 text-gray-600">{{ t('topics.list.loading') }}</p>
        </div>

        <div v-else-if="filteredTopics.length > 0">
          <div v-if="filteredTopicsBigImg.length > 0" class="mb-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div
              v-for="topic in filteredTopicsBigImg"
              :key="topic.id"
              class="vt-topic-card min-h-[320px] w-full p-6"
            >
              <RouterLink :to="`/topic/${topic.routeName}`" class="vt-topic-card-arrow" :aria-label="topic.title">
                <IconWrapper name="arrow-up-right" :size="14" type="primary" />
              </RouterLink>

              <div class="mb-5 flex items-start gap-4 pr-10">
                <div class="vt-topic-card-halo">
                  <IconWrapper name="message-circle" :size="24" type="primary" />
                </div>
                <div class="min-w-0">
                  <h3 class="mb-2 line-clamp-2 text-2xl font-bold leading-tight tracking-[-0.01em] text-vt-gray-800">
                    <RouterLink :to="`/topic/${topic.routeName}`" class="transition hover:text-democratic-red">
                      {{ topic.title }}
                    </RouterLink>
                  </h3>
                  <div class="vt-topic-eyebrow flex-wrap">
                    <span class="vt-topic-status-dot" aria-hidden="true" />
                    <span>{{ t('topics.steps.' + getStatusText(topic.status)) }}</span>
                    <span class="text-vt-fg-3">・{{ formatDate(topic.last_posted_at || topic.created_at) }}</span>
                  </div>
                </div>
              </div>

              <div
                v-if="topic.cover"
                class="vt-topic-cover-slice relative mb-5 min-h-[112px]"
                :style="{ backgroundImage: `url(${topic.cover})` }"
              />

              <div class="mb-4 flex flex-1 flex-col">
                <p v-if="topic.slogan" class="mb-5 line-clamp-3 text-base leading-[1.65] text-vt-fg-2">{{ topic.slogan }}</p>

                <div class="mb-4 grid grid-cols-3 gap-2 text-xs text-vt-fg-2 sm:flex sm:flex-wrap">
                  <span class="vt-topic-pill">
                    <IconWrapper name="users" :size="14" />
                    <span>{{ topic.participant_count || 0 }}</span>
                  </span>
                  <span class="vt-topic-pill">
                    <IconWrapper name="message-circle" :size="16" />
                    <span>{{ topic.posts_count || 0 }}</span>
                  </span>
                  <span class="vt-topic-pill">
                    <IconWrapper name="eye" :size="16" />
                    <span>{{ topic.views || 0 }}</span>
                  </span>
                  <span class="vt-topic-pill">
                    <IconWrapper name="calendar" :size="16" />
                    <span>{{ formatDate(topic.last_posted_at || topic.created_at) }}</span>
                  </span>
                </div>

                <div v-if="topic.tags?.length" class="mb-3 flex flex-wrap gap-2">
                  <span v-for="tag in topic.tags" :key="tag" class="vt-topic-pill text-xs">
                    {{ tag }}
                  </span>
                </div>
              </div>

              <div class="mt-auto">
                <RouterLink :to="`/topic/${topic.routeName || topic.id}`" class="vt-btn vt-btn-primary w-full justify-center text-center">
                  {{ t('topics.detail.participate') }}
                </RouterLink>
              </div>
            </div>
          </div>

          <div
            v-if="filteredTopicsSmallImg.length > 0"
            class="grid grid-cols-1 gap-0 md:grid-cols-2 md:gap-6 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5"
          >
            <div
              v-for="topic in filteredTopicsSmallImg"
              :key="topic.id"
              class="vt-topic-card min-h-[190px] cursor-pointer p-5"
              @click="goToTopic(topic)"
            >
              <div class="vt-topic-card-arrow">
                <IconWrapper name="arrow-up-right" :size="14" type="primary" />
              </div>

              <div class="mb-4 flex items-start gap-3 pr-10">
                <div
                  v-if="topic.cover"
                  class="vt-topic-cover-thumb"
                  :style="{ backgroundImage: `url(${topic.cover})` }"
                />
                <div v-else class="vt-topic-card-halo vt-topic-card-halo-sm">
                  <IconWrapper name="message-circle" :size="18" type="primary" />
                </div>
                <div class="min-w-0">
                  <h3 class="mb-2 line-clamp-2 text-[17px] font-bold leading-tight tracking-[-0.01em] text-vt-gray-800">{{ topic.title }}</h3>
                  <div class="vt-topic-eyebrow flex-wrap">
                    <span class="vt-topic-status-dot" aria-hidden="true" />
                    <span>{{ t('topics.steps.' + getStatusText(topic.status)) }}</span>
                  </div>
                </div>
              </div>

              <div class="flex flex-1 flex-col">
                <p v-if="topic.slogan" class="mb-4 line-clamp-2 text-sm leading-[1.55] text-vt-fg-2">{{ topic.slogan }}</p>

                <div class="mb-4 flex flex-wrap items-center gap-2 text-xs text-vt-fg-2">
                  <span class="vt-topic-pill">
                    <IconWrapper name="users" :size="12" />
                    <span>{{ topic.participant_count || 0 }}</span>
                  </span>
                  <span class="vt-topic-pill">
                    <IconWrapper name="message-circle" :size="12" />
                    <span>{{ topic.posts_count || 0 }}</span>
                  </span>
                  <span class="vt-topic-pill">
                    <IconWrapper name="eye" :size="12" />
                    <span>{{ topic.views || 0 }}</span>
                  </span>
                </div>

                <div class="vt-topic-card-footer mt-auto text-xs text-vt-fg-3">
                  <div class="flex items-center gap-1 whitespace-nowrap">
                    <IconWrapper name="calendar" :size="10" />
                    <span>{{ formatDate(topic.created_at) }}</span>
                  </div>
                  <div class="flex items-center gap-1">
                    <button
                      class="vt-topic-pill p-1 text-vt-fg-3 transition-colors hover:text-democratic-red"
                      :title="t('topics.actions.share')"
                      @click.stop="shareTopic(topic)"
                    >
                      <IconWrapper name="share-2" :size="12" />
                    </button>
                    <button
                      class="vt-topic-pill p-1 transition-colors"
                      :title="t('topics.actions.bookmark')"
                      @click.stop="bookmarkTopic(topic)"
                    >
                      <IconWrapper
                        name="bookmark"
                        :size="12"
                        :class="isBookmarked(topic) ? 'fill-democratic-red text-democratic-red' : 'text-gray-400 hover:text-democratic-red'"
                      />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div v-else class="py-12 text-center">
          <IconWrapper :name="searchQuery ? 'search' : 'message-circle'" :size="64" color="#9CA3AF" class="mx-auto mb-4" />
          <p class="text-lg text-gray-500">
            {{ searchQuery ? t('topics.search.noResults') : t('topics.list.empty') }}
          </p>
          <button
            v-if="searchQuery"
            class="vt-btn vt-btn-primary mt-4"
            @click="clearSearch"
          >
            {{ t('topics.search.clearSearch') }}
          </button>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.line-clamp-2 {
  display: -webkit-box;
  line-clamp: 2;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.line-clamp-3 {
  display: -webkit-box;
  line-clamp: 3;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>
