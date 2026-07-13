<script setup lang="ts">
import { computed, onMounted, onUnmounted, provide, ref, watch } from "vue";
import type { User } from "firebase/auth";
import { useRoute } from "vue-router";
import { useI18n } from "vue-i18n";
import Footer from "./components/Footer.vue";
import GoogleLogin from "./components/GoogleLogin.vue";
import NavBar from "./components/NavBar.vue";
import { getFirebaseServices } from "./lib/firebase";
import {
  detectPreferredLocale,
  isSupportedLocale,
  localeKey,
  persistLocale,
  supportedLocales,
  type SupportedLocale,
} from "./i18n";

const route = useRoute();
const showLoginModal = ref(false);
const isInApp = ref(false);
const user = ref<AuthenticatedUser | null>(null);
const userData = ref<UserData | null>(null);
let unsubscribeAuth: (() => void) | undefined;

interface AuthenticatedUser {
  uid: string;
  displayName: string | null;
  email: string | null;
  photoURL: string | null;
}

interface UserData {
  uid: string;
  name: string | null;
  email: string | null;
  photoURL: string | null;
  role: string;
  createdAt: string;
  updatedAt: string;
  isAdmin: boolean;
  isSuperAdmin: boolean;
  isActive: boolean;
  isDeleted: boolean;
}

// 偏好語言：以 provide / inject 將語言變數提供給所有子元件使用
const { locale } = useI18n();

const setLocale = (next: SupportedLocale) => {
  locale.value = next;
  persistLocale(next);
};

provide(localeKey, { locale, supportedLocales, setLocale });

// SSR 階段固定使用預設語言以保持與 client 首次 hydration 一致；
// 待掛載完成後（僅瀏覽器端）再依使用者偏好切換，避免 hydration mismatch。
onMounted(() => {
  isInApp.value = /\b(FBAN|FBAV|Instagram|Line)\b/i.test(navigator.userAgent);
  void watchAuthState();

  const preferred = detectPreferredLocale();
  if (preferred !== locale.value) {
    locale.value = preferred;
  }
  if (isSupportedLocale(locale.value)) {
    persistLocale(locale.value);
  }
});

function handleLoginSuccess() {
  showLoginModal.value = false;
}

onUnmounted(() => {
  unsubscribeAuth?.();
});

function publicUser(firebaseUser: User): AuthenticatedUser {
  return {
    uid: firebaseUser.uid,
    displayName: firebaseUser.displayName,
    email: firebaseUser.email,
    photoURL: firebaseUser.photoURL,
  };
}

async function watchAuthState() {
  try {
    const { auth, onAuthStateChanged } = await getFirebaseServices();
    unsubscribeAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      user.value = firebaseUser ? publicUser(firebaseUser) : null;

      if (firebaseUser) {
        showLoginModal.value = false;
        await loadOrCreateUserData(firebaseUser);
      } else {
        userData.value = null;
      }
    });
  } catch (error) {
    console.error("Failed to initialize Firebase authentication:", error);
  }
}

async function loadOrCreateUserData(firebaseUser: User) {
  try {
    const { database, databaseGet, databaseRef, databaseSet } = await getFirebaseServices();
    const reference = databaseRef(database, `users/${firebaseUser.uid}`);
    const snapshot = await databaseGet(reference);
    const defaults: UserData = {
      uid: firebaseUser.uid,
      name: firebaseUser.displayName,
      email: firebaseUser.email,
      photoURL: firebaseUser.photoURL,
      role: "user",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isAdmin: false,
      isSuperAdmin: false,
      isActive: true,
      isDeleted: false,
    };

    if (!snapshot.exists()) {
      await databaseSet(reference, defaults);
      userData.value = defaults;
      return;
    }

    userData.value = { ...defaults, ...(snapshot.val() as Partial<UserData>) };
  } catch (error) {
    console.error("Failed to load Firebase user data:", error);
  }
}

async function handleLogout() {
  try {
    const { auth, signOut } = await getFirebaseServices();
    await signOut(auth);
  } catch (error) {
    console.error("Firebase logout error:", error);
  }
}

function handleProfileUpdated(displayName: string) {
  if (user.value) {
    user.value = { ...user.value, displayName };
  }
  if (userData.value) {
    userData.value = { ...userData.value, name: displayName };
  }
}

const activeNavKey = computed(() => {
  const path = route.path;

  if (path === "/") return "home";

  const map: Array<{ prefix: string; key: string }> = [
    { prefix: "/topic", key: "topics" },
    { prefix: "/topics", key: "topics" },
    { prefix: "/meetups", key: "meetups" },
    { prefix: "/blogs", key: "blogs" },
    { prefix: "/newsletters", key: "newsletters" },
    { prefix: "/mastodon", key: "mastodon" },
    { prefix: "/faq", key: "faq" },
    { prefix: "/intro", key: "about" },
    { prefix: "/about", key: "about" },
    { prefix: "/contributors", key: "contributors" },
  ];

  return map.find((item) => path.startsWith(item.prefix))?.key;
});

watch(
  () => route.fullPath,
  () => {
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    }
  },
);
</script>

<template>
  <div class="font-serif min-h-screen flex flex-col">
    <NavBar
      :current="activeNavKey"
      :user="user"
      :user-data="userData"
      @show-login="showLoginModal = true"
      @logout="handleLogout"
    />
    <div class="flex-1">
      <RouterView
        :user="user"
        :user-data="userData"
        :in-app="isInApp"
        @login-success="handleLoginSuccess"
        @logout="handleLogout"
        @profile-updated="handleProfileUpdated"
      />
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
          <h2 class="font-sans text-vt-2xl font-bold">{{ $t("auth.loginTitle") }}</h2>
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
          <button
            type="button"
            class="font-sans text-vt-sm text-vt-fg-2 hover:text-vt-fg-1"
            @click="showLoginModal = false"
          >
            {{ $t("common.cancel") }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
