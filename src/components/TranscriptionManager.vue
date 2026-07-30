<template>
  <div>
    <!-- 上傳區域（僅管理模式；需登入） -->
    <template v-if="manage">
      <div v-if="canUpdateTranscriptions" class="mb-8 rounded-lg bg-white p-6 shadow-md">
        <h2 class="mb-4 text-xl font-semibold">{{ t('transcriptions.upload.title') }}</h2>
        <p class="text-gray-600">{{ t('transcriptions.upload.description') }}</p>
        <div class="space-y-4">
          <div>
            <input
              type="file"
              ref="fileInput"
              @change="handleFileSelect"
              accept=".txt,.srt,.md"
              :aria-label="t('transcriptions.upload.selectFile')"
              class="block w-full text-sm text-gray-500 file:mr-4 file:rounded-full file:border-0 file:bg-blue-50 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-blue-700 hover:file:bg-blue-100"
            />
          </div>
          <button
            @click="uploadTranscription"
            :disabled="!selectedFile || uploading"
            class="rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-300"
          >
            {{ uploading ? t('transcriptions.upload.uploading') : t('transcriptions.upload.uploadButton') }}
          </button>
        </div>
      </div>

      <!-- 未登入提示 -->
      <div v-else-if="!authSession" class="mb-8 rounded-lg border border-yellow-200 bg-yellow-50 p-6">
        <div class="flex items-center">
          <svg class="mr-2 h-5 w-5 text-yellow-600" fill="currentColor" viewBox="0 0 20 20">
            <path
              fill-rule="evenodd"
              d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
              clip-rule="evenodd"
            />
          </svg>
          <p class="text-yellow-700">{{ t('transcriptions.upload.loginRequired') }}</p>
        </div>
      </div>
    </template>

    <!-- 載入狀態 -->
    <div v-if="loading" class="flex items-center justify-center py-12">
      <div class="h-12 w-12 animate-spin rounded-full border-b-2 border-blue-600"></div>
    </div>

    <!-- 錯誤訊息 -->
    <div v-if="error" class="mb-6 rounded-sm border border-red-400 bg-red-100 px-4 py-3 text-red-700">
      {{ error }}
    </div>

    <!-- 逐字稿列表 -->
    <div v-if="!loading && transcriptions.length > 0" class="space-y-4">
      <h2 class="mb-4 text-xl font-semibold">{{ t('transcriptions.list.title') }}</h2>

      <SearchInput
        v-model="search"
        class="mb-4"
        :placeholder="t('transcriptions.search.placeholder')"
        :label="t('transcriptions.search.label')"
        :clear-label="t('transcriptions.search.clearSearch')"
      />

      <p v-if="filteredTranscriptions.length === 0" class="py-6 text-center text-sm text-gray-500">
        {{ t('transcriptions.search.noResults', { query: search.trim() }) }}
      </p>
      <div v-else class="flex flex-col-reverse gap-4">
        <TranscriptionCard
          v-for="item in filteredTranscriptions"
          :key="item.meeting_id"
          :item="item"
          @show-outline="showOutline"
          @download="downloadTranscription"
          @copy-link="copyTranscriptionLink"
        />
      </div>
    </div>

    <!-- 空狀態 -->
    <div v-if="!loading && transcriptions.length === 0" class="py-12 text-center">
      <p class="text-gray-500">{{ t('transcriptions.list.empty') }}</p>
    </div>

    <!-- 大綱彈出視窗 -->
    <TranscriptionOutlineModal
      v-if="currentOutlineItem"
      :meeting-id="currentOutlineItem.meeting_id"
      :outline="currentOutlineItem.outline"
      :show-edit="canShowEdit"
      :allow-edit="canUpdateTranscriptions"
      @close="currentOutlineItem = null"
      @save="saveOutline"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { hasPermission, type AuthSession } from '../client/auth-session'
import SearchInput from './SearchInput.vue'
import TranscriptionCard from './TranscriptionCard.vue'
import TranscriptionOutlineModal from './TranscriptionOutlineModal.vue'
import { extractMeetingIdFromFilename, formatMeetingId, matchesTranscriptionQuery, type Transcription } from '../lib/transcription-format'

const { t } = useI18n()

const props = withDefaults(
  defineProps<{
    /** true 時開放上傳與大綱編輯（管理後台 tab 3）；false 為唯讀瀏覽（公開列表頁） */
    manage?: boolean
    authSession?: AuthSession | null
  }>(),
  { manage: false, authSession: null }
)

