<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import IconWrapper from '../components/IconWrapper.vue'
import TopicProgress from '../components/TopicProgress.vue'
import TopicSlide from '../components/TopicSlide.vue'
import TopicTimeline from '../components/TopicTimeline.vue'
import TopicDiscussion from '../components/TopicDiscussion.vue'
import discourseApi, { type FormattedTopicData } from '../lib/discourse'

const route = useRoute()
const { t } = useI18n()

const topic = ref<FormattedTopicData | null>(null)
const loading = ref(true)
const activeTab = ref<'timeline' | 'discussion'>('timeline')
const realTopicId = ref<number | null>(null)

const topicId = computed(() => String(route.params.id ?? ''))

const showDiscussionButton = computed(() => {
  if (!topic.value?.status) return false
  return ['意見徵集', '研擬草案'].includes(topic.value.status)
})

const showDiscussionTab = computed(() => showDiscussionButton.value)

const loadTopic = async () => {
  try {
    loading.value = true
    const allTopics = await discourseApi.getAllTopics()

    const targetTopic = allTopics.find((item) => {
      const routeName = item.title.split(' ')[1]
      return routeName === topicId.value
    })

    if (!targetTopic) {
      topic.value = null
      return
    }

    realTopicId.value = targetTopic.id
    const topicData = await discourseApi.getTopic(targetTopic.id)
    topic.value = discourseApi.formatTopicData(topicData)

    if (route.hash === '#discussion' && showDiscussionButton.value) {
      activeTab.value = 'discussion'
    } else {
      activeTab.value = 'timeline'
    }
  } catch (error) {
    console.error('Error loading topic:', error)
    topic.value = null
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  loadTopic()
})
</script>

<template>
  <div v-if="topic">
    <TopicProgress v-if="realTopicId" :topic-id="realTopicId" />

    <section class="py-8">
      <div class="container mx-auto px-4">
        <div class="mx-auto max-w-4xl text-center">
          <h1 class="mb-4 text-4xl font-bold md:text-5xl">{{ topic.title }}</h1>
        </div>
      </div>
    </section>

    <TopicSlide v-if="realTopicId" :topic-id="realTopicId" :show-discussion-button="showDiscussionButton" />

    <section class="py-16">
      <div class="container mx-auto px-4">
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
    <div class="container mx-auto px-4 text-center">
      <h1 class="mb-4 text-4xl font-bold">{{ t('topics.detail.notFound') }}</h1>
      <p class="mb-8 text-lg text-gray-600">{{ t('topics.detail.notFound') }}</p>
      <RouterLink to="/topics" class="vt-btn vt-btn-primary">{{ t('topics.detail.backToList') }}</RouterLink>
    </div>
  </div>

  <div v-else class="py-16">
    <div class="container mx-auto px-4 text-center">
      <div class="mx-auto h-16 w-16 animate-spin rounded-full border-b-2 border-jade-green" />
      <p class="mt-4 text-gray-600">{{ t('topics.list.loading') }}</p>
    </div>
  </div>
</template>
