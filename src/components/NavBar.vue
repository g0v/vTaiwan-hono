<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import LanguageSwitcher from './LanguageSwitcher.vue'
import UserAvatar from './UserAvatar.vue'
import { adminNavLink, navLinks as links } from '../router/nav-links'

interface AuthenticatedUser {
  displayName: string | null
  photoURL: string | null
}

const props = withDefaults(
  defineProps<{
    current?: string
    user?: AuthenticatedUser | null
    isAdmin?: boolean
  }>(),
  {
    current: '',
    user: null,
    isAdmin: false,
  }
)

const emit = defineEmits<{ 'show-login': []; logout: [] }>()
const route = useRoute()
const { t } = useI18n()
const mobileOpen = ref(false)

// 導覽連結對齊至 vue.vTaiwan-neo 專案項目；label 由 i18n 提供（資料源自 nav-links.ts）

const activeKey = computed(() => props.current ?? '')
const profileName = computed(() => props.user?.displayName || t('common.profile'))
const profilePhotoUrl = computed(() => props.user?.photoURL)

const { locale } = useI18n()
const isJapanese = computed(() => locale.value === 'ja')
const isChinese = computed(() => locale.value.includes('zh'))
const isEnglish = computed(() => locale.value.includes('en'))

watch(
  () => route.fullPath,
  () => {
    mobileOpen.value = false
  }
)

function logout() {
  emit('logout')
  mobileOpen.value = false
}

function showLogin() {
  emit('show-login')
  mobileOpen.value = false
}
</script>

