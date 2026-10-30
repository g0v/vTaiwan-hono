<script setup lang="ts">
import { computed, ref, onMounted, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import IconWrapper from './IconWrapper.vue'
import discourseApi from '../lib/discourse'
import { sanitizeEmbedHtml, sanitizeUntrustedHtml } from '../lib/html-sanitizer'

const props = defineProps<{
  topicId: string | number
  showDiscussionButton?: boolean
}>()

const { t } = useI18n()

const slide = ref({
  iframe: '',
  info: '',
})
const sanitizedSlide = computed(() => ({
  iframe: sanitizeEmbedHtml(slide.value.iframe, ['docs.google.com']),
  info: sanitizeUntrustedHtml(slide.value.info),
}))

function buildGoogleSlidesIframe(content: string): string {
  if (typeof document === 'undefined') return ''

  const match = content.match(/https:\/\/docs\.google\.com\/presentation\/d\/([a-zA-Z0-9_-]+)\/[^\s<"]*/i)
  if (!match) return ''

  const [, presentationId] = match
  const slideMatch = match[0].match(/[?#&]slide=([^&#\s<"]+)/i)
  const embedUrl = new URL(`https://docs.google.com/presentation/d/${presentationId}/embed`)
  embedUrl.searchParams.set('start', 'false')
  embedUrl.searchParams.set('loop', 'false')
  embedUrl.searchParams.set('delayms', '3000')

  if (slideMatch) {
    embedUrl.searchParams.set('slide', decodeURIComponent(slideMatch[1]))
  }

  const iframeElement = document.createElement('iframe')
  iframeElement.src = embedUrl.toString()
  iframeElement.allowFullscreen = true
  iframeElement.loading = 'lazy'
  iframeElement.referrerPolicy = 'no-referrer-when-downgrade'
  iframeElement.title = 'Google Slides'
  return iframeElement.outerHTML
}

const loadSlide = async () => {
  if (typeof window === 'undefined') return

  try {
    if (!props.topicId) return

    slide.value = { iframe: '', info: '' }

    const response = await discourseApi.getTopic(props.topicId)

    if (response?.post_stream?.posts.length > 0) {
      const firstPost = response.post_stream.posts[0]
      const raw = firstPost.raw || ''
      const cooked = firstPost.cooked || ''

      const parser = new DOMParser()
      const doc = parser.parseFromString(cooked, 'text/html')
      const iframeElement = doc.querySelector('iframe')

      if (iframeElement) {
        iframeElement.setAttribute('allowfullscreen', 'true')
        slide.value.iframe = iframeElement.outerHTML
      } else {
        slide.value.iframe = buildGoogleSlidesIframe(`${raw}\n${cooked}`)
      }

      const parts = cooked.split('<hr>')
      if (parts.length > 1) {
        let info = parts[1]
        info = info.replace(/<iframe.*?slideshare.*?<\/iframe>/gi, '')
        info = info.replace(/<p>\s*<a[^>]+href="https:\/\/docs\.google\.com\/presentation\/d\/[^"]+"[^>]*>.*?<\/a>\s*<\/p>/gi, '')
        slide.value.info = info
      }
    }
  } catch (error) {
    console.error('Error loading slide:', error)
  }
}

onMounted(() => {
  loadSlide()
})

watch(
  () => props.topicId,
  () => {
    loadSlide()
  }
)
</script>

<template>
  <div class="topic-slide">
    <div class="px-vt-4">
      <div class="mx-auto max-w-5xl">
        <h2 class="mb-vt-4 flex items-center justify-center gap-vt-2 font-vt-serif text-vt-xl font-bold">
          <IconWrapper name="info" :size="20" type="primary" />
          {{ t('topics.detail.introduction') }}
        </h2>

        <div class="grid gap-vt-4 lg:grid-cols-2">
          <div class="min-w-0 rounded-vt-2xl bg-vt-bg-1" :class="sanitizedSlide.iframe ? 'p-vt-4 shadow-vt-lg' : 'self-start p-vt-8 text-center text-vt-fg-3'">
            <div v-if="sanitizedSlide.iframe" v-html="sanitizedSlide.iframe" class="iframe-container" />
            <div v-else>
              {{ t('topics.detail.noSlide') }}
            </div>
          </div>

          <div class="min-w-0 rounded-vt-2xl bg-vt-bg-1 p-vt-6 shadow-vt-lg">
            <div class="h-full max-h-96 overflow-auto text-vt-base leading-relaxed text-vt-fg-2">
              <div v-if="sanitizedSlide.info" v-html="sanitizedSlide.info" class="topic-slide-prose max-w-none" />
              <div v-else class="text-center text-vt-fg-3">
                {{ t('topics.detail.noInfo') }}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.iframe-container :deep(iframe) {
  width: 100%;
  min-height: 260px;
  border: none;
  border-radius: var(--radius-vt-xl);
}

.topic-slide-prose :deep(h1) {
  margin-bottom: 1rem;
  font-size: 1.5rem;
  font-weight: 700;
}

.topic-slide-prose :deep(h2) {
  margin-bottom: 0.75rem;
  font-size: 1.25rem;
  font-weight: 700;
}

.topic-slide-prose :deep(h3) {
  margin-bottom: 0.5rem;
  font-size: 1.125rem;
  font-weight: 700;
}

.topic-slide-prose :deep(p) {
  margin-bottom: 1rem;
  line-height: 1.625;
}

.topic-slide-prose :deep(ul) {
  margin-bottom: 1rem;
  list-style: disc inside;
}

.topic-slide-prose :deep(ol) {
  margin-bottom: 1rem;
  list-style: decimal inside;
}

.topic-slide-prose :deep(li) {
  margin-bottom: 0.25rem;
}

.topic-slide-prose :deep(a) {
  color: var(--color-vt-jade-green, #008888);
  text-decoration: underline;
}

.topic-slide-prose :deep(strong) {
  font-weight: 700;
}

.topic-slide-prose :deep(em) {
  font-style: italic;
}
</style>
