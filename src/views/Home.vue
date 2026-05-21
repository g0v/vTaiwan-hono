<script setup lang="ts">
import NavBar from '../components/NavBar.vue'
import Footer from '../components/Footer.vue'

// 「如何運作」三步驟 — 對應三種公民色
const steps = [
  {
    title: '提出議題',
    desc: '任何人都可以提出值得討論的公共政策議題，經過初步審核後進入討論階段。',
    tint: 'bg-democratic-red/10',
    color: 'text-democratic-red',
  },
  {
    title: '開放討論',
    desc: '透過線上討論與實體會議，收集各方意見，形成具體的政策建議。',
    tint: 'bg-jade-green/10',
    color: 'text-jade-green',
  },
  {
    title: '政策形成',
    desc: '將公民共識轉化為具體政策建議，提交給相關政府部門參考與執行。',
    tint: 'bg-wheat-yellow/10',
    color: 'text-wheat-yellow',
  },
]

// 本範本實際提供的路由 — 以「專案卡片」風格呈現
const routes = [
  { tag: 'SSR', label: '/about', title: '關於本範本', desc: 'Hono 路由 + Vue 3 伺服端渲染的說明頁。', href: '/about', dot: 'bg-jade-green' },
  { tag: '動態路由', label: '/word/:w', title: '字詞示範', desc: '網址參數帶入 Vue 元件，並組出對應的 og:image。', href: '/word/%E8%90%8C', dot: 'bg-wheat-yellow' },
  { tag: 'Hydration', label: '/hundred', title: '百數表互動', desc: 'SSR 後由瀏覽器接管：v-model、v-for、:style 著色。', href: '/hundred', dot: 'bg-democratic-red' },
  { tag: 'API', label: '/api/hello', title: 'JSON API', desc: '純文字 / JSON 回應，不經過 SSR 直接回傳。', href: '/api/hello', dot: 'bg-vt-gray-400', external: true },
]
</script>

