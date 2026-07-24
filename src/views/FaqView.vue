<template>
  <main class="vt-under-navbar bg-[#f1f2f4] pt-20">
    <div class="mx-auto max-w-3xl px-4 py-12">
      <h3 class="mb-2 font-sans text-xs text-zinc-500">FAQ</h3>
      <h1 class="mb-4 w-fit border-b-2 border-democratic-red py-2 text-4xl font-bold">{{ t('faq.title') }}</h1>
      <p class="mb-6">{{ t('faq.description') }}</p>

      <div
        class="overflow-hidden rounded-3xl"
        style="
          box-shadow:
            rgba(255, 255, 255, 0.95) 0 1px 0 inset,
            rgba(16, 24, 40, 0.12) 0 10px 28px -12px;
        "
      >
        <article
          v-for="faq in faqs"
          :key="faq.id"
          class="relative overflow-hidden bg-white before:absolute before:top-0 before:right-vt-6 before:left-vt-6 before:h-px before:bg-vt-border first:before:hidden"
        >
          <button
            type="button"
            class="flex w-full cursor-pointer items-center p-6 text-left text-lg font-bold outline-none"
            :aria-controls="`faq-answer-${faq.id}`"
            :aria-expanded="expandedFaqId === faq.id"
            @click="toggleFaq(faq.id)"
          >
            <span class="mr-auto">{{ faq.question[currentLocale] }}</span>
            <div class="grid h-6 w-6 place-items-center rounded-full bg-[#f6e6e8] transition-transform duration-200 ease-out" :class="{ 'rotate-45': expandedFaqId === faq.id }">
              <IconWrapper name="plus" :size="16" class="stroke-democratic-red" />
            </div>
          </button>

          <div v-if="expandedFaqId === faq.id" :id="`faq-answer-${faq.id}`" class="px-6 pb-6">
            <!-- 答案含站方維護的 HTML 連結，來源為靜態資料 -->
            <p class="faq-answer text-gray-700" v-html="sanitizeUntrustedHtml(faq.answer[currentLocale])"></p>
            <ol v-if="faq.details" class="mt-2 list-decimal space-y-1 pl-6">
              <li v-for="detail in faq.details[currentLocale]" :key="detail" class="text-gray-700">
                {{ detail }}
              </li>
            </ol>
          </div>
        </article>
      </div>
    </div>
  </main>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { faqs, type Locale } from '../data/faqs'
import { sanitizeUntrustedHtml } from '../lib/html-sanitizer'
import IconWrapper from '../components/IconWrapper.vue'

const { t, locale } = useI18n()

// 收斂為資料檔支援的語言鍵（供 question/answer/details 索引）
const currentLocale = computed<Locale>(() => locale.value as Locale)
const expandedFaqId = ref<string | null>(null)

function toggleFaq(faqId: string) {
  expandedFaqId.value = expandedFaqId.value === faqId ? null : faqId
}
</script>

<style scoped>
.faq-answer {
  line-height: 1.75;
}
/* FAQ 答案（v-html）中的超連結樣式 */
.faq-answer :deep(a) {
  color: var(--color-democratic-red);
  text-decoration-line: underline;
}
.faq-answer :deep(a:hover) {
  opacity: 0.8;
}
</style>
