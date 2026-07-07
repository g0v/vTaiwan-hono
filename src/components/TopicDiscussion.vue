<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import IconWrapper from './IconWrapper.vue'
import TopicDiscussionComment from './TopicDiscussionComment.vue'
import discourseApi, { type DiscourseTopic } from '../lib/discourse'

interface UserData {
  isAdmin?: boolean
}

interface DiscourseEmbedItem {
  title: string
  id: number
}

interface DiscussionType {
  type: string
  embeder: string | DiscourseEmbedItem[]
}

const props = withDefaults(
  defineProps<{
    topicId: string | number
    userData?: UserData | null
  }>(),
  {
    userData: null,
  },
)

const { t } = useI18n()

const discussionType = ref<DiscussionType>({ type: '', embeder: '' })
const loading = ref(true)
const lastStep = ref('')

const chineseSort = (a: string, b: string): number => {
  const c2n: Record<string, string> = {
    一: '1', 二: '2', 三: '3', 四: '4', 五: '5',
    六: '6', 七: '7', 八: '8', 九: '9', 十: '10',
  }
  const chineseToNumber = (str: string) =>
    str.replace(/一|二|三|四|五|六|七|八|九|十/gi, (m) => c2n[m] || m)
  return chineseToNumber(a).localeCompare(chineseToNumber(b), 'zh-TW', { numeric: true })
}

const processDiscussionType = async (topicData: DiscourseTopic) => {
  try {
    const posts = topicData.post_stream.posts.slice(1)
    let rawlinks: string[] = []

    for (const post of posts) {
      lastStep.value = post.raw.split(/\s/, 1)[0]
      if (lastStep.value === '意見徵集' || lastStep.value === '研擬草案') {
        rawlinks = post.raw.split(/\s/)
      }
    }

    const httpLinks = rawlinks.filter((link) => link.indexOf('http') > -1)
    if (httpLinks.length === 0) {
      discussionType.value = { type: '', embeder: '' }
      return
    }

    const link = httpLinks[httpLinks.length - 1]

    if (link.indexOf('pol.is') > -1) {
      discussionType.value = {
        type: 'polis',
        embeder: `<iframe src="${link}" frameborder="0" width="100%" height="1000px"></iframe>`,
      }
    } else if (link.indexOf('sli.do') > -1) {
      discussionType.value = {
        type: 'slido',
        embeder: `<iframe src="${link}" frameborder="0" width="100%" height="1000px"></iframe>`,
      }
    } else if (link.indexOf('livehouse') > -1) {
      const embedUrl = link.replace('livehouse.in/', 'livehouse.in/embed/')
      discussionType.value = {
        type: 'livehouse',
        embeder: `<iframe width="100%" height="1000px" src="${embedUrl}" frameborder="0" allowfullscreen></iframe>`,
      }
    } else if (link.indexOf('talk.vtaiwan.tw') > -1) {
      const categoryUrl = link.replace(/(.*)\/$/, '$1')
      try {
        const topics = await discourseApi.getAllCategoryTopics(categoryUrl + '.json')
        const sortedTopics = topics.sort((a, b) => chineseSort(a.title, b.title))
        discussionType.value = {
          type: 'discourse',
          embeder: sortedTopics
            .filter((topic) => topic.id && topic.title)
            .map((topic) => ({ title: topic.title, id: topic.id })),
        }
      } catch (error) {
        console.error('Error loading discourse category topics:', error)
        discussionType.value = { type: '', embeder: '' }
      }
    } else if (link.indexOf('typeform') > -1) {
      const formUrl = link.replace(/.*\((.*)\)/, '$1')
      discussionType.value = {
        type: 'typeform',
        embeder: `<iframe src="${formUrl}" frameborder="0" width="100%" height="1000px"></iframe>`,
      }
    } else if (link.indexOf('hackpad') > -1) {
      discussionType.value = {
        type: 'hackpad',
        embeder: `Hackpad 已遷移至 Dropbox Paper。請使用 <a href="${link}" target="_blank" rel="noopener noreferrer">外部連結</a> 查看。`,
      }
    } else if (/.*\.jpg/.test(link)) {
      const imageUrl = link.replace(/.*\((.*)\)/, '$1')
      discussionType.value = {
        type: 'img',
        embeder: `<img src="${imageUrl}" alt="議題圖片" class="max-w-full h-auto rounded-lg shadow-md" />`,
      }
    } else {
      let linkText = link
      let linkUrl = link
      const markdownMatch = /^\[(.*?)\]\((.*)\)/.exec(link)
      if (markdownMatch) {
        linkText = markdownMatch[1]
        linkUrl = markdownMatch[2]
      }
      discussionType.value = {
        type: 'default',
        embeder: `請查看 <a href="${linkUrl}" target="_blank" rel="noopener noreferrer" class="text-jade-green hover:text-jade-green/80">${linkText}</a>`,
      }
    }
  } catch (error) {
    console.error('Error processing discussion type:', error)
    discussionType.value = { type: '', embeder: '' }
  }
}

