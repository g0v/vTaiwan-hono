<template>
  <div class="container mx-auto px-4 py-8">
    <div class="mx-auto max-w-6xl">
      <!-- 頁面標題 -->
      <div class="mb-8">
        <h1 class="mb-4 text-3xl font-bold text-gray-900">{{ t('transcriptions.title') }}</h1>
        <p class="text-gray-600">{{ t('transcriptions.description') }}</p>
      </div>

      <!-- 上傳區域（需登入） -->
      <div v-if="props.user" class="mb-8 rounded-lg bg-white p-6 shadow-md">
        <h2 class="mb-4 text-xl font-semibold">{{ t('transcriptions.upload.title') }}</h2>
        <p class="text-gray-600">{{ t('transcriptions.upload.description') }}</p>
        <div class="space-y-4">
          <div>
            <input
              type="file"
              ref="fileInput"
              @change="handleFileSelect"
              accept=".txt,.srt,.md"
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
      <div v-else class="mb-8 rounded-lg border border-yellow-200 bg-yellow-50 p-6">
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

        <input type="text" v-model="search" placeholder="Search..." class="mb-4 w-full rounded-md border border-gray-300 p-2" />

        <div class="flex flex-col-reverse gap-4">
          <div v-for="item in filteredTranscriptions" :key="item.meeting_id" class="relative rounded-lg border border-gray-200 bg-white p-6 shadow-md">
            <!-- 樣稿標籤 -->
            <div v-if="item.meeting_id === '20250621'" class="absolute -top-2 -right-2 z-10">
              <div class="rotate-12 transform bg-yellow-400 px-3 py-1 text-xs font-bold text-black shadow-md">
                {{ locale === 'zh-TW' ? '樣稿' : 'Prototype' }}
              </div>
            </div>

            <div class="flex items-start justify-between">
              <div class="flex-1">
                <h3 class="mb-2 text-lg font-semibold text-gray-900">{{ t('transcriptions.list.meetingId') }}: {{ item.meeting_id }}</h3>
                <div class="mb-4 text-sm text-gray-600">
                  <img :src="'/CC0.png'" alt="CC0" class="h-8 w-auto" />
                  <!-- eslint-disable-next-line vue/no-v-html -->
                  <div v-html="getRenderedOutlinePreview(item.outline)" class="prose prose-sm max-w-none"></div>
                </div>
              </div>

              <div class="ml-4 flex flex-col space-y-4">
                <button @click="showOutline(item.outline, item.meeting_id)" class="rounded-md bg-green-600 px-3 py-1 text-sm text-white hover:bg-green-700">
                  {{ t('transcriptions.list.viewOutline') }}
                </button>
                <RouterLink :to="`/transcription_detail/${item.meeting_id}`" class="rounded-md bg-purple-600 px-3 py-1 text-center text-sm text-white hover:bg-purple-700">
                  {{ t('transcriptions.list.viewDetail') }}
                </RouterLink>
                <button @click="downloadTranscription(item.meeting_id)" class="rounded-md bg-blue-600 px-3 py-1 text-sm text-white hover:bg-blue-700">
                  {{ t('transcriptions.list.download') }}
                </button>
                <button @click="copyTranscriptionLink(item.meeting_id)" class="rounded-md bg-gray-600 px-3 py-1 text-sm text-white hover:bg-gray-700">
                  {{ t('transcriptions.list.copyLink') }}
                </button>
              </div>
            </div>

            <div class="mt-2 text-xs text-gray-500">{{ t('transcriptions.list.fileName') }}: transcript-{{ formatMeetingId(item.meeting_id) }}.txt</div>
          </div>
        </div>
      </div>

      <!-- 空狀態 -->
      <div v-if="!loading && transcriptions.length === 0" class="py-12 text-center">
        <p class="text-gray-500">{{ t('transcriptions.list.empty') }}</p>
      </div>
    </div>

    <!-- 大綱彈出視窗 -->
    <div v-if="showOutlineModal" class="bg-opacity-50 fixed inset-0 z-50 flex items-center justify-center bg-black p-4" @click="closeOutlineModal">
      <div class="max-h-[80vh] w-full max-w-4xl overflow-y-auto rounded-lg bg-white" @click.stop>
        <div class="border-b border-gray-200 p-6">
          <div class="flex items-center justify-between">
            <h3 class="text-xl font-semibold">{{ t('transcriptions.outline.title') }} - {{ currentOutlineMeetingId }}</h3>
            <button @click="closeOutlineModal" class="text-gray-400 hover:text-gray-600">
              <svg class="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <div class="max-h-[60vh] overflow-y-auto p-6">
          <div class="mb-4 flex items-center">
            <img :src="'/CC0.png'" alt="CC0" class="h-8 w-auto" />
          </div>
          <!-- eslint-disable-next-line vue/no-v-html -->
          <div v-if="!editing" v-html="renderedOutline" class="prose prose-sm max-w-none"></div>
          <textarea v-else v-model="myOutline" class="h-full max-h-[60vh] min-h-[200px] w-full"></textarea>
        </div>

        <div class="flex flex-col items-center justify-between border-t border-gray-200 p-6 md:flex-row">
          <button @click="copyOutline" class="flex items-center space-x-2 rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-700">
            <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
              />
            </svg>
            <span>{{ t('transcriptions.outline.copy') }}</span>
          </button>
          <button v-if="props.userData?.uid" @click="toggleEditOutline" class="flex items-center space-x-2 rounded-md bg-green-600 px-4 py-2 text-white hover:bg-green-700">
            <svg v-if="!editing" class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
              />
            </svg>
            <svg v-else class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 5v14h14V5H5zm4 0v4h6V5H9zm0 6v6h6v-6H9z" />
            </svg>
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

