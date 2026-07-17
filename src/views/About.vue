<script setup lang="ts">
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

// 我們的價值 — 對應三種公民色
const values = [
  { key: 'open', tint: 'bg-democratic-red/10', color: 'text-democratic-red' },
  { key: 'collaborate', tint: 'bg-jade-green/10', color: 'text-jade-green' },
  { key: 'coCreate', tint: 'bg-wheat-yellow/10', color: 'text-wheat-yellow' },
]
</script>

<template>
  <main class="font-serif">
    <!-- 標題 -->
    <section class="vt-under-navbar bg-vt-gray-800 pt-26 pb-16 sm:pt-36 sm:pb-20">
      <div class="mx-auto max-w-4xl px-6">
        <h1 class="text-center text-4xl font-bold text-white sm:text-5xl">
          <span class="vt-title-underline">{{ t('about.title') }}</span>
        </h1>
      </div>
    </section>

    <div class="mx-auto max-w-4xl px-6 py-16">
      <!-- 使命 -->
      <h2 class="mb-4 text-2xl font-bold sm:text-3xl">{{ t('about.mission.title') }}</h2>
      <p class="mb-14 text-lg leading-relaxed text-vt-gray-700">
        {{ t('about.mission.description') }}
      </p>

      <!-- 我們的價值 -->
      <h2 class="mb-8 text-2xl font-bold sm:text-3xl">{{ t('about.values.title') }}</h2>
      <div class="mb-16 grid gap-8 md:grid-cols-3">
        <div v-for="v in values" :key="v.key" class="text-center">
          <div class="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full" :class="v.tint">
            <svg :class="v.color" width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <template v-if="v.key === 'open'">
                <circle cx="12" cy="12" r="10" />
                <path d="M2 12h20M12 2a15 15 0 0 1 0 20M12 2a15 15 0 0 0 0 20" />
              </template>
              <template v-else-if="v.key === 'collaborate'">
                <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
              </template>
              <template v-else>
                <path d="M9 18h6M10 22h4M12 2A7 7 0 0 0 8 14.7c.6.5 1 1.3 1 2.1v.2h6v-.2c0-.8.4-1.6 1-2.1A7 7 0 0 0 12 2z" />
              </template>
            </svg>
          </div>
          <h3 class="mb-2 text-xl font-bold">{{ t(`about.values.${v.key}.title`) }}</h3>
          <p class="text-vt-gray-700">{{ t(`about.values.${v.key}.description`) }}</p>
        </div>
      </div>

      <!-- 電子報 -->
      <h2 class="mb-4 text-2xl font-bold sm:text-3xl">{{ t('about.newsletter.title') }}</h2>
      <p class="mb-14 text-lg leading-relaxed text-vt-gray-700">
        {{ t('about.newsletter.description') }}
        <RouterLink to="/newsletters" class="font-medium text-democratic-red hover:underline">{{ t('about.newsletter.button') }}</RouterLink>
      </p>

      <!-- 聯絡我們 -->
      <h2 class="mb-4 text-2xl font-bold sm:text-3xl">{{ t('about.contact.title') }}</h2>
      <p class="mb-5 text-lg leading-relaxed text-vt-gray-700">
        {{ t('about.contact.description') }}
        <RouterLink to="/contact" class="font-medium text-democratic-red hover:underline">{{ t('about.contact.contactUs') }}</RouterLink>
      </p>
      <ul class="space-y-3">
        <li>
          <a href="mailto:info@vtaiwan.tw" class="inline-flex items-center gap-2.5 text-democratic-red transition-colors hover:underline">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <rect x="2" y="4" width="20" height="16" rx="2" />
              <path d="m22 7-10 5L2 7" />
            </svg>
            info@vtaiwan.tw
          </a>
        </li>
        <li>
          <a href="https://www.facebook.com/vtaiwan.tw/" target="_blank" rel="noopener noreferrer" class="inline-flex items-center gap-2.5 text-democratic-red transition-colors hover:underline">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M9 8h-3v4h3v12h5v-12h3.642l.358-4h-4v-1.667c0-.955.192-1.333 1.115-1.333h2.885v-5h-3.808c-3.596 0-5.192 1.583-5.192 4.615v3.385z" />
            </svg>
            {{ t('about.contact.facebook') }}
          </a>
        </li>
      </ul>
    </div>
  </main>
</template>
