<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useRoute } from "vue-router";
import { useI18n } from "vue-i18n";
import LanguageSwitcher from "./LanguageSwitcher.vue";

interface AuthenticatedUser {
  displayName: string | null;
  photoURL: string | null;
}

interface UserData {
  name: string | null;
  photoURL: string | null;
}

const props = withDefaults(
  defineProps<{
    current?: string;
    user?: AuthenticatedUser | null;
    userData?: UserData | null;
  }>(),
  {
    current: "",
    user: null,
    userData: null,
  },
);
const emit = defineEmits<{ "show-login": []; logout: [] }>();
const route = useRoute();
const { t } = useI18n();
const mobileOpen = ref(false);

// 導覽連結對齊至 vue.vTaiwan-neo 專案項目；label 由 i18n 提供
const links = [
  { key: "home", labelKey: "header.home", href: "/" },
  { key: "topics", labelKey: "header.topics", href: "/topics" },
  { key: "meetups", labelKey: "header.meetups", href: "/meetups" },
  { key: "blogs", labelKey: "header.blogs", href: "/blogs" },
  { key: "newsletters", labelKey: "header.newsletters", href: "/newsletters" },
  { key: "mastodon", labelKey: "header.mastodon", href: "/mastodon" },
  { key: "faq", labelKey: "header.faq", href: "/faq" },
  { key: "about", labelKey: "header.about", href: "/intro" },
  { key: "contributors", labelKey: "header.contributors", href: "/contributors" },
];

const activeKey = computed(() => props.current ?? "");
const profileName = computed(
  () => props.userData?.name || props.user?.displayName || t("common.profile"),
);
const profilePhotoUrl = computed(() => props.userData?.photoURL || props.user?.photoURL);

const { locale } = useI18n();
const isJapanese = computed(() => locale.value === "ja");
const isChinese = computed(() => locale.value.includes("zh"));
const isEnglish = computed(() => locale.value.includes("en"));

watch(
  () => route.fullPath,
  () => {
    mobileOpen.value = false;
  },
);
</script>

<template>
  <header class="sticky top-0 z-50 px-3 pt-3 sm:px-6 sm:pt-4 font-sans">
    <div
      class="vt-glass relative z-20 mx-auto flex h-[72px] max-w-6xl items-center justify-between rounded-2xl pl-6 pr-3"
      :class="{ 'max-w-7xl': !isChinese }"
    >
      <RouterLink to="/" class="flex shrink-0 items-center" :aria-label="t('header.home')">
        <img :src="'/assets/vtaiwan-logo.svg'" alt="vTaiwan" class="h-7 w-auto" />
      </RouterLink>

      <!-- 桌面導覽 -->
      <nav
        class="hidden items-center gap-0.5 xl:flex"
        :class="{ 'text-xs': isJapanese, 'text-md': isChinese, 'text-sm': isEnglish }"
      >
        <RouterLink
          v-for="l in links"
          :key="l.key"
          :to="l.href"
          class="relative whitespace-nowrap rounded-full px-3.5 py-2 transition-colors hover:bg-vt-gray-100"
          :class="activeKey === l.key ? 'text-democratic-red' : 'text-vt-gray-800'"
        >
          {{ t(l.labelKey) }}
          <span
            v-if="activeKey === l.key"
            class="absolute -bottom-px left-1/2 h-[5px] w-[5px] -translate-x-1/2 rounded-full bg-democratic-red"
          />
        </RouterLink>
      </nav>

      <div class="flex items-center gap-2.5 text-[13px]">
        <LanguageSwitcher />
        <span class="hidden h-5 w-px bg-vt-border sm:block" />
        <RouterLink
          v-if="user"
          to="/profile"
          class="hidden items-center gap-2 rounded-full px-2 py-1 transition-colors hover:bg-vt-bg-2 sm:inline-flex"
          :title="t('common.profile')"
        >
          <img
            v-if="profilePhotoUrl"
            :src="profilePhotoUrl"
            :alt="profileName"
            class="h-8 w-8 rounded-vt-full border border-vt-border object-cover"
          />
          <span
            v-else
            class="flex h-8 w-8 items-center justify-center rounded-vt-full bg-vt-bg-2 text-vt-fg-2"
            aria-hidden="true"
            >👤</span
          >
          <span class="hidden max-w-24 truncate text-vt-sm text-vt-fg-1 xl:block">{{
            profileName
          }}</span>
        </RouterLink>
        <button
          v-else
          type="button"
          class="hidden whitespace-nowrap rounded-full bg-ink px-4 py-2 font-medium text-vt-fg-inverse transition-colors hover:bg-democratic-red sm:inline-flex"
          @click="emit('show-login')"
        >
          {{ t("common.registerLogin") }}
        </button>

        <!-- 行動裝置漢堡按鈕 -->
        <button
          type="button"
          class="flex h-10 w-10 cursor-pointer items-center justify-center rounded-full text-ink transition-colors hover:bg-vt-gray-100 xl:hidden"
          :aria-expanded="mobileOpen"
          :aria-label="t('header.openMenu')"
          @click="mobileOpen = !mobileOpen"
        >
          <svg
            v-if="!mobileOpen"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
          >
            <path d="M4 7h16M4 12h16M4 17h16" />
          </svg>
          <svg
            v-else
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
          >
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      </div>
    </div>

    <!-- 行動選單面板 -->
    <div
      v-if="mobileOpen"
      class="vt-glass relative z-10 mx-auto mt-2 max-w-6xl rounded-2xl p-2.5 xl:hidden"
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
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          class="opacity-40"
        >
          <path d="m9 18 6-6-6-6" />
        </svg>
      </RouterLink>
      <div class="my-1.5 h-px bg-vt-border" />
      <div class="flex gap-2 px-1.5 pb-1.5 pt-2">
        <LanguageSwitcher block drop-up class="flex-1" />
        <template v-if="user">
          <RouterLink
            to="/profile"
            class="inline-flex flex-1 items-center justify-center rounded-full bg-vt-bg-2 px-3 py-3 text-vt-fg-1 transition-colors hover:bg-vt-gray-100"
            :class="{ 'text-xs': isJapanese, 'text-md': isChinese, 'text-sm': isEnglish }"
            @click="mobileOpen = false"
          >
            {{ t("common.profile") }}
          </RouterLink>
          <button
            type="button"
            class="rounded-full px-3 py-3 text-vt-sm text-vt-fg-2 transition-colors hover:bg-vt-bg-2"
            @click="
              emit('logout');
              mobileOpen = false;
            "
          >
            {{ t("common.logout") }}
          </button>
        </template>
        <button
          v-else
          type="button"
          class="inline-flex flex-1 items-center justify-center rounded-full bg-ink px-3 py-3 text-vt-fg-inverse transition-colors hover:bg-democratic-red"
          :class="{ 'text-xs': isJapanese, 'text-md': isChinese, 'text-sm': isEnglish }"
          @click="emit('show-login')"
        >
          {{ t("common.registerLogin") }}
        </button>
      </div>
    </div>
  </header>
</template>
