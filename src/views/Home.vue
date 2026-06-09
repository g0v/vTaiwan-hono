<script setup lang="ts">
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

// 「如何運作」三步驟 — 對應三種公民色；文字由 i18n 提供
const steps = [
  { key: 'propose', tint: 'bg-democratic-red/10', color: 'text-democratic-red' },
  { key: 'discuss', tint: 'bg-jade-green/10', color: 'text-jade-green' },
  { key: 'policy', tint: 'bg-wheat-yellow/10', color: 'text-wheat-yellow' },
]
</script>

<template>
  <!-- Hero -->
  <section class="vt-hero-bg -mt-[84px] text-white sm:-mt-[88px]">
    <div class="relative z-10 mx-auto max-w-5xl px-6 pb-24 pt-[156px] sm:pt-[184px]">
      <div class="mb-12 inline-flex items-center gap-3.5 font-sans text-[13px] font-semibold uppercase tracking-[0.22em] text-white/55">
        <span class="h-px w-7 bg-white/45" />
        {{ t('home.hero.eyebrow') }}
      </div>

      <h1 class="mb-9 font-bold leading-[1.1] tracking-[-0.02em] text-[clamp(2.75rem,7vw,4.75rem)]">
        <span class="text-democratic-red">{{ t('home.hero.title.open') }}</span
        >、<span class="text-jade-green">{{ t('home.hero.title.collaborate') }}</span
        >、<span class="text-wheat-yellow">{{ t('home.hero.title.coCreate') }}</span>
        <span class="mt-6 block font-normal text-white/55">{{ t('home.hero.title.taiwanFuture') }}</span>
      </h1>

      <p class="mb-12 max-w-[44ch] text-lg leading-relaxed text-white/70 sm:text-xl">
        {{ t('home.hero.subtitle') }}
      </p>

      <div class="flex flex-wrap gap-3">
        <RouterLink to="/topics" class="vt-btn vt-btn-outline">
          {{ t('home.hero.buttons.browseTopics') }}
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M5 12h14M13 5l7 7-7 7" />
          </svg>
        </RouterLink>
        <RouterLink to="/intro" class="vt-btn vt-btn-primary">{{ t('home.hero.buttons.learnMore') }}</RouterLink>
      </div>
    </div>
  </section>

  <!-- 如何運作 -->
  <section class="bg-vt-gray-100 py-16 sm:py-20">
    <div class="mx-auto max-w-6xl px-6">
      <h2 class="mb-12 text-center text-3xl font-bold sm:text-4xl">
        <span class="vt-title-underline">{{ t('home.features.title') }}</span>
      </h2>

      <div class="grid gap-8 md:grid-cols-3">
        <div
          v-for="(step, i) in steps"
          :key="step.key"
          class="rounded-lg border border-vt-gray-200 bg-white p-8 text-center shadow-md transition-transform duration-200 hover:-translate-y-1"
        >
          <div class="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full" :class="step.tint">
            <svg :class="step.color" width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path v-if="i === 0" d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z" />
              <template v-else-if="i === 1">
                <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
              </template>
              <template v-else>
                <path d="M21.8 10A10 10 0 1 1 17 3.34" />
                <path d="m9 11 3 3L22 4" />
              </template>
            </svg>
          </div>
          <h3 class="mb-3 text-xl font-bold">{{ t(`home.features.items.${step.key}.title`) }}</h3>
          <p class="text-vt-gray-700">{{ t(`home.features.items.${step.key}.description`) }}</p>
        </div>
      </div>
    </div>
  </section>

  <!-- CTA -->
  <section class="bg-ink py-16 text-center text-white sm:py-20">
    <div class="mx-auto max-w-3xl px-6">
      <h2 class="mb-6 text-3xl font-bold sm:text-4xl">{{ t('home.cta.title') }}</h2>
      <p class="mx-auto mb-8 max-w-2xl text-lg text-white/70">
        {{ t('home.cta.description') }}
      </p>
      <div class="flex flex-wrap justify-center gap-3">
        <RouterLink to="/topics" class="vt-btn vt-btn-outline">{{ t('home.cta.buttons.browseTopics') }}</RouterLink>
        <RouterLink to="/intro" class="vt-btn vt-btn-primary">{{ t('home.cta.buttons.learnMore') }}</RouterLink>
      </div>
    </div>
  </section>
</template>
