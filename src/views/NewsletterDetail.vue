<template>
  <div class="container mx-auto px-4 py-8">
    <div v-if="loading" class="py-10 text-center text-gray-600">
      {{ t('newsletter.loading') }}
    </div>

    <div v-else-if="error" class="rounded-xl border border-red-200 bg-red-50 p-6 text-center">
      <p class="text-red-700">{{ error }}</p>
      <RouterLink to="/newsletters" class="mt-4 inline-flex text-sm font-medium text-democratic-red hover:underline">
        {{ t('newsletter.backToList') }}
      </RouterLink>
    </div>

    <article v-else-if="newsletter" class="mx-auto max-w-4xl">
      <RouterLink to="/newsletters" class="mb-6 inline-flex text-sm font-medium text-democratic-red hover:underline">
        {{ t('newsletter.backToList') }}
      </RouterLink>

      <img v-if="newsletter.coverImage" :src="newsletter.coverImage" :alt="newsletter.title" class="mb-8 h-auto w-full rounded-2xl object-cover" />

      <header class="mb-8 border-b border-gray-200 pb-6">
        <p class="mb-3 text-sm text-gray-500">
          <span v-if="newsletter.author">{{ newsletter.author }} · </span>{{ formatDate(newsletter.pubDate) }}
        </p>
        <h1 class="mb-4 text-3xl font-bold text-gray-900 md:text-4xl">{{ newsletter.title }}</h1>
        <a :href="newsletter.link" target="_blank" rel="noopener noreferrer" class="text-sm font-medium text-democratic-red hover:underline">
          {{ t('newsletter.viewOriginal') }}
        </a>
      </header>

      <div class="newsletter-content prose prose-lg max-w-none" v-html="sanitizedContent"></div>

      <footer class="mt-10 border-t border-gray-200 pt-6">
        <RouterLink to="/newsletters" class="inline-flex text-sm font-medium text-democratic-red hover:underline">
          {{ t('newsletter.backToList') }}
        </RouterLink>
      </footer>
    </article>

    <div v-else class="rounded-xl border border-gray-200 bg-gray-50 p-6 text-center text-gray-700">
      {{ t('newsletter.notFound') }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { getNewsletterBySlug, sanitizeNewsletterHtml, type NewsletterItem } from '../lib/newsletters'

const route = useRoute()
const { locale, t } = useI18n()

const newsletter = ref<NewsletterItem | null>(null)
const loading = ref(false)
const error = ref('')

const formatDate = (dateString: string) => {
  if (!dateString) return ''
  const date = new Date(dateString)
  if (Number.isNaN(date.getTime())) return dateString
  return date.toLocaleDateString(locale.value, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

const sanitizedContent = computed(() => {
  const content = newsletter.value?.contentHtml || `<p>${newsletter.value?.description || ''}</p>`
  return sanitizeNewsletterHtml(content)
})

const loadNewsletter = async () => {
  const slug = typeof route.params.slug === 'string' ? route.params.slug : ''
  if (!slug) {
    error.value = t('newsletter.notFound')
    return
  }

  loading.value = true
  error.value = ''
  try {
    newsletter.value = await getNewsletterBySlug(slug)
    if (!newsletter.value) {
      error.value = t('newsletter.notFound')
    }
  } catch (err) {
    console.error('載入電子報內容失敗', err)
    error.value = t('newsletter.fetchError')
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  loadNewsletter()
})

watch(() => route.params.slug, loadNewsletter)
</script>

<style scoped>
.newsletter-content :deep(.subscription-widget-wrap-editor),
.newsletter-content :deep(.subscription-widget),
.newsletter-content :deep(form) {
  display: none;
}
.newsletter-content :deep(img) {
  height: auto;
  max-width: 100%;
  border-radius: var(--radius-vt-xl);
}
.newsletter-content :deep(p),
.newsletter-content :deep(ul),
.newsletter-content :deep(ol),
.newsletter-content :deep(blockquote),
.newsletter-content :deep(.captioned-image-container),
.newsletter-content :deep(figure),
.newsletter-content :deep(h1),
.newsletter-content :deep(h2),
.newsletter-content :deep(h3),
.newsletter-content :deep(h4) {
  margin-top: var(--spacing-vt-6);
  margin-bottom: var(--spacing-vt-6);
}
.newsletter-content :deep(li) {
  margin-top: var(--spacing-vt-2);
  margin-bottom: var(--spacing-vt-2);
}
.newsletter-content :deep(h1),
.newsletter-content :deep(h2),
.newsletter-content :deep(h3),
.newsletter-content :deep(h4) {
  font-weight: var(--font-weight-vt-bold);
  line-height: var(--leading-vt-tight);
}
.newsletter-content :deep(h1) {
  font-size: var(--text-vt-2xl);
  line-height: var(--text-vt-2xl--line-height);
}
.newsletter-content :deep(h2) {
  font-size: var(--text-vt-xl);
  line-height: var(--text-vt-xl--line-height);
}
.newsletter-content :deep(h3) {
  font-size: var(--text-vt-lg);
  line-height: var(--text-vt-lg--line-height);
}
.newsletter-content :deep(h4) {
  font-size: var(--text-vt-lg);
  line-height: var(--text-vt-lg--line-height);
}
@media (min-width: 48rem) {
  .newsletter-content :deep(h1) {
    font-size: var(--text-vt-3xl);
    line-height: var(--text-vt-3xl--line-height);
  }
  .newsletter-content :deep(h2) {
    font-size: var(--text-vt-2xl);
    line-height: var(--text-vt-2xl--line-height);
  }
  .newsletter-content :deep(h3),
  .newsletter-content :deep(h4) {
    font-size: var(--text-vt-xl);
    line-height: var(--text-vt-xl--line-height);
  }
}
.newsletter-content :deep(a) {
  color: var(--color-democratic-red);
  text-decoration-line: underline;
  text-underline-offset: var(--spacing-vt-0_5);
}
.newsletter-content :deep(iframe) {
  max-width: 100%;
}
.newsletter-content :deep(hr) {
  margin-top: var(--spacing-vt-8);
  margin-bottom: var(--spacing-vt-8);
}
</style>
