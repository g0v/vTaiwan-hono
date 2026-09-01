<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import IconWrapper from '../components/IconWrapper.vue'
import TopicProgress from '../components/TopicProgress.vue'
import TopicSlide from '../components/TopicSlide.vue'
import TopicTimeline from '../components/TopicTimeline.vue'
import TopicDiscussion from '../components/TopicDiscussion.vue'
import discourseApi, { type FormattedTopicData } from '../lib/discourse'
import { titleForTopicDetail } from '../ssr/heads'

const route = useRoute()
const { t, locale } = useI18n()

const topic = ref<FormattedTopicData | null>(null)
const loading = ref(true)
const activeTab = ref<'timeline' | 'discussion'>('timeline')
const realTopicId = ref<number | null>(null)
let topicLoadRequestId = 0

const topicId = computed(() => String(route.params.id ?? ''))

const showDiscussionButton = computed(() => {
  if (!topic.value?.status) return false
  return ['意見徵集', '研擬草案'].includes(topic.value.status)
})

const showDiscussionTab = computed(() => showDiscussionButton.value)

const syncTopicTitle = () => {
  if (typeof window === 'undefined' || typeof document === 'undefined' || !topic.value) return
  document.title = titleForTopicDetail(topicId.value, t, topic.value.title)
}

const loadTopic = async () => {
  const requestId = ++topicLoadRequestId
  const requestedTopicId = topicId.value
  const isCurrentRequest = () => requestId === topicLoadRequestId && requestedTopicId === topicId.value

  try {
    loading.value = true
    topic.value = null
    realTopicId.value = null
    const allTopics = await discourseApi.getAllTopics()

    if (!isCurrentRequest()) return

    const targetTopic = allTopics.find(item => {
      const routeName = item.title.split(' ')[1]
      return routeName === requestedTopicId
    })

    if (!targetTopic) {
      topic.value = null
      return
    }

    realTopicId.value = targetTopic.id
    const topicData = await discourseApi.getTopic(targetTopic.id)

    if (!isCurrentRequest()) return

    topic.value = discourseApi.formatTopicData(topicData)
    syncTopicTitle()

    if (route.hash === '#discussion' && showDiscussionButton.value) {
      activeTab.value = 'discussion'
    } else {
      activeTab.value = 'timeline'
    }
  } catch (error) {
    if (!isCurrentRequest()) return

    console.error('Error loading topic:', error)
    topic.value = null
  } finally {
    if (isCurrentRequest()) loading.value = false
  }
}

onMounted(() => {
  loadTopic()
})

watch(topicId, () => {
  void loadTopic()
})

// 社群爬蟲不執行 hydration；OG/Twitter title 保留 SSR 的 routeName fallback。
// 瀏覽器切換語言時，全域 head 同步會先恢復 fallback，再由議題頁補回實際名稱。
watch(locale, syncTopicTitle)
</script>

<template>
  <div v-if="topic">
    <TopicProgress v-if="realTopicId" :topic-id="realTopicId" />

    <section class="py-8">
      <div class="mx-auto px-4">
        <div class="mx-auto max-w-4xl text-center">
          <h1 class="mb-4 text-4xl font-bold md:text-5xl">{{ topic.title }}</h1>
        </div>
      </div>
    </section>

    <TopicSlide v-if="realTopicId" :topic-id="realTopicId" :show-discussion-button="showDiscussionButton" />

    <section class="py-16">
      <div class="mx-auto px-4">
        <div class="mx-auto max-w-4xl">
          <div class="mb-8 flex flex-wrap justify-center gap-4 border-b border-gray-200">
            <button
              :class="[
                'flex items-center border-b-2 px-6 py-3 font-medium transition-colors',
                activeTab === 'timeline' ? 'border-jade-green text-jade-green' : 'border-transparent text-gray-500 hover:text-gray-700',
              ]"
              @click="activeTab = 'timeline'"
            >
              <IconWrapper name="calendar" :size="16" class="mr-2" />
              <span class="hidden md:inline">{{ t('topics.detail.timeline') }}</span>
              <span class="md:hidden">{{ t('topics.detail.timelineShort') }}</span>
            </button>
            <button
              v-if="showDiscussionTab"
              :class="[
                'flex items-center border-b-2 px-6 py-3 font-medium transition-colors',
                activeTab === 'discussion' ? 'border-jade-green text-jade-green' : 'border-transparent text-gray-500 hover:text-gray-700',
              ]"
              @click="activeTab = 'discussion'"
            >
              <IconWrapper name="message-circle" :size="16" class="mr-2" />
              <span class="hidden md:inline">{{ t('topics.detail.discussion') }}</span>
              <span class="md:hidden">{{ t('topics.detail.discussionShort') }}</span>
            </button>
          </div>

          <div class="tab-content min-h-[400px]">
            <div v-if="activeTab === 'timeline' && realTopicId">
              <TopicTimeline :topic-id="realTopicId" />
            </div>
            <div v-if="activeTab === 'discussion' && realTopicId && showDiscussionTab">
              <TopicDiscussion :topic-id="realTopicId" />
            </div>
          </div>

          <div class="mt-12 text-center">
            <RouterLink to="/topics" class="vt-btn vt-btn-outline !border-gray-300 !text-gray-900">
              {{ t('topics.detail.backToList') }}
            </RouterLink>
          </div>
        </div>
      </div>
    </section>
  </div>

  <div v-else-if="!loading" class="py-16">
    <div class="mx-auto px-4 text-center">
      <h1 class="mb-4 text-4xl font-bold">{{ t('topics.detail.notFound') }}</h1>
      <p class="mb-8 text-lg text-gray-600">{{ t('topics.detail.notFound') }}</p>
      <RouterLink to="/topics" class="vt-btn vt-btn-primary">{{ t('topics.detail.backToList') }}</RouterLink>
    </div>
  </div>

  <div v-else class="py-16">
    <div class="mx-auto px-4 text-center">
      <div class="mx-auto h-16 w-16 animate-spin rounded-full border-b-2 border-jade-green" />
      <p class="mt-4 text-gray-600">{{ t('topics.list.loading') }}</p>
    </div>
  </div>
</template>
