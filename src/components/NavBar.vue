<script setup lang="ts">
defineProps<{ current?: string }>()

// 導覽連結對應到本範本實際存在的路由
const links = [
  { key: 'home', label: '首頁', href: '/' },
  { key: 'about', label: '關於', href: '/about' },
  { key: 'word', label: '字詞示範', href: '/word/%E8%90%8C' },
  { key: 'hundred', label: '百數表', href: '/hundred' },
]
</script>

<template>
  <header class="sticky top-0 z-50 px-3 pt-3 sm:px-6 sm:pt-4 font-sans">
    <!-- CSS-only 行動選單開關（無需 client JS / hydration） -->
    <input id="vt-nav-toggle" type="checkbox" class="peer sr-only" />

    <div class="vt-glass mx-auto flex h-[72px] max-w-6xl items-center justify-between rounded-2xl pl-6 pr-3">
      <a href="/" class="flex shrink-0 items-center" aria-label="vTaiwan 首頁">
        <img src="/assets/vtaiwan-logo.svg" alt="vTaiwan" class="h-6 w-auto" />
      </a>

      <!-- 桌面導覽 -->
      <nav class="hidden items-center gap-0.5 text-sm md:flex">
        <a
          v-for="l in links"
          :key="l.key"
          :href="l.href"
          class="relative whitespace-nowrap rounded-full px-3.5 py-2 transition-colors hover:bg-black/5"
          :class="current === l.key ? 'text-democratic-red' : 'text-[#2a2a30]'"
        >
          {{ l.label }}
          <span
            v-if="current === l.key"
            class="absolute -bottom-px left-1/2 h-[5px] w-[5px] -translate-x-1/2 rounded-full bg-democratic-red"
          />
        </a>
      </nav>

      <div class="flex items-center gap-2.5 text-[13px]">
        <span class="hidden cursor-pointer items-center gap-1.5 rounded-full px-3 py-1.5 text-[#4a4a52] transition-colors hover:bg-black/5 md:inline-flex">
          中文
        </span>
        <span class="hidden h-5 w-px bg-black/10 md:block" />
        <a
          href="#"
          class="hidden whitespace-nowrap rounded-full bg-ink px-4 py-2 font-medium text-white transition-colors hover:bg-democratic-red sm:inline-flex"
        >
          註冊 / 登入
        </a>

        <!-- 行動裝置漢堡按鈕 -->
        <label
          for="vt-nav-toggle"
          class="flex h-10 w-10 cursor-pointer items-center justify-center rounded-full text-ink transition-colors hover:bg-black/5 md:hidden"
          aria-label="開啟選單"
        >
          <svg class="peer-checked:hidden" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
            <path d="M4 7h16M4 12h16M4 17h16" />
          </svg>
          <svg class="hidden peer-checked:block" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </label>
      </div>
    </div>

    <!-- 行動選單面板 -->
    <div class="vt-glass mx-auto mt-2 hidden max-w-6xl rounded-2xl p-2.5 peer-checked:block md:hidden">
      <a
        v-for="l in links"
        :key="l.key"
        :href="l.href"
        class="flex items-center justify-between rounded-xl px-3.5 py-3 transition-colors hover:bg-black/5"
        :class="current === l.key ? 'text-democratic-red' : 'text-[#2a2a30]'"
      >
        {{ l.label }}
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" class="opacity-40">
          <path d="m9 18 6-6-6-6" />
        </svg>
      </a>
      <div class="my-1.5 h-px bg-black/10" />
      <a href="#" class="block rounded-xl bg-ink px-3.5 py-3 text-center font-medium text-white">
        註冊 / 登入
      </a>
    </div>
  </header>
</template>
