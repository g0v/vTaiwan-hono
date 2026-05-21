<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute } from 'vue-router'

const props = defineProps<{ current?: string }>()
const route = useRoute()
const mobileOpen = ref(false)

// 導覽連結對齊至 vue.vTaiwan-neo 專案項目
const links = [
  { key: 'home', label: '首頁', href: '/' },
  { key: 'topics', label: '議題', href: '/topics' },
  { key: 'meetups', label: '會議', href: '/meetups' },
  { key: 'blogs', label: '部落格', href: '/blogs' },
  { key: 'newsletters', label: '電子報', href: '/newsletters' },
  { key: 'mastodon', label: '社群貼文', href: '/mastodon' },
  { key: 'faq', label: '常見問題', href: '/faq' },
  { key: 'about', label: '關於', href: '/intro' },
  { key: 'contributors', label: '貢獻者', href: '/contributors' },
]

const activeKey = computed(() => props.current ?? '')

watch(
  () => route.fullPath,
  () => {
    mobileOpen.value = false
  },
)
</script>

<template>
  <header class="sticky top-0 z-50 px-3 pt-3 sm:px-6 sm:pt-4 font-sans">
    <div class="vt-glass mx-auto flex h-[72px] max-w-6xl items-center justify-between rounded-2xl pl-6 pr-3">
      <RouterLink to="/" class="flex shrink-0 items-center" aria-label="vTaiwan 首頁">
        <img :src="'/assets/vtaiwan-logo.svg'" alt="vTaiwan" class="h-7 w-auto" />
      </RouterLink>

      <!-- 桌面導覽 -->
      <nav class="hidden items-center gap-0.5 text-sm lg:flex">
        <RouterLink
          v-for="l in links"
          :key="l.key"
          :to="l.href"
          class="relative whitespace-nowrap rounded-full px-3.5 py-2 transition-colors hover:bg-black/5"
          :class="activeKey === l.key ? 'text-democratic-red' : 'text-[#2a2a30]'"
        >
          {{ l.label }}
          <span
            v-if="activeKey === l.key"
            class="absolute -bottom-px left-1/2 h-[5px] w-[5px] -translate-x-1/2 rounded-full bg-democratic-red"
          />
        </RouterLink>
      </nav>

      <div class="flex items-center gap-2.5 text-[13px]">
        <span class="inline-flex cursor-pointer items-center gap-1.5 rounded-full px-3 py-1.5 text-[#4a4a52] transition-colors hover:bg-black/5">
          <svg class="opacity-70" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><path d="M2 12h20M12 2a15 15 0 0 1 0 20M12 2a15 15 0 0 0 0 20"></path></svg>
          中文
        </span>
        <span class="hidden h-5 w-px bg-black/10 sm:block" />
        <a
          href="#"
          class="hidden whitespace-nowrap rounded-full bg-ink px-4 py-2 font-medium text-white transition-colors hover:bg-democratic-red sm:inline-flex"
        >
          註冊 / 登入
        </a>

        <!-- 行動裝置漢堡按鈕 -->
        <button
          type="button"
          class="flex h-10 w-10 cursor-pointer items-center justify-center rounded-full text-ink transition-colors hover:bg-black/5 lg:hidden"
          :aria-expanded="mobileOpen"
          aria-label="開啟選單"
          @click="mobileOpen = !mobileOpen"
        >
          <svg v-if="!mobileOpen" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
            <path d="M4 7h16M4 12h16M4 17h16" />
          </svg>
          <svg v-else width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      </div>
    </div>

    <!-- 行動選單面板 -->
    <div v-if="mobileOpen" class="vt-glass mx-auto mt-2 max-w-6xl rounded-2xl p-2.5 lg:hidden">
      <RouterLink
        v-for="l in links"
        :key="l.key"
        :to="l.href"
        class="flex items-center justify-between rounded-xl px-3.5 py-3 transition-colors hover:bg-black/5"
        :class="activeKey === l.key ? 'text-democratic-red' : 'text-[#2a2a30]'"
        @click="mobileOpen = false"
      >
        {{ l.label }}
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" class="opacity-40">
          <path d="m9 18 6-6-6-6" />
        </svg>
      </RouterLink>
      <div class="my-1.5 h-px bg-black/10" />
      <div class="flex gap-2 px-1.5 pb-1.5 pt-2">
        <span class="inline-flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-full bg-black/[0.04] px-3 py-3 text-[#4a4a52]">
          <svg class="opacity-70" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><path d="M2 12h20M12 2a15 15 0 0 1 0 20M12 2a15 15 0 0 0 0 20"></path></svg>
          中文
        </span>
        <a href="#" class="inline-flex flex-1 items-center justify-center rounded-full bg-ink px-4 py-3 font-medium text-white transition-colors hover:bg-democratic-red">
          註冊 / 登入
        </a>
      </div>
    </div>
  </header>
</template>