const getEmbededTitle = (type: string): string => {
  const titleMap: Record<string, string> = {
    polis: 'Polis 意見調查',
    slido: 'Slido 互動問答',
    livehouse: 'Livehouse 直播',
    typeform: 'Typeform 表單',
    hackpad: 'Hackpad 文件',
    img: '相關圖片',
  }
  return titleMap[type] || '外部資源'
}

const loadDiscussion = async () => {
  try {
    loading.value = true
    const topicData = await discourseApi.getTopic(props.topicId)
    await processDiscussionType(topicData)
  } catch (error) {
    console.error('Error loading discussion:', error)
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  loadDiscussion()
})
</script>

<template>
  <div class="topic-discussion">
    <div v-if="loading" class="py-8 text-center">
      <div class="mx-auto h-8 w-8 animate-spin rounded-full border-b-2 border-jade-green" />
      <p class="mt-2 text-gray-600">{{ t('topics.detail.loading') }}</p>
    </div>

    <div v-else-if="discussionType.type">
      <div v-if="discussionType.type === 'discourse'" class="space-y-6">
        <div
          v-for="(disc, index) in discussionType.embeder as DiscourseEmbedItem[]"
          :key="index"
          class="rounded-lg border border-gray-200 bg-white shadow-xs"
        >
          <div class="border-b border-gray-200 p-4">
            <h3 class="flex cursor-pointer items-center text-lg font-semibold">
              <IconWrapper name="message-circle" :size="20" class="mr-2" />
              {{ disc.title }}
            </h3>
          </div>
          <div class="p-4">
            <TopicDiscussionComment v-if="disc.id" :comment-id="disc.id" :slice="false" />
            <div v-else class="py-4 text-center text-gray-500">
              {{ t('topics.detail.loading') }}
            </div>
          </div>
        </div>
      </div>

      <div v-else-if="discussionType.embeder && typeof discussionType.embeder === 'string'" class="embedded-content">
        <div class="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-xs">
          <div class="border-b border-gray-200 p-4">
            <h3 class="flex items-center text-lg font-semibold">
              <IconWrapper name="external-link" :size="20" class="mr-2" />
              {{ getEmbededTitle(discussionType.type) }}
            </h3>
          </div>
          <div class="p-4">
            <div v-html="discussionType.embeder" />
          </div>
        </div>
      </div>
    </div>

    <div v-else class="py-8 text-center">
      <IconWrapper name="message-circle" :size="48" color="#9CA3AF" class="mx-auto mb-4" />
      <p class="text-gray-500">{{ t('topics.detail.noDiscussion') }}</p>
    </div>

    <div class="mt-8 text-center">
      <a
        v-if="userData?.isAdmin"
        :href="`https://talk.vtaiwan.tw/t/topic/${props.topicId}`"
        target="_blank"
        rel="noopener noreferrer"
        class="vt-btn vt-btn-primary inline-flex items-center"
      >
        <IconWrapper name="message-circle" :size="20" class="mr-2" />
        {{ t('topics.detail.participate') }}
      </a>
    </div>
  </div>
</template>

<style scoped>
.embedded-content :deep(iframe) {
  border: none;
  border-radius: 0.5rem;
  width: 100%;
  min-height: 500px;
}

.embedded-content :deep(img) {
  max-width: 100%;
  height: auto;
  border-radius: 0.5rem;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
}

:deep(a) {
  color: #40b3bf;
  text-decoration: underline;
}

:deep(a:hover) {
  color: #369aa3;
}
</style>
