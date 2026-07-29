<script setup lang="ts">
import { nextTick, ref } from 'vue'
import type { User } from 'firebase/auth'
import { useI18n } from 'vue-i18n'
import { getFirebaseServices } from '../lib/firebase'
import { authClient } from '../client/authClient'

const props = withDefaults(defineProps<{ inApp?: boolean }>(), {
  inApp: false,
})
const emit = defineEmits<{ 'login-success': [user: User] }>()
const { t } = useI18n()
const loading = ref(false)
const betterAuthLoading = ref(false)

async function handleGoogleLogin() {
  if (props.inApp) {
    window.alert(t('auth.inAppBrowserNotSupported'))
    return
  }

  try {
    loading.value = true
    const { auth, GoogleAuthProvider, signInWithPopup } = await getFirebaseServices()
    const result = await signInWithPopup(auth, new GoogleAuthProvider())

    emit('login-success', result.user)
  } catch (error) {
    console.error('Google login error:', error)
    window.alert(t('auth.loginFailed'))
  } finally {
    loading.value = false
  }
}

async function handleBetterAuthGoogleLogin() {
  try {
    betterAuthLoading.value = true
    await nextTick()
    await authClient.signIn.social({ provider: 'google' })
  } catch (error) {
    console.error('Better Auth Google login error:', error)
    window.alert(t('auth.loginFailed'))
  }
}
</script>

<template>
  <div class="space-y-3 text-center">
    <div v-if="betterAuthLoading" class="fixed inset-0 z-110 flex items-center justify-center bg-vt-black/50" aria-hidden="true">
      <span class="border-vt-4 h-vt-12 w-vt-12 animate-spin rounded-vt-full border-vt-bg-1 border-t-transparent" />
    </div>

    <button
      type="button"
      class="flex w-full items-center justify-center rounded-vt-md border border-vt-border bg-vt-bg-1 px-4 py-3 font-sans text-vt-sm font-medium text-vt-fg-2 shadow-vt-sm transition-colors hover:bg-vt-bg-2 focus:ring-2 focus:ring-democratic-red focus:ring-offset-2 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
      :disabled="loading"
      @click="handleGoogleLogin"
    >
      <img v-if="!loading" src="https://developers.google.com/identity/images/g-logo.png" alt="Google" class="mr-2 h-5 w-5" />
      <span v-else class="mr-2 animate-spin" aria-hidden="true">⏳</span>
      {{ loading ? t('auth.loggingIn') : t('auth.loginWithGoogle') }}
    </button>

    <button
      type="button"
      class="flex w-full items-center justify-center rounded-vt-md border border-vt-border bg-vt-bg-1 px-4 py-3 font-sans text-vt-sm font-medium text-vt-fg-2 shadow-vt-sm transition-colors hover:bg-vt-bg-2 focus:ring-2 focus:ring-democratic-red focus:ring-offset-2 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
      :disabled="betterAuthLoading"
      @click="handleBetterAuthGoogleLogin"
    >
      <img v-if="!betterAuthLoading" src="https://developers.google.com/identity/images/g-logo.png" alt="Google" class="mr-2 h-5 w-5" />
      <span v-else class="mr-2 animate-spin" aria-hidden="true">⏳</span>
      {{ betterAuthLoading ? t('auth.loggingIn') : t('auth.loginWithGoogle') + ' (Better Auth)' }}
    </button>
  </div>
</template>
