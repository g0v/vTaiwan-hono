<script setup lang="ts">
import { computed, nextTick, ref } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { authClient } from '../client/authClient'
import { STEP_UP_PURPOSE } from '../client/auth-session'
import IconWrapper from './IconWrapper.vue'

type SocialProvider = 'google' | 'github'

const props = withDefaults(
  defineProps<{
    inApp?: boolean
    /** OAuth 完成後導回的站內路徑；預設回到發起登入的當前頁面 */
    callbackUrl?: string
    /** 敏感操作二次驗證：於 OAuth state 標記意圖，回調時才會簽發 step-up cookie（見 server/lib/step-up.ts） */
    forStepUp?: boolean
  }>(),
  { inApp: false, forStepUp: false }
)
const { t } = useI18n()
const route = useRoute()

// 記住是從哪個路由發起登入：OAuth 回跳後導回原頁，不要一律掉回首頁
//（Better Auth 未給 callbackURL 時會退回 baseURL）。相對路徑受 trustedOrigins 允許。
const callbackTarget = computed(() => props.callbackUrl || route.fullPath)
const loadingProvider = ref<SocialProvider | null>(null)
// 二次驗證與一般登入提供同一組 provider：`purpose=step-up` 是寫進 OAuth state 的
// （Better Auth `/sign-in/social` 共用流程，與 provider 無關），任一 provider 回調都能簽發 cookie。
const socialProviders: SocialProvider[] = ['google', 'github']

async function handleBetterAuthSocialLogin(provider: SocialProvider) {
  if (props.inApp) {
    window.alert(t('auth.inAppBrowserNotSupported'))
    return
  }

  try {
    loadingProvider.value = provider
    await nextTick()

    const { error } = await authClient.signIn.social({
      provider,
      callbackURL: callbackTarget.value,
      ...(props.forStepUp ? { additionalData: { purpose: STEP_UP_PURPOSE } } : {}),
    })
    if (error) {
      console.error(`Better Auth ${provider} login error:`, error)
      window.alert(t('auth.loginFailed'))
    }
  } catch (error) {
    console.error(`Better Auth ${provider} login error:`, error)
    window.alert(t('auth.loginFailed'))
  } finally {
    loadingProvider.value = null
  }
}
</script>

<template>
  <div class="text-center">
    <div v-if="loadingProvider" class="fixed inset-0 z-110 flex items-center justify-center bg-vt-black/50" aria-hidden="true">
      <span class="border-vt-4 h-vt-12 w-vt-12 animate-spin rounded-vt-full border-vt-bg-1 border-t-transparent" />
    </div>

    <div class="space-y-vt-3">
      <button
        v-for="provider in socialProviders"
        :key="provider"
        type="button"
        class="flex w-full items-center justify-center rounded-vt-md border border-vt-border bg-vt-bg-1 px-4 py-3 font-sans text-vt-sm font-medium text-vt-fg-2 shadow-vt-sm transition-colors hover:bg-vt-bg-2 focus:ring-2 focus:ring-democratic-red focus:ring-offset-2 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
        :disabled="!!loadingProvider"
        @click="handleBetterAuthSocialLogin(provider)"
      >
        <span v-if="loadingProvider === provider" class="mr-2 animate-spin" aria-hidden="true">⏳</span>
        <img v-else-if="provider === 'google'" src="https://developers.google.com/identity/images/g-logo.png" alt="Google" class="mr-2 h-5 w-5" />
        <IconWrapper v-else name="github" :size="20" color="currentColor" class="mr-2" />
        {{ loadingProvider === provider ? t('auth.loggingIn') : t(provider === 'google' ? 'auth.loginWithGoogle' : 'auth.loginWithGithub') }}
      </button>
    </div>
  </div>
</template>
