<template>
  <div class="container mx-auto px-4 py-8">
    <div class="mx-auto max-w-6xl">
      <!-- 頁面標題 -->
      <div class="mb-8">
        <h1 class="mb-2 text-3xl font-bold text-gray-900">{{ t('transcriptions.title') }}</h1>
        <p class="text-gray-600">{{ t('transcriptions.description') }}</p>
      </div>

      <!-- 上傳區域（僅登入用戶可見） -->
      <div v-if="user" class="mb-8 rounded-lg bg-white p-6 shadow-md">
        <h2 class="mb-4 text-xl font-semibold">{{ t('transcriptions.upload.title') }}</h2>
        <p class="mb-4 text-sm text-gray-600">{{ t('transcriptions.upload.description') }}</p>
        <div class="flex items-center gap-4">
          <input
            ref="fileInput"
            type="file"
            accept=".txt"
            @change="handleFileSelect"
            class="hidden"
          />
          <button
            @click="fileInput?.click()"
            class="rounded-md border border-gray-300 px-4 py-2 text-sm hover:bg-gray-50"
          >
            {{ selectedFile ? selectedFile.name : t('transcriptions.upload.selectFile') }}
          </button>
          <button
            @click="uploadTranscription"
            :disabled="!selectedFile || uploading"
            class="rounded-md bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {{ uploading ? t('transcriptions.upload.uploading') : t('transcriptions.upload.uploadButton') }}
          </button>
        </div>
      </div>

      <!-- 未登入提示 -->
      <div v-else class="mb-8 rounded-lg border border-yellow-200 bg-yellow-50 p-6">
        <p class="text-yellow-800">{{ t('transcriptions.upload.loginRequired') }}</p>
      </div>

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

        <input
          type="text"
          v-model="search"
          placeholder="Search..."
          class="mb-4 w-full rounded-md border border-gray-300 p-2"
        />

        <div class="flex flex-col-reverse gap-4">
          <div
            v-for="transcription in filteredTranscriptions"
            :key="transcription.meeting_id"
            class="relative rounded-lg border border-gray-200 bg-white p-6 shadow-md"
          >
            <!-- 樣稿標籤 -->
            <div v-if="transcription.meeting_id === '20250621'" class="absolute -right-2 -top-2 z-10">
              <div class="rotate-12 transform bg-yellow-400 px-3 py-1 text-xs font-bold text-black shadow-md">
                {{ locale === 'zh-TW' ? '樣稿' : 'Prototype' }}
              </div>
            </div>

            <div class="flex items-start justify-between">
              <div class="flex-1">
                <h3 class="mb-2 text-lg font-semibold text-gray-900">
                  {{ t('transcriptions.list.meetingId') }}: {{ transcription.meeting_id }}
                </h3>
                <div class="mb-4 text-sm text-gray-600">
                  <img src="/img/CC0.png" alt="CC0" class="mb-2 h-8 w-auto" />
                  <div v-html="getRenderedOutlinePreview(transcription.outline)" class="prose prose-sm max-w-none"></div>
                </div>
              </div>

              <div class="ml-4 flex flex-col space-y-4">
                <button
                  @click="showOutline(transcription.outline, transcription.meeting_id)"
                  class="rounded-md bg-green-600 px-3 py-1 text-sm text-white hover:bg-green-700"
                >
                  {{ t('transcriptions.list.viewOutline') }}
                </button>
                <RouterLink
                  :to="`/transcription_detail/${transcription.meeting_id}`"
                  class="rounded-md bg-purple-600 px-3 py-1 text-center text-sm text-white hover:bg-purple-700"
                >
                  {{ t('transcriptions.list.viewDetail') }}
                </RouterLink>
                <button
                  @click="downloadTranscription(transcription.meeting_id)"
                  class="rounded-md bg-blue-600 px-3 py-1 text-sm text-white hover:bg-blue-700"
                >
                  {{ t('transcriptions.list.download') }}
                </button>
                <button
                  @click="copyTranscriptionLink(transcription.meeting_id)"
                  class="rounded-md bg-gray-600 px-3 py-1 text-sm text-white hover:bg-gray-700"
                >
                  {{ t('transcriptions.list.copyLink') }}
                </button>
              </div>
            </div>

            <div class="mt-2 text-xs text-gray-500">
              {{ t('transcriptions.list.fileName') }}: transcript-{{ formatMeetingId(transcription.meeting_id) }}.txt
            </div>
          </div>
        </div>
      </div>

      <!-- 空狀態 -->
      <div v-if="!loading && transcriptions.length === 0" class="py-12 text-center">
        <p class="text-gray-500">{{ t('transcriptions.list.empty') }}</p>
      </div>
    </div>

    <!-- 大綱彈出視窗 -->
    <div
      v-if="showOutlineModal"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4"
      @click="closeOutlineModal"
    >
      <div class="max-h-[80vh] w-full max-w-4xl overflow-y-auto rounded-lg bg-white" @click.stop>
        <div class="border-b border-gray-200 p-6">
          <div class="flex items-center justify-between">
            <h3 class="text-xl font-semibold">
              {{ t('transcriptions.outline.title') }} - {{ currentOutlineMeetingId }}
            </h3>
            <button @click="closeOutlineModal" class="text-gray-400 hover:text-gray-600">
              <svg class="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <div class="max-h-[60vh] overflow-y-auto p-6">
          <img src="/img/CC0.png" alt="CC0" class="mb-4 h-8 w-auto" />
          <div v-if="!editing" v-html="renderedOutline" class="prose prose-sm max-w-none"></div>
          <textarea v-else v-model="myOutline" class="h-full max-h-[60vh] min-h-[200px] w-full"></textarea>
        </div>

        <div class="flex flex-col items-center justify-between border-t border-gray-200 p-6 md:flex-row">
          <button @click="copyOutline" class="flex items-center space-x-2 rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-700">
            <span>{{ t('transcriptions.outline.copy') }}</span>
          </button>
          <button
            v-if="user && isAdmin"
            @click="toggleEditOutline"
            class="flex items-center space-x-2 rounded-md bg-green-600 px-4 py-2 text-white hover:bg-green-700"
          >
            <span>{{ editing ? t('transcriptions.outline.saveAndEndEdit') : t('transcriptions.outline.edit') }}</span>
          </button>
          <button v-if="editing" @click="cancelEditOutline" class="rounded-md bg-red-600 px-4 py-2 text-white hover:bg-red-700">
            {{ t('transcriptions.outline.cancel') }}
          </button>
          <button @click="closeOutlineModal" class="rounded-md bg-gray-600 px-4 py-2 text-white hover:bg-gray-700">
            {{ t('transcriptions.outline.close') }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { marked } from 'marked'

// marked 設定
marked.setOptions({ breaks: true, gfm: true } as Parameters<typeof marked.setOptions>[0])

interface Transcription {
  meeting_id: string
  transcription: string
  outline: string
}

const { t, locale } = useI18n()

// Props（登入狀態由 App.vue 層傳下）
const props = defineProps<{
  user?: object | null
  userData?: { isAdmin?: boolean; isSuperAdmin?: boolean } | null
}>()

// 狀態
const transcriptions = ref<Transcription[]>([])
const loading = ref(true)
const error = ref('')
const uploading = ref(false)
const selectedFile = ref<File | null>(null)
const fileInput = ref<HTMLInputElement>()
const search = ref('')
const showOutlineModal = ref(false)
const currentOutline = ref('')
const currentOutlineMeetingId = ref('')
const editing = ref(false)
const myOutline = ref('')

const isAdmin = computed(() =>
  !!props.userData && (props.userData.isAdmin === true || props.userData.isSuperAdmin === true)
)

const filteredTranscriptions = computed(() =>
  transcriptions.value.filter(
    (t) => t.meeting_id.includes(search.value) || t.outline.includes(search.value)
  )
)

const renderedOutline = computed(() =>
  currentOutline.value ? String(marked(currentOutline.value)) : ''
)

const getRenderedOutlinePreview = (outline: string): string => {
  if (!outline) return ''
  const truncated = outline.length > 500 ? outline.substring(0, 500) + '...' : outline
  return String(marked(truncated))
}

const formatMeetingId = (meetingId: string): string => {
  if (meetingId.length === 8) {
    return `${meetingId.substring(0, 4)}-${meetingId.substring(4, 6)}-${meetingId.substring(6, 8)}`
  }
  return meetingId
}

// API 呼叫（透過 /api/transcriptions/* 代理）
const TRANSCRIPTION_API = '/api/transcriptions'

const loadTranscriptions = async () => {
  try {
    loading.value = true
    error.value = ''
    const response = await fetch(`${TRANSCRIPTION_API}/query-table`)
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`)
    transcriptions.value = await response.json()
  } catch (err) {
    console.error('載入逐字稿失敗:', err)
    error.value = t('transcriptions.messages.loadError')
  } finally {
    loading.value = false
  }
}

const handleFileSelect = (event: Event) => {
  const target = event.target as HTMLInputElement
  if (target.files && target.files.length > 0) {
    selectedFile.value = target.files[0]
  }
}

const extractMeetingIdFromFilename = (filename: string): string => {
  const match = filename.match(/transcript-(\d{4}-\d{2}-\d{2})/)
  if (match) return match[1].replace(/-/g, '')
  return ''
}

const uploadTranscription = async () => {
  if (!selectedFile.value) {
    alert(t('transcriptions.messages.selectFileFirst'))
    return
  }
  const meetingId = extractMeetingIdFromFilename(selectedFile.value.name)
  if (!meetingId) {
    alert(t('transcriptions.messages.invalidFileName'))
    return
  }
  const exists = transcriptions.value.some((t) => t.meeting_id === meetingId)
  if (exists) {
    if (!isAdmin.value) {
      alert(t('transcriptions.messages.existsRequireAdmin'))
      return
    }
    if (!window.confirm(t('transcriptions.messages.confirmUpdate', { meetingId }))) return
  }

  try {
    uploading.value = true
    const formData = new FormData()
    formData.append('file', selectedFile.value)
    const response = await fetch(`${TRANSCRIPTION_API}/upload-transcription`, {
      method: 'POST',
      body: formData,
    })
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

const showOutline = (outline: string, meetingId: string) => {
  currentOutline.value = outline
  currentOutlineMeetingId.value = meetingId
  showOutlineModal.value = true
}

const closeOutlineModal = () => {
  showOutlineModal.value = false
  currentOutline.value = ''
  currentOutlineMeetingId.value = ''
  editing.value = false
}

const copyOutline = async () => {
  try {
    await navigator.clipboard.writeText(currentOutline.value)
    alert(t('transcriptions.outline.copySuccess'))
  } catch {
    alert(t('transcriptions.outline.copyError'))
  }
}

const copyTranscriptionLink = (meetingId: string) => {
  const url = `https://r2-vtaiwan.bestian.tw/${meetingId}.txt`
  navigator.clipboard.writeText(url).then(() => {
    alert(t('transcriptions.list.copyLinkSuccess'))
  })
}

const downloadTranscription = (meetingId: string) => {
  const url = `https://r2-vtaiwan.bestian.tw/${meetingId}.txt`
  fetch(url, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } }).then((res) => {
    res.text().then((text) => {
      const link = document.createElement('a')
      link.href = 'data:text/plain;charset=utf-8,' + encodeURIComponent(text)
      link.download = `transcript-${formatMeetingId(meetingId)}.txt`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    })
  })
}

const startEditOutline = () => {
  if (!isAdmin.value) {
    alert(t('transcriptions.outline.editRequireAdmin'))
    return
  }
  myOutline.value = currentOutline.value
  editing.value = true
}

const endEditOutline = async () => {
  editing.value = false
  try {
    const response = await fetch(`${TRANSCRIPTION_API}/update-outline`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        meeting_id: currentOutlineMeetingId.value,
        outline: myOutline.value,
      }),
    })
    if (response.ok) {
      currentOutline.value = myOutline.value
      const idx = transcriptions.value.findIndex(
        (t) => t.meeting_id === currentOutlineMeetingId.value
      )
      if (idx !== -1) transcriptions.value[idx].outline = myOutline.value
      myOutline.value = ''
    }
  } catch (err) {
    console.error('更新大綱失敗:', err)
  }
}

const cancelEditOutline = () => {
  editing.value = false
  myOutline.value = ''
}

const toggleEditOutline = () => {
  if (!editing.value) startEditOutline()
  else endEditOutline()
}

onMounted(() => {
  loadTranscriptions()
})
</script>
