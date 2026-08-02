<script setup lang="ts">
import GoogleLogin from './GoogleLogin.vue'

// 敏感操作二次驗證卡片：這裡發起的 Google 登入會標記 purpose=step-up，回調時才會簽發
// step-up cookie（見 server/lib/step-up.ts）——一般登入拿不到。GoogleLogin 預設導回發起
// 登入的頁面，所以在 /admin 完成二次驗證後直接回到 /admin，不必再從 /profile 繞進來。
withDefaults(
  defineProps<{
    title: string
    description: string
    inApp?: boolean
  }>(),
  { inApp: false }
)
</script>

<template>
  <div class="mx-auto max-w-md rounded-vt-lg border border-vt-border bg-vt-bg-1 p-vt-8 text-center shadow-vt-sm">
    <h2 class="text-vt-xl font-semibold text-vt-fg-1">{{ title }}</h2>
    <p class="mt-vt-2 text-vt-sm text-vt-fg-2">{{ description }}</p>
    <div class="mt-vt-6">
      <GoogleLogin :in-app="inApp" for-step-up />
    </div>
  </div>
</template>