<template>
  <header class="sticky top-0 z-50 px-3 pt-3 font-sans sm:px-6 sm:pt-4">
    <div
      class="vt-glass vt-glass--navbar relative z-20 mx-auto flex h-[72px] max-w-6xl items-center justify-between pr-3 pl-6 backdrop-blur-vt-navbar backdrop-saturate-vt-navbar"
      :class="{ 'max-w-7xl': !isChinese }"
    >
      <RouterLink to="/" class="flex shrink-0 items-center" :aria-label="t('header.home')">
        <img :src="'/assets/vtaiwan-logo.svg'" alt="vTaiwan" class="h-7 w-auto" />
      </RouterLink>

      <!-- 桌面導覽 -->
      <nav class="hidden items-center gap-0.5 xl:flex" :class="{ 'text-xs': isJapanese, 'text-md': isChinese, 'text-sm': isEnglish }">
        <RouterLink
          v-for="l in links"
          :key="l.key"
          :to="l.href"
          class="relative rounded-full px-3.5 py-2 whitespace-nowrap transition-colors hover:bg-vt-gray-100"
          :class="activeKey === l.key ? 'text-democratic-red' : 'text-vt-gray-800'"
        >
          {{ t(l.labelKey) }}
          <span v-if="activeKey === l.key" class="absolute -bottom-px left-1/2 h-[5px] w-[5px] -translate-x-1/2 rounded-full bg-democratic-red" />
        </RouterLink>
      </nav>

      <div class="flex items-center gap-2.5 text-[13px]">
        <LanguageSwitcher />
        <span class="hidden h-5 w-px bg-vt-border sm:block" />
        <RouterLink v-if="user" to="/profile" class="hidden items-center gap-2 rounded-full px-2 py-1 transition-colors hover:bg-vt-bg-2 sm:inline-flex" :title="t('common.profile')">
          <UserAvatar :src="profilePhotoUrl" :alt="profileName" class="h-8 w-8 rounded-vt-full border border-vt-border" />
          <span class="hidden max-w-24 truncate text-vt-sm text-vt-fg-1 xl:block">{{ profileName }}</span>
        </RouterLink>
        <button
          v-else
          type="button"
          class="hidden rounded-full bg-ink px-4 py-2 font-medium whitespace-nowrap text-vt-fg-inverse transition-colors hover:bg-democratic-red sm:inline-flex"
          @click="showLogin"
        >
          {{ t('common.registerLogin') }}
        </button>

        <!-- 行動裝置漢堡按鈕 -->
        <button
          type="button"
          class="flex h-10 w-10 cursor-pointer items-center justify-center rounded-full text-ink transition-colors hover:bg-vt-gray-100 xl:hidden"
          :aria-expanded="mobileOpen"
          :aria-label="t('header.openMenu')"
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

    <div v-if="mobileOpen" class="fixed inset-0 z-10" aria-hidden="true" @click="mobileOpen = false" @touchmove.prevent @wheel.prevent />

    <!-- 行動選單面板 -->
    <div v-if="mobileOpen" class="absolute left-0 z-20 w-full px-3 sm:px-6 xl:hidden">
      <div
        class="mobile-menu-panel vt-glass vt-glass--navbar relative z-10 mx-auto mt-2 max-w-6xl overflow-y-auto p-2.5 backdrop-blur-vt-navbar backdrop-saturate-vt-navbar"
        @touchmove.stop
        @wheel.stop
      >
        <RouterLink
          v-for="l in links"
          :key="l.key"
          :to="l.href"
          class="flex items-center justify-between rounded-xl px-3.5 py-1.5 transition-colors hover:bg-vt-gray-100"
          :class="activeKey === l.key ? 'text-democratic-red' : 'text-vt-gray-800'"
          @click="mobileOpen = false"
        >
          {{ t(l.labelKey) }}
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" class="opacity-40">
            <path d="m9 18 6-6-6-6" />
          </svg>
        </RouterLink>
        <RouterLink
          v-if="user"
          to="/profile"
          class="flex items-center justify-between rounded-xl px-3.5 py-1.5 transition-colors hover:bg-vt-gray-100"
          :class="activeKey === 'profile' ? 'text-democratic-red' : 'text-vt-gray-800'"
          @click="mobileOpen = false"
        >
          {{ t('common.profile') }}
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" class="opacity-40">
            <path d="m9 18 6-6-6-6" />
          </svg>
        </RouterLink>
        <RouterLink
          v-if="isAdmin"
          :to="adminNavLink.href"
          class="flex items-center justify-between rounded-xl px-3.5 py-1.5 transition-colors hover:bg-vt-gray-100"
          :class="activeKey === adminNavLink.key ? 'text-democratic-red' : 'text-vt-gray-800'"
          @click="mobileOpen = false"
        >
          {{ t(adminNavLink.labelKey) }}
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" class="opacity-40">
            <path d="m9 18 6-6-6-6" />
          </svg>
        </RouterLink>
        <div class="my-1.5 h-px bg-vt-border" />
        <div class="flex gap-2 px-1.5 pt-2 pb-1.5">
          <LanguageSwitcher block drop-up class="flex-1" />
          <template v-if="user">
            <button type="button" class="rounded-full px-3 py-3 text-vt-sm text-vt-fg-2 transition-colors hover:bg-vt-bg-2" @click="logout">
              {{ t('common.logout') }}
            </button>
          </template>
          <button
            v-else
            type="button"
            class="inline-flex flex-1 items-center justify-center rounded-full bg-ink px-3 py-3 text-vt-fg-inverse transition-colors hover:bg-democratic-red"
            :class="{ 'text-xs': isJapanese, 'text-md': isChinese, 'text-sm': isEnglish }"
            @click="showLogin"
          >
            {{ t('common.registerLogin') }}
          </button>
        </div>
      </div>
    </div>
  </header>
</template>

<style scoped>
.mobile-menu-panel {
  max-height: calc(100dvh - var(--spacing-vt-navbar-overlap) - var(--spacing-vt-2));
  overscroll-behavior: contain;
}

@media (min-width: 40rem) {
  .mobile-menu-panel {
    max-height: calc(100dvh - var(--spacing-vt-navbar-overlap-sm) - var(--spacing-vt-2));
  }
}
</style>