interface Transcription {
  meeting_id: string
  transcription: string
  outline: string
}

interface UserData {
  uid?: string
  isAdmin?: boolean
  isSuperAdmin?: boolean
}

const { locale, t } = useI18n()

const props = defineProps<{
  user?: unknown
  userData?: UserData | null
}>()

marked.setOptions({ breaks: true, gfm: true })

const isAdmin = computed(() => props.userData?.isAdmin === true || props.userData?.isSuperAdmin === true)

const transcriptions = ref<Transcription[]>([])
const loading = ref(true)
const error = ref('')
const uploading = ref(false)
const selectedFile = ref<File | null>(null)
const fileInput = ref<HTMLInputElement | null>(null)

const showOutlineModal = ref(false)
const currentOutline = ref('')
const currentOutlineMeetingId = ref('')
const editing = ref(false)
const myOutline = ref('')
const search = ref('')

const renderedOutline = computed(() => (currentOutline.value ? marked(currentOutline.value) : ''))

const filteredTranscriptions = computed(() => transcriptions.value.filter(item => item.meeting_id.includes(search.value) || item.outline.includes(search.value)))

function getRenderedOutlinePreview(outline: string): string {
  if (!outline) return ''
  const truncated = outline.length > 500 ? outline.substring(0, 500) + '...' : outline
  return marked(truncated) as string
}

function formatMeetingId(id: string): string {
  if (id.length === 8) {
    return `${id.substring(0, 4)}-${id.substring(4, 6)}-${id.substring(6, 8)}`
  }
  return id
}

function extractMeetingIdFromFilename(filename: string): string {
  const match = filename.match(/transcript-(\d{4}-\d{2}-\d{2})/)
  return match ? match[1].replace(/-/g, '') : ''
}

function checkMeetingExists(meetingId: string): boolean {
  return transcriptions.value.some(item => item.meeting_id === meetingId)
}

// --- 資料操作（全部在事件處理器內，SSR 不執行） ---

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

function showOutline(outline: string, meetingId: string) {
  currentOutline.value = outline
  currentOutlineMeetingId.value = meetingId
  showOutlineModal.value = true
}

function closeOutlineModal() {
  showOutlineModal.value = false
  currentOutline.value = ''
  currentOutlineMeetingId.value = ''
}

async function copyOutline() {
  try {
    await navigator.clipboard.writeText(currentOutline.value)
    alert(t('transcriptions.outline.copySuccess'))
  } catch {
    // 降級：execCommand
    const textArea = document.createElement('textarea')
    textArea.value = currentOutline.value
    document.body.appendChild(textArea)
    textArea.select()
    try {
      document.execCommand('copy')
      alert(t('transcriptions.outline.copySuccess'))
    } catch {
      // ignore
    }
    document.body.removeChild(textArea)
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

function startEditOutline() {
  if (!isAdmin.value) {
    alert(t('transcriptions.outline.editRequireAdmin'))
    return
  }
  myOutline.value = currentOutline.value
  editing.value = true
}

async function endEditOutline() {
  editing.value = false
  try {
    const response = await fetch('/api/update-outline', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ meeting_id: currentOutlineMeetingId.value, outline: myOutline.value }),
    })
    if (response.ok) {
      currentOutline.value = myOutline.value
      const idx = transcriptions.value.findIndex(item => item.meeting_id === currentOutlineMeetingId.value)
      if (idx !== -1) transcriptions.value[idx].outline = myOutline.value
    }
  } catch (err) {
    console.error('更新大綱失敗:', err)
  } finally {
    myOutline.value = ''
  }
}

function cancelEditOutline() {
  editing.value = false
  myOutline.value = ''
}

async function toggleEditOutline() {
  if (!editing.value) {
    startEditOutline()
  } else {
    await endEditOutline()
  }
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

<style scoped>
textarea {
  border: 2px solid #000000;
  border-radius: 4px;
  padding: 8px;
  font-size: 14px;
  resize: vertical;
}
</style>
