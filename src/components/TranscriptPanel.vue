<template>
  <div class="transcript-panel flex h-full flex-col border-l border-gray-200 bg-white">
    <!-- 標題列 -->
    <div class="shrink-0 border-b border-gray-200 bg-gray-50 p-4">
      <div class="mb-2 flex items-center justify-between">
        <div>
          <h3 class="text-lg font-bold text-gray-900">
            {{ $t("transcript.title") }}
            <span class="text-sm text-gray-600">{{ $t("transcript.subtitle") }}</span>
          </h3>
        </div>
        <button
          @click="$emit('close')"
          class="rounded-lg p-2 transition hover:bg-gray-200 md:hidden"
          :title="$t('transcript.hideTranscript')"
        >
          <IconWrapper name="x" :size="20" />
        </button>
      </div>

      <!-- 日期選擇器 -->
      <div class="mb-3">
        <div class="flex items-center gap-2">
          <label class="text-sm font-medium text-gray-700"
            >{{ $t("transcript.selectDate") }}:</label
          >
          <input
            type="date"
            v-model="localDate"
            @change="onDateChange"
            class="rounded-sm border border-gray-300 px-2 py-1 text-sm focus:outline-hidden focus:ring-2 focus:ring-jade-green"
            :max="todayDate"
          />
        </div>
      </div>

      <!-- 控制按鈕 -->
      <div class="flex flex-wrap items-center gap-2">
        <button
          @click="toggleAutoScroll"
          :class="[
            'rounded-full px-3 py-1 text-xs transition',
            autoScroll ? 'bg-jade-green text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300',
          ]"
        >
          {{ $t("transcript.autoScroll") }}
        </button>

        <select v-model="fontSize" class="rounded-sm border border-gray-300 px-2 py-1 text-xs">
          <option value="small">{{ $t("transcript.fontSizeSmall") }}</option>
          <option value="medium">{{ $t("transcript.fontSizeMedium") }}</option>
          <option value="large">{{ $t("transcript.fontSizeLarge") }}</option>
        </select>

        <button
          @click="exportTranscript"
          class="rounded-sm bg-jade-green px-3 py-1 text-xs text-white transition hover:bg-jade-green/90"
        >
          {{ $t("transcript.exportTranscript") }}
        </button>
      </div>
    </div>

    <!-- 逐字稿內容 -->
    <div
      ref="transcriptContent"
      class="max-h-[50vh] shrink-0 space-y-2 overflow-y-auto p-4"
      :class="fontSizeClass"
    >
      <div
        v-if="Object.keys(transcriptDataEntries).length === 0"
        class="py-8 text-center text-gray-500"
      >
        <IconWrapper name="file-text" :size="48" class="mx-auto mb-4 text-gray-300" />
        <p>{{ $t("transcript.noContent") }}</p>
      </div>

      <div
        v-for="(entry, index) in Object.values(transcriptDataEntries)"
        :key="entry.timestamp"
        class="transcript-entry rounded-lg border border-gray-200 p-3 transition hover:border-gray-300"
      >
        <div class="mb-2 flex items-start justify-start md:justify-between">
          <div class="flex items-center gap-2 text-xs text-gray-500">
            <span>{{ formatTimestamp(entry.timestamp) }}</span>
            <span v-if="entry.speaker" class="font-medium">{{ entry.speaker }}</span>
          </div>
          <div class="flex items-center gap-1">
            <button
              @click="editEntry(index)"
              class="rounded-sm p-1 transition hover:bg-gray-100"
              :title="$t('transcript.edit')"
            >
              <IconWrapper name="edit" :size="14" />
            </button>
            <button
              @click="deleteEntry(index)"
              class="rounded-sm p-1 text-red-600 transition hover:bg-red-100"
              :title="$t('transcript.deleteEntry')"
            >
              <IconWrapper name="trash" :size="14" />
            </button>
          </div>
        </div>
        <div class="whitespace-pre-wrap text-gray-900" style="word-break: break-all">
          {{ entry.text }}
        </div>
      </div>
    </div>

    <!-- 手動輸入逐字稿 -->
    <div class="flex-1 space-y-3 overflow-y-auto p-4">
      <textarea
        v-model="manualTranscript"
        class="w-full resize-none rounded-sm border border-gray-300 px-2 py-1 text-sm"
        rows="3"
        :placeholder="$t('transcript.manualTranscript')"
      ></textarea>
      <div class="flex gap-2">
        <button
          @click="addManualTranscript"
          class="rounded-sm bg-jade-green px-3 py-1 text-xs text-white transition hover:bg-jade-green/90"
        >
          {{ $t("transcript.addManualTranscript") }}
        </button>
      </div>
    </div>

    <!-- 底部狀態列 -->
    <div class="shrink-0 border-t border-gray-200 bg-gray-50 p-3">
      <div class="flex items-center justify-between text-xs text-gray-500">
        <span>{{ Object.keys(transcriptDataEntries).length }} 條記錄</span>
        <div class="flex items-center gap-2">
          <div
            :class="['h-2 w-2 rounded-full', isConnected ? 'bg-jade-green' : 'bg-red-500']"
          ></div>
          <span>{{ isConnected ? "已連接" : $t("transcript.disconnected") }}</span>
        </div>
      </div>
    </div>

    <!-- 編輯彈出框 -->
    <div
      v-if="showEditModal"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50"
    >
      <div class="mx-4 flex max-h-[90vh] w-full max-w-4xl flex-col rounded-lg bg-white shadow-xl">
        <div class="flex items-center justify-between border-b border-gray-200 p-6">
          <h3 class="text-xl font-bold text-gray-900">{{ $t("transcript.editEntry") }}</h3>
          <button
            @click="cancelEdit"
            class="rounded-lg p-2 transition hover:bg-gray-100"
            :title="$t('transcript.close')"
          >
            <IconWrapper name="x" :size="24" />
          </button>
        </div>

        <div class="flex-1 overflow-y-auto p-6">
          <div class="space-y-4">
            <div class="text-sm text-gray-500">
              {{ $t("transcript.timestamp") }}: {{ formatTimestamp(editingEntry.timestamp) }}
            </div>
            <div>
              <label class="mb-2 block text-sm font-medium text-gray-700">
                {{ $t("transcript.speaker") }}
              </label>
              <input
                v-model="editingEntry.speaker"
                :placeholder="$t('transcript.speakerPlaceholder')"
                class="w-full rounded-lg border border-gray-300 px-4 py-3 text-base focus:border-transparent focus:ring-2 focus:ring-jade-green"
              />
            </div>
            <div>
              <label class="mb-2 block text-sm font-medium text-gray-700">
                {{ $t("transcript.content") }}
              </label>
              <textarea
                v-model="editingEntry.text"
                :placeholder="$t('transcript.contentPlaceholder')"
                class="w-full resize-none rounded-lg border border-gray-300 px-4 py-3 text-base focus:border-transparent focus:ring-2 focus:ring-jade-green"
                rows="12"
              ></textarea>
            </div>
          </div>
        </div>

        <div class="flex items-center justify-end gap-3 border-t border-gray-200 p-6">
          <button
            @click="cancelEdit"
            class="rounded-lg bg-gray-300 px-6 py-3 text-base text-gray-700 transition hover:bg-gray-400"
          >
            {{ $t("transcript.cancel") }}
          </button>
          <button
            @click="saveEntry"
            class="rounded-lg bg-jade-green px-6 py-3 text-base text-white transition hover:bg-jade-green/90"
          >
            {{ $t("transcript.save") }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, nextTick, watch } from "vue";