const canUpdateTranscriptions = computed(() => props.manage && hasPermission(props.authSession, 'transcription.update'))
const canShowEdit = computed(() => canUpdateTranscriptions.value)

const transcriptions = ref<Transcription[]>([])
const loading = ref(true)
const error = ref('')
const uploading = ref(false)
const selectedFile = ref<File | null>(null)
const fileInput = ref<HTMLInputElement | null>(null)
const search = ref('')
const currentOutlineItem = ref<Transcription | null>(null)

const filteredTranscriptions = computed(() => transcriptions.value.filter(item => matchesTranscriptionQuery(item, search.value)).sort((a, b) => a.meeting_id.localeCompare(b.meeting_id)))

function checkMeetingExists(meetingId: string): boolean {
  return transcriptions.value.some(item => item.meeting_id === meetingId)
}

// --- 資料操作（全部在 onMounted / 事件處理器內，SSR 不執行） ---

async function loadTranscriptions() {
  try {
    loading.value = true
    error.value = ''
    const response = await fetch('/api/query-table')
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`)
    transcriptions.value = (await response.json()) as Transcription[]
  } catch (err) {
    console.error('載入逐字稿失敗:', err)
    error.value = t('transcriptions.messages.loadError')
  } finally {
    loading.value = false
  }
}

function handleFileSelect(event: Event) {
  const target = event.target as HTMLInputElement
  if (target.files && target.files.length > 0) {
    selectedFile.value = target.files[0]
  }
}

async function uploadTranscription() {
  if (!selectedFile.value) {
    alert(t('transcriptions.messages.selectFileFirst'))
    return
  }
  const meetingId = extractMeetingIdFromFilename(selectedFile.value.name)
  if (!meetingId) {
    alert(t('transcriptions.messages.invalidFileName'))
    return
  }
  if (checkMeetingExists(meetingId)) {
    if (!canUpdateTranscriptions.value) {
      alert(t('transcriptions.messages.existsRequireAdmin'))
      return
    }
    if (!window.confirm(t('transcriptions.messages.confirmUpdate', { meetingId }))) return
  }

  try {
    uploading.value = true
    const formData = new FormData()
    formData.append('file', selectedFile.value)
    const response = await fetch('/api/upload-transcription', { method: 'POST', body: formData })
    if (!response.ok) throw new Error(`上傳失敗: ${response.status}`)
    alert(t('transcriptions.messages.uploadSuccess'))
    await loadTranscriptions()
    selectedFile.value = null
    if (fileInput.value) fileInput.value.value = ''
  } catch (err) {
    console.error('上傳失敗:', err)
    alert(t('transcriptions.messages.uploadError'))
  } finally {
    uploading.value = false
  }
}

function showOutline(item: Transcription) {
  currentOutlineItem.value = item
}

async function saveOutline(outline: string) {
  const meetingId = currentOutlineItem.value?.meeting_id
  if (!meetingId) return
  try {
    const response = await fetch('/api/update-outline', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ meeting_id: meetingId, outline }),
    })
    if (response.ok) {
      const item = transcriptions.value.find(entry => entry.meeting_id === meetingId)
      if (item) item.outline = outline
      if (currentOutlineItem.value) currentOutlineItem.value = { ...currentOutlineItem.value, outline }
    }
  } catch (err) {
    console.error('更新大綱失敗:', err)
  }
}

function copyTranscriptionLink(meetingId: string) {
  // 使用同源相對路徑；複製連結帶完整 origin 以便分享
  const url = `${window.location.origin}/api/transcriptions/${meetingId}/text`
  navigator.clipboard.writeText(url).catch(() => {
    // 降級忽略
  })
  alert(t('transcriptions.list.copyLinkSuccess'))
}

function downloadTranscription(meetingId: string) {
  fetch(`/api/transcriptions/${meetingId}/text`, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  })
    .then(r => r.text())
    .then(text => {
      const link = document.createElement('a')
      link.href = 'data:text/plain;charset=utf-8,' + encodeURIComponent(text)
      link.download = `transcript-${formatMeetingId(meetingId)}.txt`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    })
    .catch(err => console.error('下載失敗:', err))
}

// 資料抓取在 onMounted（SSR 不執行）
onMounted(() => {
  void loadTranscriptions()
})
</script>
