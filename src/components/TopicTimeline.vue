<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import IconWrapper from './IconWrapper.vue'
import ParticipationLink from './ParticipationLink.vue'
import discourseApi from '../lib/discourse'

const props = defineProps<{
  topicId: string | number
}>()

const { t } = useI18n()

interface TimelineItem {
  title: string
  start: string
  end: string | null
  info: string
  link: string[]
}

const timeline = ref<TimelineItem[]>([])
const loading = ref(true)

const timelineTitle = computed(() => [t('topics.timeline.columns.time'), t('topics.timeline.columns.stage'), t('topics.timeline.columns.links')])

const plinkList = computed(() => [
  {
    icon: 'link',
    title: t('topics.timeline.linkTypes.related'),
    desc: t('topics.timeline.linkTypes.relatedDesc'),
  },
  {
    icon: 'edit',
    title: t('topics.timeline.linkTypes.hackpad'),
    desc: t('topics.timeline.linkTypes.hackpadDesc'),
  },
  {
    icon: 'book',
    title: t('topics.timeline.linkTypes.record'),
    desc: t('topics.timeline.linkTypes.recordDesc'),
  },
  {
    icon: 'play',
    title: t('topics.timeline.linkTypes.live'),
    desc: t('topics.timeline.linkTypes.liveDesc'),
  },
  {
    icon: 'users',
    title: t('topics.timeline.linkTypes.discuss'),
    desc: t('topics.timeline.linkTypes.discussDesc'),
  },
  {
    icon: 'message-circle',
    title: t('topics.timeline.linkTypes.comment'),
    desc: t('topics.timeline.linkTypes.commentDesc'),
  },
])

const parseTimelinePost = (raw: string): TimelineItem | null => {
  try {
    const regex = /(?: (?:init )?)|\n/g
    const dateRegex = /^\d{4}-(0?[1-9]|1[012])-(0?[1-9]|[12][0-9]|3[01])$/
    const timeRegex = /^(2[0-3]|1[0-9]|0[0-9]|[^0-9][0-9]):([0-5][0-9]|[0-9]):([0-5][0-9]|[0-9])$/

    const comment = raw.split(regex)
    const links: string[] = []

    if (comment.length < 2) return null

    const timelineContent: TimelineItem = {
      title: comment[0],
      start: comment[1],
      end: null,
      info: '',
      link: [],
    }

    if (comment[2] && dateRegex.test(comment[2])) {
      timelineContent.end = comment[2]
    } else if (comment[2] && timeRegex.test(comment[2])) {
      timelineContent.start += ' ' + comment[2]
    }

    comment.slice(1).forEach(item => {
      if (item && item.indexOf('http') > -1) {
        links.push(item)
      } else if (item && !dateRegex.test(item) && !timeRegex.test(item) && item.trim() !== '') {
        if (!timelineContent.info) {
          timelineContent.info = item
        }
      }
    })

    timelineContent.link = links
    return timelineContent.title ? timelineContent : null
  } catch (error) {
    console.error('Error parsing timeline post:', error)
    return null
  }
}

const loadTimeline = async () => {
  try {
    loading.value = true
    const topicData = await discourseApi.getTopic(props.topicId)
    const posts = topicData.post_stream.posts.slice(1)
    const timelineItems: TimelineItem[] = []

    posts.forEach(post => {
      const item = parseTimelinePost(post.raw)
      if (item) timelineItems.push(item)
    })

    timeline.value = timelineItems.sort((a, b) => new Date(b.start).getTime() - new Date(a.start).getTime())
  } catch (error) {
    console.error('Error loading timeline:', error)
    timeline.value = []
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  loadTimeline()
})
</script>