import { useI18n } from "vue-i18n";
import IconWrapper from "./IconWrapper.vue";

interface TranscriptEntry {
  speaker?: string;
  text: string;
  timestamp: number;
}

interface UserData {
  name?: string | null;
}

const props = defineProps<{
  userData?: UserData | null;
  transcriptData?: Record<string, TranscriptEntry>;
  isVisible?: boolean;
  isRecorder?: boolean;
  selectedDate?: string;
}>();

// 修正 neo 中未宣告的 emit（date-change）
const emit = defineEmits<{
  close: [];
  "add-data": [entry: TranscriptEntry];
  "i-am-recorder": [];
  "update-data": [entry: TranscriptEntry];
  "delete-data": [timestamp: number];
  "date-change": [date: string];
}>();

const { t } = useI18n();

const transcriptDataEntries = computed(() => props.transcriptData ?? {});

const autoScroll = ref(true);
const fontSize = ref("medium");
const isConnected = ref(true);
const editingIndex = ref(-1);
const editingEntry = ref<TranscriptEntry>({ speaker: "", text: "", timestamp: Date.now() });
const transcriptContent = ref<HTMLElement | null>(null);
const manualTranscript = ref("");
const showEditModal = ref(false);
const shouldScrollToEditedEntry = ref(false);
const localDate = ref(props.selectedDate ?? new Date().toISOString().split("T")[0]);

