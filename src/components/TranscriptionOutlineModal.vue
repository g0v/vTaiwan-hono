<template>
  <div class="bg-opacity-50 fixed inset-0 z-50 flex items-center justify-center bg-black p-4" @click="emit('close')">
    <div class="max-h-[80vh] w-full max-w-4xl overflow-y-auto rounded-lg bg-white" @click.stop>
      <div class="border-b border-gray-200 p-6">
        <div class="flex items-center justify-between">
          <h3 class="text-xl font-semibold">{{ t('transcriptions.outline.title') }} - {{ meetingId }}</h3>
          <button @click="emit('close')" class="text-gray-400 hover:text-gray-600" :aria-label="t('transcriptions.outline.close')">
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
        <div v-if="!editing" v-html="renderedOutline" class="transcription-outline prose prose-sm max-w-none"></div>
        <textarea v-else v-model="draft" class="h-full max-h-[60vh] min-h-[200px] w-full"></textarea>
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
        <button v-if="showEdit" @click="toggleEdit" class="flex items-center space-x-2 rounded-md bg-green-600 px-4 py-2 text-white hover:bg-green-700">
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
        <button v-if="editing" @click="cancelEdit" class="rounded-md bg-red-600 px-4 py-2 text-white hover:bg-red-700">
          {{ t('transcriptions.outline.cancel') }}
        </button>
        <button @click="emit('close')" class="rounded-md bg-gray-600 px-4 py-2 text-white hover:bg-gray-700">
          {{ t('transcriptions.outline.close') }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { renderMarkdown } from '../lib/transcription-format'

const { t } = useI18n()

const props = defineProps<{
  meetingId: string
  outline: string
  /** 是否顯示編輯鈕（已登入） */
  showEdit: boolean
  /** 是否真的允許編輯（管理員）；false 時按下會提示權限不足 */
  allowEdit: boolean
}>()

const emit = defineEmits<{
  close: []
  save: [outline: string]
}>()

const editing = ref(false)
const draft = ref('')

const renderedOutline = computed(() => (props.outline ? renderMarkdown(props.outline) : ''))

// 以下互動皆只在瀏覽器端觸發（事件處理器），SSR 期間不執行
async function copyOutline() {
  try {
    await navigator.clipboard.writeText(props.outline)
    alert(t('transcriptions.outline.copySuccess'))
  } catch {
    // 降級：execCommand
    const textArea = document.createElement('textarea')
    textArea.value = props.outline
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

function toggleEdit() {
  if (!editing.value) {
    if (!props.allowEdit) {
      alert(t('transcriptions.outline.editRequireAdmin'))
      return
    }
    draft.value = props.outline
    editing.value = true
    return
  }
  editing.value = false
  emit('save', draft.value)
  draft.value = ''
}

function cancelEdit() {
  editing.value = false
  draft.value = ''
}
</script>

<style scoped>
/* .transcription-outline 的表格樣式為全站共用，定義在 src/styles/app.css */
textarea {
  border: 2px solid var(--color-vt-border-strong);
  border-radius: var(--radius-vt-sm);
  padding: var(--spacing-vt-2);
  font-size: var(--text-vt-sm);
  resize: vertical;
}
</style>
