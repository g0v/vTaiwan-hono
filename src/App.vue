<script setup lang="ts">
import { computed, onMounted, provide, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import Footer from './components/Footer.vue'
import NavBar from './components/NavBar.vue'
import {
  detectPreferredLocale,
  isSupportedLocale,
  localeKey,
  persistLocale,
  supportedLocales,
  type SupportedLocale,
} from './i18n'

const route = useRoute()

// 偏好語言：以 provide / inject 將語言變數提供給所有子元件使用
const { locale } = useI18n()

const setLocale = (next: SupportedLocale) => {
  locale.value = next
  persistLocale(next)
}

provide(localeKey, { locale, supportedLocales, setLocale })

// SSR 階段固定使用預設語言以保持與 client 首次 hydration 一致；
// 待掛載完成後（僅瀏覽器端）再依使用者偏好切換，避免 hydration mismatch。
onMounted(() => {
  const preferred = detectPreferredLocale()
  if (preferred !== locale.value) {
    locale.value = preferred
  }
  if (isSupportedLocale(locale.value)) {
    persistLocale(locale.value)
  }
})

const activeNavKey = computed(() => {
  const path = route.path

  if (path === '/') return 'home'

  const map: Array<{ prefix: string; key: string }> = [
    { prefix: '/topic', key: 'topics' },
    { prefix: '/topics', key: 'topics' },
    { prefix: '/meetups', key: 'meetups' },
    { prefix: '/blogs', key: 'blogs' },
    { prefix: '/newsletters', key: 'newsletters' },
    { prefix: '/mastodon', key: 'mastodon' },
    { prefix: '/faq', key: 'faq' },
    { prefix: '/intro', key: 'about' },
    { prefix: '/about', key: 'about' },
    { prefix: '/contributors', key: 'contributors' },
  ]

  return map.find((item) => path.startsWith(item.prefix))?.key
})

watch(
  () => route.fullPath,
  () => {
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, left: 0, behavior: 'auto' })
    }
  },
)
</script>

<template>
  <div class="font-serif min-h-screen flex flex-col">
    <NavBar :current="activeNavKey" />
    <div class="flex-1">
      <RouterView />
    </div>
    <Footer />
  </div>
</template>
