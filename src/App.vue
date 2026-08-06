<script setup lang="ts">
import { computed, onMounted, provide, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import Footer from './components/Footer.vue'
import SocialLogin from './components/SocialLogin.vue'
import NavBar from './components/NavBar.vue'
import { authClient } from './client/authClient'
import { loadAuthSession, isAdminSession, type AuthSession } from './client/auth-session'
import { detectPreferredLocale, isSupportedLocale, localeKey, persistLocale, supportedLocales, type SupportedLocale } from './i18n'

const route = useRoute()
const showLoginModal = ref(false)
const isInApp = ref(false)
const user = ref<AuthenticatedUser | null>(null)
const authSession = ref<AuthSession | null>(null)
// session 是否已載入完成（成功或未登入皆算完成）——AdminView 用來區分「確認中」與「非管理員」。
// SSR 與首次 hydration 一律為 false，待瀏覽器端載入 session 後才轉 true，避免 hydration mismatch。
const authReady = ref(false)

// 管理員（含超級管理員）——決定 /profile 是否顯示管理後台入口。僅顯示層取捨，安全邊界在 Worker。
const isAdmin = computed(() => isAdminSession(authSession.value))

interface AuthenticatedUser {
  uid: string
  displayName: string | null
  email: string | null
  photoURL: string | null
}

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
  void loadBetterAuthSession()

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

function publicBetterAuthUser(betterAuthUser: AuthSession['user']): AuthenticatedUser {
  return {
    uid: betterAuthUser.id,
    displayName: betterAuthUser.name,
    email: betterAuthUser.email,
    photoURL: betterAuthUser.image ?? null,
  }
}

async function loadBetterAuthSession() {
  try {
    authSession.value = await loadAuthSession()
    user.value = authSession.value ? publicBetterAuthUser(authSession.value.user) : null
    if (!authSession.value) return
    handleLoginSuccess()
  } catch (error) {
    console.error('Failed to load Better Auth session:', error)
  } finally {
    // 無論成功、未登入或失敗，都標記為已完成，讓守衛頁面可從「確認中」進入判定。
    authReady.value = true
  }
}

async function handleLogout() {
  try {
    const { error } = await authClient.signOut()
    if (error) {
      console.error('Better Auth logout error:', error)
    } else {
      authSession.value = null
      user.value = null
    }
  } catch (error) {
    console.error('Better Auth logout error:', error)
  }
}

function handleProfileUpdated(displayName: string) {
  if (user.value) {
    user.value = { ...user.value, displayName }
  }
  if (authSession.value) {
    authSession.value = { ...authSession.value, user: { ...authSession.value.user, name: displayName } }
  }
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
    { prefix: '/profile', key: 'profile' },
    { prefix: '/admin', key: 'admin' },
  ]

  return map.find(item => path.startsWith(item.prefix))?.key
})

watch(
  () => route.fullPath,
  () => {
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, left: 0, behavior: 'auto' })
    }
  }
)
</script>

<template>
  <div class="flex min-h-screen flex-col font-serif">
    <NavBar :current="activeNavKey" :user="user" :is-admin="isAdmin" @show-login="showLoginModal = true" @logout="handleLogout" />
    <div class="flex-1">
      <RouterView :user="user" :auth-session="authSession" :auth-ready="authReady" :is-admin="isAdmin" :in-app="isInApp" @logout="handleLogout" @profile-updated="handleProfileUpdated" />
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

        <SocialLogin :in-app="isInApp" />

        <div class="mt-5 text-center">
          <button type="button" class="font-sans text-vt-sm text-vt-fg-2 hover:text-vt-fg-1" @click="showLoginModal = false">
            {{ $t('common.cancel') }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