<template>
  <div class="topic-timeline overflow-x-auto">
    <div v-if="loading" class="py-8 text-center">
      <div class="mx-auto h-8 w-8 animate-spin rounded-full border-b-2 border-jade-green" />
      <p class="mt-2 text-gray-600">{{ t('topics.timeline.loading') }}</p>
    </div>

    <div v-else-if="timeline.length > 0">
      <table class="w-full border-collapse bg-vt-bg-1">
        <thead>
          <tr class="bg-vt-bg-2 text-left">
            <th v-for="title in timelineTitle" :key="title" class="border-b border-vt-border px-vt-4 py-vt-3">
              <h3 class="text-vt-sm font-bold text-vt-fg-2">{{ title }}</h3>
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(item, index) in timeline" :key="index" class="border-b border-vt-border last:border-b-0">
            <td class="px-vt-4 py-vt-6 align-top text-vt-base text-vt-fg-2">
              <div class="flex flex-col items-center md:flex-row md:gap-6">
                <span class="whitespace-nowrap">{{ item.start }}</span>
                <span v-if="item.end" class="my-vt-2 self-center md:my-0 md:self-auto" aria-hidden="true">
                  <IconWrapper name="chevron-down" :size="16" color="var(--color-vt-gray-400)" class="md:hidden" />
                  <IconWrapper name="arrow-right" :size="16" color="var(--color-vt-gray-400)" class="hidden md:block" />
                </span>
                <span v-if="item.end" class="whitespace-nowrap">{{ item.end }}</span>
              </div>
            </td>

            <td class="px-vt-4 py-vt-6 align-top">
              <div class="block md:hidden">
                <span class="stage-label inline-block rounded-vt-full bg-vt-bg-2 px-vt-3 py-vt-1 text-vt-sm text-vt-fg-2">
                  {{ item.title }}
                </span>
              </div>
              <div class="hidden md:block">
                <span class="stage-label inline-block rounded-vt-full border border-vt-border bg-vt-bg-2 px-vt-3 py-vt-1 text-vt-sm text-vt-fg-2">
                  {{ item.title }}
                </span>
              </div>
              <h4 v-if="item.info" class="mt-vt-2 text-vt-base font-medium text-vt-fg-1">
                {{ item.info }}
              </h4>
            </td>

            <td class="px-vt-4 py-vt-6 align-top">
              <ParticipationLink :urllink="item.link" />
            </td>
          </tr>
        </tbody>
      </table>

      <div class="border-t border-vt-border px-vt-4 py-vt-6">
        <h3 class="mb-vt-3 text-vt-sm font-bold text-vt-fg-2">
          {{ t('topics.timeline.externalLinksTitle') }}
        </h3>
        <div class="grid grid-cols-1 gap-vt-2 md:grid-cols-2 lg:grid-cols-3">
          <div v-for="link in plinkList" :key="link.title" class="flex items-start gap-vt-2 text-vt-sm">
            <IconWrapper :name="link.icon" :size="18" type="teal" />
            <div>
              <h5 class="inline font-bold text-vt-fg-1">{{ link.title }}</h5>
              <p class="ml-vt-2 inline text-vt-fg-3">{{ link.desc }}</p>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div v-else class="py-8 text-center">
      <IconWrapper name="calendar" :size="48" color="#9CA3AF" class="mx-auto mb-4" />
      <p class="text-gray-500">{{ t('topics.detail.noTimeline') }}</p>
    </div>
  </div>
</template>

<style scoped>
.stage-label {
  white-space: nowrap;
}

@media (max-width: 47.999rem) {
  .topic-timeline th:nth-child(2),
  .topic-timeline td:nth-child(2) {
    padding-inline: var(--spacing-vt-2);
  }

  .stage-label {
    padding-inline: var(--spacing-vt-2);
    padding-block: var(--spacing-vt-0_5);
  }
}

@media (min-width: 48rem) {
  .topic-timeline th:first-child,
  .topic-timeline td:first-child,
  .topic-timeline th:last-child,
  .topic-timeline td:last-child {
    width: 1%;
    white-space: nowrap;
  }
}
</style>
