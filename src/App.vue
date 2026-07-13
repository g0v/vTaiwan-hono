<script setup lang="ts">
import { computed, onMounted, provide, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import Footer from './components/Footer.vue'
import GoogleLogin from './components/GoogleLogin.vue'
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
const showLoginModal = ref(false)
const isInApp = ref(false)

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
  isInApp.value = /\b(FBAN|FBAV|Instagram|Line)\b/i.test(navigator.userAgent)

  const preferred = detectPreferredLocale()
  if (preferred !== locale.value) {
    locale.value = preferred
  }
  if (isSupportedLocale(locale.value)) {
    persistLocale(locale.value)
  }
})

function handleLoginSuccess() {
  showLoginModal.value = false
}

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
    <NavBar :current="activeNavKey" @show-login="showLoginModal = true" />
    <div class="flex-1">
      <RouterView />
    </div>
    <Footer />

    <div
      v-if="showLoginModal"
      class="fixed inset-0 z-[100] flex items-center justify-center bg-vt-black/50 p-4"
      role="dialog"
      aria-modal="true"
      :aria-label="$t('auth.loginTitle')"
      @click.self="showLoginModal = false"
    >
      <div class="w-full max-w-md rounded-vt-lg bg-vt-bg-1 p-6 shadow-vt-lg sm:p-8">
        <div class="mb-6 flex items-center justify-between gap-4">
          <h2 class="font-sans text-vt-2xl font-bold">{{ $t('auth.loginTitle') }}</h2>
          <button
            type="button"
            class="flex h-9 w-9 items-center justify-center rounded-vt-full text-vt-xl text-vt-fg-2 transition-colors hover:bg-vt-bg-2"
            :aria-label="$t('common.cancel')"
            @click="showLoginModal = false"
          >
            ×
          </button>
        </div>

        <GoogleLogin :in-app="isInApp" @login-success="handleLoginSuccess" />

        <div class="mt-5 text-center">
          <button type="button" class="font-sans text-vt-sm text-vt-fg-2 hover:text-vt-fg-1" @click="showLoginModal = false">
            {{ $t('common.cancel') }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
