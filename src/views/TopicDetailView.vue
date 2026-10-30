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
  <div class="topic-detail-page vt-under-navbar">
    <main v-if="topic" class="pb-vt-16">
      <div class="mx-auto max-w-5xl px-vt-4">
        <RouterLink to="/topics" class="mb-vt-4 inline-flex items-center gap-vt-2 text-vt-sm text-vt-fg-3 transition-colors hover:text-vt-democratic-red">
          {{ t('topics.detail.backToList') }}
        </RouterLink>
        <TopicProgress v-if="realTopicId" :topic-id="realTopicId" />
      </div>

      <section class="px-vt-4 pt-vt-12 pb-vt-8 text-center">
        <div class="mx-auto max-w-4xl">
          <span v-if="topic.tags[0]" class="inline-flex rounded-vt-full border border-vt-democratic-red/20 bg-vt-red-tint px-vt-3 py-vt-1 text-vt-xs font-bold text-vt-democratic-red">{{
            topic.tags[0]
          }}</span>
          <h1 class="mt-vt-4 font-vt-serif text-vt-4xl font-bold text-vt-fg-1 md:text-vt-5xl">{{ topic.title }}</h1>
          <p v-if="topic.slogan" class="mx-auto mt-vt-4 max-w-2xl text-vt-base text-vt-fg-2">{{ topic.slogan }}</p>
        </div>
      </section>

      <TopicSlide v-if="realTopicId" :topic-id="realTopicId" :show-discussion-button="showDiscussionButton" />

      <section class="pt-vt-8">
        <div class="mx-auto max-w-5xl px-vt-4">
          <div>
            <div class="mx-auto mb-vt-6 flex w-fit rounded-vt-full border border-vt-border bg-vt-gray-200/60 p-vt-1">
              <button
                :class="[
                  'flex items-center justify-center rounded-vt-full px-vt-6 py-vt-2 text-vt-sm font-bold transition-colors',
                  activeTab === 'timeline' ? 'bg-vt-bg-1 text-vt-democratic-red shadow-vt-sm' : 'text-vt-fg-2 hover:text-vt-fg-1',
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
                  'flex items-center justify-center rounded-vt-full px-vt-6 py-vt-2 text-vt-sm font-bold transition-colors',
                  activeTab === 'discussion' ? 'bg-vt-bg-1 text-vt-democratic-red shadow-vt-sm' : 'text-vt-fg-2 hover:text-vt-fg-1',
                ]"
                @click="activeTab = 'discussion'"
              >
                <IconWrapper name="message-circle" :size="16" class="mr-2" />
                <span class="hidden md:inline">{{ t('topics.detail.discussion') }}</span>
                <span class="md:hidden">{{ t('topics.detail.discussionShort') }}</span>
              </button>
            </div>

            <div class="tab-content overflow-hidden rounded-vt-2xl bg-vt-bg-1 shadow-vt-lg">
              <div v-if="activeTab === 'timeline' && realTopicId">
                <TopicTimeline :topic-id="realTopicId" />
              </div>
              <div v-if="activeTab === 'discussion' && realTopicId && showDiscussionTab">
                <TopicDiscussion :topic-id="realTopicId" />
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>

    <div v-else-if="!loading" class="pb-vt-16">
      <div class="mx-auto px-4 text-center">
        <h1 class="mb-4 text-4xl font-bold">{{ t('topics.detail.notFound') }}</h1>
        <p class="mb-8 text-lg text-gray-600">{{ t('topics.detail.notFound') }}</p>
        <RouterLink to="/topics" class="vt-btn vt-btn-primary">{{ t('topics.detail.backToList') }}</RouterLink>
      </div>
    </div>

    <div v-else class="pb-vt-16">
      <div class="mx-auto px-4 text-center">
        <div class="mx-auto h-16 w-16 animate-spin rounded-full border-b-2 border-jade-green" />
        <p class="mt-4 text-gray-600">{{ t('topics.list.loading') }}</p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.topic-detail-page {
  min-height: 100vh;
  padding-top: calc(var(--spacing-vt-navbar-overlap) + var(--spacing-vt-16));
  background: var(--color-vt-topic-bg);
}

@media (min-width: 40rem) {
  .topic-detail-page {
    padding-top: calc(var(--spacing-vt-navbar-overlap-sm) + var(--spacing-vt-16));
  }
}
</style>
