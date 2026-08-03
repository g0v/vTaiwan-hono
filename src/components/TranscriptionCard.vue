<template>
  <div class="relative rounded-lg border border-gray-200 bg-white p-6 shadow-md">
    <!-- 樣稿標籤 -->
    <div v-if="item.meeting_id === PROTOTYPE_MEETING_ID" class="absolute -top-2 -right-2 z-10">
      <div class="rotate-12 transform bg-yellow-400 px-3 py-1 text-xs font-bold text-black shadow-md">
        {{ t('transcriptions.list.prototypeBadge') }}
      </div>
    </div>

    <div class="flex items-start justify-between">
      <div class="flex-1">
        <h3 class="mb-2 text-lg font-semibold text-gray-900">{{ t('transcriptions.list.meetingId') }}: {{ item.meeting_id }}</h3>
        <div class="mb-4 text-sm text-gray-600">
          <img :src="'/CC0.png'" alt="CC0" class="h-8 w-auto" />
          <!-- eslint-disable-next-line vue/no-v-html -->
          <div v-html="renderOutlinePreview(item.outline)" class="transcription-outline prose prose-sm max-w-none"></div>
        </div>
      </div>

      <div class="ml-4 flex flex-col space-y-4">
        <button @click="emit('show-outline', item)" class="rounded-md bg-green-600 px-3 py-1 text-sm text-white hover:bg-green-700">
          {{ t('transcriptions.list.viewOutline') }}
        </button>
        <!-- app.css 的 `.container a:not(.vt-btn)` 會把連結染成民主紅，紫底上對比不足，故以 !text-white 覆蓋 -->
        <RouterLink :to="`/transcription_detail/${item.meeting_id}`" class="rounded-md bg-purple-600 px-3 py-1 text-center text-sm !text-white hover:bg-purple-700">
          {{ t('transcriptions.list.viewDetail') }}
        </RouterLink>
        <button @click="emit('download', item.meeting_id)" class="rounded-md bg-blue-600 px-3 py-1 text-sm text-white hover:bg-blue-700">
          {{ t('transcriptions.list.download') }}
        </button>
        <button @click="emit('copy-link', item.meeting_id)" class="rounded-md bg-gray-600 px-3 py-1 text-sm text-white hover:bg-gray-700">
          {{ t('transcriptions.list.copyLink') }}
        </button>
        <!-- 歷史版本僅管理模式顯示：舊版本可能含後續被修正的內容，不隨公開列表一起露出 -->
        <button v-if="manage" @click="emit('show-versions', item.meeting_id)" class="rounded-md bg-amber-600 px-3 py-1 text-sm text-white hover:bg-amber-700">
          {{ t('transcriptions.versions.button') }}
        </button>
      </div>
    </div>

    <div class="mt-2 text-xs text-gray-500">{{ t('transcriptions.list.fileName') }}: transcript-{{ formatMeetingId(item.meeting_id) }}.txt</div>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { formatMeetingId, renderOutlinePreview, type Transcription } from '../lib/transcription-format'

const { t } = useI18n()

// 這場會議是逐字稿功能的樣稿資料，列表上以標籤標示
const PROTOTYPE_MEETING_ID = '20250621'

withDefaults(
  defineProps<{
    item: Transcription
    /** true 時顯示管理專用操作（目前為歷史版本）；公開列表頁為 false */
    manage?: boolean
  }>(),
  { manage: false }
)

const emit = defineEmits<{
  'show-outline': [item: Transcription]
  download: [meetingId: string]
  'copy-link': [meetingId: string]
  'show-versions': [meetingId: string]
}>()
</script>
