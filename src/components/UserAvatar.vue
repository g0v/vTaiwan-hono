<script setup lang="ts">
import { computed, ref, watch } from 'vue'

/**
 * 通用使用者頭像元件。
 * - 有圖且載入成功：顯示 <img>
 * - 無圖或圖片載入失敗（@error）：顯示靜態 SVG 人像作為 fallback
 *
 * 類別（class）由父層傳入（inheritAttrs），統一控制尺寸、圓角、邊框。
 * 元件根節點為 <span>，攜帶 $attrs（含 class）後再渲染 img 或 svg。
 */

defineOptions({ inheritAttrs: false })

const props = defineProps<{
  /** 頭像圖片 URL；null / undefined 時直接顯示 fallback */
  src?: string | null
  /** img alt 屬性 */
  alt?: string
}>()

const imgError = ref(false)

// src 換掉時重置錯誤狀態，讓新 URL 有機會重試
watch(
  () => props.src,
  () => {
    imgError.value = false
  }
)

const showImage = computed(() => !!props.src && !imgError.value)
</script>

<template>
  <span v-bind="$attrs" class="inline-flex items-center justify-center overflow-hidden bg-vt-bg-2">
    <img v-if="showImage" :src="src!" :alt="alt ?? ''" class="h-full w-full object-cover" @error="imgError = true" referrerpolicy="no-referrer" />
    <!-- fallback：無頭像或圖片載入失敗時顯示的靜態人像 -->
    <svg v-else viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" class="h-3/5 w-3/5 text-vt-fg-2">
      <path d="M12 12c2.761 0 5-2.239 5-5s-2.239-5-5-5-5 2.239-5 5 2.239 5 5 5zm0 2c-3.337 0-10 1.675-10 5v2h20v-2c0-3.325-6.663-5-10-5z" />
    </svg>
  </span>
</template>
