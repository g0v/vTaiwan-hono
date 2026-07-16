<template>
  <div class="relative">
    <button
      @click="isOpen = !isOpen"
      class="flex items-center space-x-1 rounded-lg border border-gray-300 px-1 py-2 transition-colors hover:border-gray-400 focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
    >
      <span class="text-lg">{{ currentLocaleFlag }}</span>
      <span class="text-sm font-medium">{{ currentLocaleName }}</span>
      <svg class="h-4 w-4 transition-transform" :class="{ 'rotate-180': isOpen }" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
      </svg>
    </button>

    <div v-if="isOpen" class="absolute right-0 z-50 mt-2 w-48 rounded-lg border border-gray-300 bg-white shadow-lg">
      <div class="py-1">
        <button
          v-for="loc in supportedLocales"
          :key="loc.code"
          @click="switchLocale(loc.code)"
          class="flex w-full items-center space-x-3 px-4 py-2 text-left transition-colors hover:bg-gray-100"
          :class="{
            'bg-blue-50 text-blue-600': currentLocale === loc.code,
            'text-democratic-red': currentLocale !== loc.code,
          }"
        >
          <span class="text-lg">{{ loc.flag }}</span>
          <span class="text-sm">{{ loc.name }}</span>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { supportedLocales, type SupportedLocale } from '../i18n'

const props = defineProps<{
  modelValue: SupportedLocale
}>()

const emit = defineEmits<{
  'update:modelValue': [value: SupportedLocale]
}>()

const isOpen = ref(false)

const currentLocale = computed({
  get: () => props.modelValue,
  set: value => emit('update:modelValue', value),
})

const currentLocaleFlag = computed(() => supportedLocales.find(l => l.code === currentLocale.value)?.flag ?? '🌐')

const currentLocaleName = computed(() => supportedLocales.find(l => l.code === currentLocale.value)?.name ?? 'Unknown')

function switchLocale(newLocale: SupportedLocale) {
  currentLocale.value = newLocale
  isOpen.value = false
}

// 點擊外部關閉下拉選單（僅限瀏覽器端）
function handleClickOutside(event: Event) {
  const target = event.target as HTMLElement
  if (!target.closest('.relative')) {
    isOpen.value = false
  }
}

onMounted(() => {
  document.addEventListener('click', handleClickOutside)
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
})
</script>