const todayDate = computed(() => {
  const d = new Date();
  d.setDate(d.getDate() + 2);
  return d.toISOString().split("T")[0];
});

watch(
  () => props.selectedDate,
  (newDate) => {
    if (newDate) localDate.value = newDate;
  },
);

watch(transcriptDataEntries, () => {
  if (autoScroll.value && !shouldScrollToEditedEntry.value) {
    void nextTick(scrollToBottom);
  }
});

const fontSizeClass = computed(() => {
  if (fontSize.value === "small") return "text-sm";
  if (fontSize.value === "large") return "text-lg";
  return "text-base";
});

function formatTimestamp(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString("zh-TW", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function scrollToBottom() {
  if (transcriptContent.value) {
    transcriptContent.value.scrollTop = transcriptContent.value.scrollHeight;
  }
}

function scrollToEditedEntry(index: number) {
  if (transcriptContent.value) {
    const entries = transcriptContent.value.querySelectorAll(".transcript-entry");
    entries[index]?.scrollIntoView({ behavior: "smooth", block: "center" });
  }
}

function toggleAutoScroll() {
  autoScroll.value = !autoScroll.value;
}

function addManualTranscript() {
  const newEntry: TranscriptEntry = {
    speaker: props.userData?.name ?? "Guest",
    text: manualTranscript.value,
    timestamp: Date.now(),
  };
  emit("add-data", newEntry);
  manualTranscript.value = "";
}

function editEntry(index: number) {
  editingIndex.value = index;
  const entry = Object.values(transcriptDataEntries.value)[index];
  editingEntry.value = {
    speaker: entry.speaker ?? "",
    text: entry.text,
    timestamp: entry.timestamp,
  };
  showEditModal.value = true;
}

function saveEntry() {
  if (editingIndex.value >= 0) {
    const original = Object.values(transcriptDataEntries.value)[editingIndex.value];
    const updated: TranscriptEntry = {
      ...original,
      speaker: editingEntry.value.speaker,
      text: editingEntry.value.text,
    };
    const savedIndex = editingIndex.value;
    emit("update-data", updated);
    cancelEdit();
    shouldScrollToEditedEntry.value = true;
    void nextTick(() => {
      scrollToEditedEntry(savedIndex);
      setTimeout(() => {
        shouldScrollToEditedEntry.value = false;
      }, 100);
    });
  }
}

function cancelEdit() {
  editingIndex.value = -1;
  editingEntry.value = { speaker: "", text: "", timestamp: Date.now() };
  showEditModal.value = false;
}

function deleteEntry(index: number) {
  if (confirm(t("transcript.confirmClear"))) {
    emit("delete-data", Object.values(transcriptDataEntries.value)[index].timestamp);
  }
}

function exportTranscript() {
  const content = Object.values(transcriptDataEntries.value)
    .map((entry) => {
      const time = formatTimestamp(entry.timestamp);
      const speaker = entry.speaker ? `${entry.speaker}: ` : "";
      return `[${time}] ${speaker}${entry.text}`;
    })
    .join("\n\n");

  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `transcript-${localDate.value}.txt`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function onDateChange() {
  emit("date-change", localDate.value);
}
</script>

<style scoped>
.transcript-panel {
  min-height: 0;
}

.transcript-entry {
  transition: all 0.2s ease;
}

.transcript-entry:hover {
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.transcript-panel ::-webkit-scrollbar {
  width: 6px;
}

.transcript-panel ::-webkit-scrollbar-track {
  background: #f1f1f1;
}

.transcript-panel ::-webkit-scrollbar-thumb {
  background: #c1c1c1;
  border-radius: 3px;
}

.transcript-panel ::-webkit-scrollbar-thumb:hover {
  background: #a8a8a8;
}
</style>