<template>
  <div class="font-serif">
    <NavBar current="home" />

    <!-- Hero -->
    <section class="vt-hero-bg -mt-[84px] text-white sm:-mt-[88px]">
      <div class="relative z-10 mx-auto max-w-5xl px-6 pb-24 pt-[156px] sm:pt-[184px]">
        <div class="mb-12 inline-flex items-center gap-3.5 font-sans text-[13px] font-semibold uppercase tracking-[0.22em] text-white/55">
          <span class="h-px w-7 bg-white/45" />
          公共政策開放協作平台
        </div>

        <h1 class="mb-9 font-bold leading-[1.1] tracking-[-0.02em] text-[clamp(2.75rem,7vw,4.75rem)]">
          <span class="text-democratic-red">開放</span>、<span class="text-jade-green">協作</span>、<span class="text-wheat-yellow">共創</span>
          <span class="mt-6 block font-normal text-white/55">台灣的未來。</span>
        </h1>

        <p class="mb-12 max-w-[44ch] text-lg leading-relaxed text-white/70 sm:text-xl">
          vTaiwan 是一個促進政府與公民對話的開放協作平台，讓每個人都能參與公共政策的形成過程。
        </p>

        <div class="flex flex-wrap gap-3">
          <RouterLink to="/#explore" class="vt-btn vt-btn-primary">
            瀏覽範例
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M5 12h14M13 5l7 7-7 7" />
            </svg>
          </RouterLink>
          <RouterLink to="/about" class="vt-btn vt-btn-outline">了解更多</RouterLink>
        </div>
      </div>
    </section>

    <!-- 如何運作 -->
    <section class="bg-vt-gray-100 py-16 sm:py-20">
      <div class="mx-auto max-w-6xl px-6">
        <h2 class="mb-12 text-center text-3xl font-bold sm:text-4xl">
          <span class="vt-title-underline">如何運作</span>
        </h2>

        <div class="grid gap-8 md:grid-cols-3">
          <div
            v-for="(step, i) in steps"
            :key="step.title"
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
            <h3 class="mb-3 text-xl font-bold">{{ step.title }}</h3>
            <p class="text-vt-gray-700">{{ step.desc }}</p>
          </div>
        </div>
      </div>
    </section>

    <!-- 探索本範本 -->
    <section id="explore" class="bg-white py-16 sm:py-20">
      <div class="mx-auto max-w-6xl px-6">
        <h2 class="mb-3 text-center text-3xl font-bold sm:text-4xl">
          <span class="vt-title-underline">探索這個範本</span>
        </h2>
        <p class="mx-auto mb-12 max-w-xl text-center text-vt-gray-700">
          本範本以 Hono 路由 + Vue 3 SSR 運行於 Cloudflare Workers，並用 Tailwind CSS 排版。
        </p>

        <div class="grid gap-6 sm:grid-cols-2">
          <template
            v-for="r in routes"
            :key="r.href"
          >
            <a
              v-if="r.external"
              :href="r.href"
              class="group flex flex-col rounded-2xl border border-vt-gray-200 bg-white p-6 shadow-sm transition-all duration-200 hover:-translate-y-1 hover:border-democratic-red/30 hover:shadow-lg"
            >
              <div class="mb-3 flex items-center justify-between">
                <span class="inline-flex items-center gap-2 font-sans text-xs text-vt-gray-700">
                  <span class="h-2 w-2 rounded-full" :class="r.dot" />
                  {{ r.tag }}
                </span>
                <code class="rounded bg-vt-gray-100 px-2 py-0.5 font-sans text-xs text-vt-gray-700">{{ r.label }}</code>
              </div>
              <h3 class="mb-1.5 text-lg font-bold">{{ r.title }}</h3>
              <p class="mb-4 text-sm leading-relaxed text-vt-gray-700">{{ r.desc }}</p>
              <span class="mt-auto inline-flex items-center gap-1 font-sans text-sm font-medium text-democratic-red">
                前往
                <svg class="transition-transform duration-200 group-hover:translate-x-1" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M7 7h10v10M7 17 17 7" />
                </svg>
              </span>
            </a>
            <RouterLink
              v-else
              :to="r.href"
              class="group flex flex-col rounded-2xl border border-vt-gray-200 bg-white p-6 shadow-sm transition-all duration-200 hover:-translate-y-1 hover:border-democratic-red/30 hover:shadow-lg"
            >
              <div class="mb-3 flex items-center justify-between">
                <span class="inline-flex items-center gap-2 font-sans text-xs text-vt-gray-700">
                  <span class="h-2 w-2 rounded-full" :class="r.dot" />
                  {{ r.tag }}
                </span>
                <code class="rounded bg-vt-gray-100 px-2 py-0.5 font-sans text-xs text-vt-gray-700">{{ r.label }}</code>
              </div>
              <h3 class="mb-1.5 text-lg font-bold">{{ r.title }}</h3>
              <p class="mb-4 text-sm leading-relaxed text-vt-gray-700">{{ r.desc }}</p>
              <span class="mt-auto inline-flex items-center gap-1 font-sans text-sm font-medium text-democratic-red">
                前往
                <svg class="transition-transform duration-200 group-hover:translate-x-1" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M7 7h10v10M7 17 17 7" />
                </svg>
              </span>
            </RouterLink>
          </template>
        </div>
      </div>
    </section>

    <!-- CTA -->
    <section class="bg-ink py-16 text-center text-white sm:py-20">
      <div class="mx-auto max-w-3xl px-6">
        <h2 class="mb-6 text-3xl font-bold sm:text-4xl">加入我們，共同參與台灣的未來</h2>
        <p class="mx-auto mb-8 max-w-2xl text-lg text-white/70">
          無論您是公民、專家、政府人員或是關心公共事務的任何人，都歡迎加入 vTaiwan 平台，貢獻您的想法。
        </p>
        <div class="flex flex-wrap justify-center gap-3">
          <RouterLink to="/#explore" class="vt-btn vt-btn-primary">瀏覽範例</RouterLink>
          <RouterLink to="/about" class="vt-btn vt-btn-outline">了解更多</RouterLink>
        </div>
      </div>
    </section>

    <Footer />
  </div>
</template>
