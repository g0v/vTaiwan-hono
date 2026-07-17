<template>
  <main class="mt-[-86px] bg-vt-gray-800 pt-20 text-white sm:mt-[-90px]">
    <div class="mx-auto max-w-3xl py-12">
      <h1 class="sticky top-[80px] z-10 mb-8 bg-vt-gray-800 p-2 text-4xl font-bold sm:top-[88px]">{{ t('faq.title') }}</h1>

      <section class="mb-12">
        <p class="mb-6 leading-relaxed">{{ t('faq.description') }}</p>

        <div class="space-y-6">
          <div v-for="faq in faqs" :key="faq.id" class="overflow-hidden rounded-lg border border-vt-border bg-white p-6 shadow-xs transition hover:shadow-md">
            <h3 class="mb-2 text-xl font-bold text-democratic-red">
              {{ faq.question[currentLocale] }}
            </h3>
            <!-- 答案含站方維護的 HTML 連結，來源為靜態資料 -->
            <p class="faq-answer text-gray-700" v-html="faq.answer[currentLocale]"></p>
            <ol v-if="faq.details" class="mt-2 list-decimal space-y-1 pl-6">
              <li v-for="detail in faq.details[currentLocale]" :key="detail" class="text-gray-700">
                {{ detail }}
              </li>
            </ol>
          </div>
        </div>
      </section>

      <section class="mt-12 border-t border-vt-border pt-12">
        <h2 class="mb-6 text-3xl font-bold">{{ t('faq.contact.title') }}</h2>
        <p class="mb-8">{{ t('faq.contact.description') }}</p>

        <div class="grid gap-6 md:grid-cols-2">
          <div class="rounded-lg bg-vt-gray-100 p-6 text-black">
            <h3 class="mb-4 text-xl font-semibold">{{ t('faq.contact.email.title') }}</h3>
            <p class="flex items-center">
              <svg xmlns="http://www.w3.org/2000/svg" class="mr-2 h-5 w-5 text-democratic-red" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              <a href="mailto:info@vtaiwan.tw" class="transition hover:text-democratic-red">info@vtaiwan.tw</a>
            </p>
          </div>

          <div class="rounded-lg bg-vt-gray-100 p-6 text-black">
            <h3 class="mb-4 text-xl font-semibold">{{ t('faq.contact.social.title') }}</h3>
            <div class="space-y-2">
              <p class="flex items-center">
                <svg xmlns="http://www.w3.org/2000/svg" class="mr-2 h-5 w-5 text-democratic-red" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                </svg>
                <a href="https://x.com/v_taiwan" target="_blank" rel="noopener noreferrer" class="transition hover:text-democratic-red">@v_taiwan</a>
              </p>
              <p class="flex items-center">
                <svg xmlns="http://www.w3.org/2000/svg" class="mr-2 h-5 w-5 text-democratic-red" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M9 8h-3v4h3v12h5v-12h3.642l.358-4h-4v-1.667c0-.955.192-1.333 1.115-1.333h2.885v-5h-3.808c-3.596 0-5.192 1.583-5.192 4.615v3.385z" />
                </svg>
                <a href="https://facebook.com/vtaiwan.tw" target="_blank" rel="noopener noreferrer" class="transition hover:text-democratic-red">vTaiwan</a>
              </p>
              <p class="flex items-center">
                <svg xmlns="http://www.w3.org/2000/svg" class="mr-2 h-5 w-5 text-democratic-red" fill="currentColor" viewBox="0 0 24 24">
                  <path
                    d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"
                  />
                </svg>
                <a href="https://www.linkedin.com/company/vtaiwan/" target="_blank" rel="noopener noreferrer" class="transition hover:text-democratic-red">vTaiwan</a>
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  </main>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { faqs, type Locale } from '../data/faqs'

const { t, locale } = useI18n()

// 收斂為資料檔支援的語言鍵（供 question/answer/details 索引）
const currentLocale = computed<Locale>(() => locale.value as Locale)
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
