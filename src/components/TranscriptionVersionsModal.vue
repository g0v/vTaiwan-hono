<template>
  <div class="bg-opacity-50 fixed inset-0 z-50 flex items-center justify-center bg-black p-4" @click="emit('close')">
    <div class="max-h-[80vh] w-full max-w-3xl overflow-y-auto rounded-lg bg-white" @click.stop>
      <div class="border-b border-gray-200 p-6">
        <div class="flex items-center justify-between">
          <h3 class="text-xl font-semibold">{{ t('transcriptions.versions.title') }} - {{ meetingId }}</h3>
          <button @click="emit('close')" class="text-gray-400 hover:text-gray-600" :aria-label="t('transcriptions.versions.close')">
            <svg class="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <p class="mt-2 text-sm text-gray-600">{{ t('transcriptions.versions.hint') }}</p>
      </div>

      <div class="max-h-[60vh] overflow-y-auto p-6">
        <p v-if="loading" class="py-6 text-center text-sm text-gray-500">{{ t('transcriptions.versions.loading') }}</p>
        <p v-else-if="error" class="py-6 text-center text-sm text-red-600">{{ error }}</p>
        <p v-else-if="versions.length === 0" class="py-6 text-center text-sm text-gray-500">{{ t('transcriptions.versions.empty') }}</p>
        <div v-else>
          <p v-if="truncated" class="mb-4 rounded-md border border-yellow-200 bg-yellow-50 px-4 py-2 text-sm text-yellow-800">
            {{ t('transcriptions.versions.truncated', { n: versions.length }) }}
          </p>
          <table class="w-full text-left text-sm">
            <thead>
              <tr class="border-b border-gray-200 text-gray-500">
                <th class="px-3 py-2 font-medium">{{ t('transcriptions.versions.col.uploadedAt') }}</th>
                <th class="hidden px-3 py-2 font-medium md:table-cell">{{ t('transcriptions.versions.col.uploadedBy') }}</th>
                <th class="px-3 py-2 font-medium">{{ t('transcriptions.versions.col.size') }}</th>
                <th class="px-3 py-2 font-medium">{{ t('transcriptions.versions.col.action') }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(version, index) in versions" :key="version.version_id" class="border-b border-gray-100">
                <td class="px-3 py-3 whitespace-nowrap text-gray-900">
                  {{ formatUploadedAt(version.uploaded_at) }}
                  <!-- 被截斷時排在最前的未必真的是最新版本（R2 list 由舊往新掃），此時不掛標籤 -->
                  <span v-if="index === 0 && !truncated" class="ml-2 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                    {{ t('transcriptions.versions.latest') }}
                  </span>
                </td>
                <td class="hidden px-3 py-3 text-gray-600 md:table-cell">{{ version.uploaded_by || '—' }}</td>
                <td class="px-3 py-3 whitespace-nowrap text-gray-600">{{ formatSize(version.size) }}</td>
                <td class="px-3 py-3">
                  <button
                    type="button"
                    :disabled="downloadingId === version.version_id"
                    class="rounded-md bg-blue-600 px-3 py-1 text-sm text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-300"
                    @click="download(version)"
                  >
                    {{ downloadingId === version.version_id ? t('transcriptions.versions.downloading') : t('transcriptions.versions.download') }}
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div class="flex justify-end border-t border-gray-200 p-6">
        <button @click="emit('close')" class="rounded-md bg-gray-600 px-4 py-2 text-white hover:bg-gray-700">
          {{ t('transcriptions.versions.close') }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { formatMeetingId } from '../lib/transcription-format'
import type { TranscriptionVersion } from '../lib/transcription-versions'

const { t } = useI18n()

const props = defineProps<{
  meetingId: string
}>()

// 列出／下載版本皆為讀取操作，伺服器只驗權限不驗 session 新鮮度，故無二次驗證分支
const emit = defineEmits<{
  close: []
}>()

const versions = ref<TranscriptionVersion[]>([])
const truncated = ref(false)
const loading = ref(true)
const error = ref('')
const downloadingId = ref<string | null>(null)

// 時間格式化只在瀏覽器端執行（此元件由事件開啟，SSR 不渲染），可安全使用本地時區
function formatUploadedAt(epochMs: number): string {
  const date = new Date(epochMs)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

async function loadVersions() {
  try {
    loading.value = true
    error.value = ''
    const response = await fetch(`/api/transcriptions/${props.meetingId}/versions`)
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`)
    const data = (await response.json()) as { versions: TranscriptionVersion[]; truncated: boolean }
    versions.value = data.versions
    truncated.value = data.truncated
  } catch (err) {
    console.error('載入逐字稿版本失敗:', err)
    error.value = t('transcriptions.versions.loadError')
  } finally {
    loading.value = false
  }
}

async function download(version: TranscriptionVersion) {
  downloadingId.value = version.version_id
  try {
    const response = await fetch(`/api/transcriptions/${props.meetingId}/versions/${version.version_id}/text`)
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`)
    const blob = await response.blob()
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `transcript-${formatMeetingId(props.meetingId)}-${version.version_id}.txt`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  } catch (err) {
    console.error('下載版本失敗:', err)
    alert(t('transcriptions.versions.downloadError'))
  } finally {
    downloadingId.value = null
  }
}

onMounted(() => {
  void loadVersions()
})
</script>
