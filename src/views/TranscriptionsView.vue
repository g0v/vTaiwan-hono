<template>
  <div class="container px-4 py-8">
    <div class="mx-auto max-w-6xl">
      <!-- 頁面標題 -->
      <div class="mb-8">
        <h1 class="mb-4 text-3xl font-bold text-gray-900">{{ t('transcriptions.title') }}</h1>
        <p class="text-gray-600">{{ t('transcriptions.description') }}</p>
      </div>

      <!-- 公開頁只提供瀏覽：上傳與大綱編輯已集中到 /admin 的逐字稿管理分頁 -->
      <TranscriptionManager />
    </div>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import TranscriptionManager from '../components/TranscriptionManager.vue'

const { t } = useI18n()

// RouterView 會傳入 user / userData / inApp 等 props；本頁只做瀏覽不需要，
// 關閉 attrs 繼承避免它們變成根元素上的 DOM 屬性。
defineOptions({ inheritAttrs: false })
</script>
