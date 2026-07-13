<template>
  <div class="flex h-screen w-full">
    <!-- 視訊會議區域 -->
    <div
      :class="[
        'transition-all duration-300',
        showTranscript && !isMobile ? 'w-[62%]' : 'w-full',
      ]"
    >
      <!-- 加入會議按鈕 -->
      <div v-if="!hasJoined" class="flex h-full items-center justify-center bg-gray-100">
        <div class="text-center">
          <h2 class="mb-4 text-2xl font-bold text-gray-800">vTaiwan 視訊會議</h2>
          <p class="mb-6 text-gray-600">準備加入會議室：{{ room }}</p>

          <input
            v-model="joinMeetingName"
            class="mb-4 w-full rounded-lg border border-gray-300 px-4 py-2 focus:outline-hidden focus:ring-2 focus:ring-jade-green"
            placeholder="請輸入您的名字"
          />

          <button
            @click="joinMeeting"
            class="rounded-lg bg-jade-green px-6 py-3 text-white transition-colors hover:bg-jade-green/90"
          >
            加入會議
          </button>

          <br />
          <p v-if="!userData || !userData.uid" class="mt-3 text-sm text-gray-600">
            如欲加入會議並啟用完整逐字稿功能，請先登入
          </p>
        </div>
      </div>

      <!-- Jitsi Meet 容器 -->
      <div
        v-show="hasJoined"
        ref="jitsiContainer"
        class="w-full"
        style="height: calc(100% - 50px)"
        :key="jitsiKey"
      ></div>
    </div>

    <!-- 寬螢幕逐字稿面板 -->
    <div v-if="showTranscript && !isMobile" class="h-full w-[62%] md:w-[38%]">
      <TranscriptPanel
        @close="hideTranscript"
        :user-data="userData"
        :transcript-data="transcriptData"
        :is-recorder="isRecorder"
        :selected-date="selectedDate"
        @add-data="addTranscriptData"
        @update-data="updateTranscriptData"
        @delete-data="deleteTranscriptData"
        @i-am-recorder="toggleRecorder"
        @date-change="onDateChange"
      />
    </div>

    <!-- 窄螢幕抽屜式逐字稿面板 -->
    <div
      v-if="isMobile"
      :class="['fixed inset-y-0 right-0 z-50 transform transition-transform duration-300 ease-in-out', showTranscript ? 'translate-x-0' : 'translate-x-full']"
      :style="{ width: drawerWidth + 'px' }"
    >
      <div class="h-full bg-white shadow-xl">
        <!-- 拖拽手柄 -->
        <div
          class="absolute left-0 top-1/2 flex h-16 w-4 -translate-x-4 -translate-y-1/2 transform cursor-col-resize items-center justify-center rounded-l-lg bg-gray-300 transition hover:bg-gray-400"
          @mousedown="startDragging"
          @touchstart="startDragging"
        >
          <div class="h-8 w-1 rounded-sm bg-gray-500"></div>
        </div>

        <TranscriptPanel
          @close="hideTranscript"
          :user-data="userData"
          :transcript-data="transcriptData"
          :is-recorder="isRecorder"
          :selected-date="selectedDate"
          @add-data="addTranscriptData"
          @update-data="updateTranscriptData"
          @delete-data="deleteTranscriptData"
          @i-am-recorder="toggleRecorder"
          @date-change="onDateChange"
        />
      </div>
    </div>

    <!-- 遮罩層（窄螢幕時） -->
    <div
      v-if="isMobile && showTranscript"
      class="fixed inset-0 z-40 bg-black bg-opacity-50"
      @click="hideTranscript"
    ></div>

    <!-- 音訊設定模態框 -->
    <div
      v-if="showAudioSettings"
      class="audio-settings-modal fixed inset-0 z-[9999] flex items-center justify-center bg-black bg-opacity-50 p-4"
      @click="hideAudioSettings"
    >
      <div class="mx-2 max-h-[90vh] w-[95vw] max-w-md overflow-y-auto rounded-lg bg-white shadow-xl" @click.stop>
        <div class="p-4">
          <div class="mb-4 flex items-center justify-between">
            <h3 class="text-lg font-bold text-gray-800">{{ $t('transcript.audioSettings') }}</h3>
            <button @click="hideAudioSettings" class="p-1 text-gray-400 hover:text-gray-600">
              <IconWrapper name="x" :size="20" />
            </button>
          </div>

          <!-- 音訊源選擇 -->
          <div class="mb-6">
            <label class="mb-3 block text-sm font-medium text-gray-700">{{ $t('transcript.selectAudioSource') }}</label>

            <div v-if="audioDevices.length === 0" class="mb-4 text-sm text-gray-500">
              {{ $t('transcript.loadingAudioDevices') }}
            </div>

            <div v-else class="space-y-2">
              <div
                v-for="device in audioDevices"
                :key="device.deviceId"
                class="rounded-lg border transition-colors"
                :class="selectedAudioDeviceId === device.deviceId ? 'border-democratic-red bg-democratic-red/5' : 'border-gray-200 hover:border-gray-300'"
              >
                <div class="flex cursor-pointer items-center p-4" @click="selectAudioDevice(device.deviceId)">
                  <div class="mr-3 shrink-0">
                    <div class="flex h-4 w-4 items-center justify-center rounded-full border-2" :class="selectedAudioDeviceId === device.deviceId ? 'border-democratic-red' : 'border-gray-300'">
                      <div v-if="selectedAudioDeviceId === device.deviceId" class="h-2 w-2 rounded-full bg-democratic-red"></div>
                    </div>
                  </div>
                  <div class="flex-1">
                    <div class="text-sm font-medium text-gray-800">{{ device.label || $t('transcript.unknownDevice') }}</div>
                    <div class="text-xs text-gray-500">{{ device.deviceId.length > 10 ? device.deviceId.slice(0, 10) + '...' : device.deviceId }}</div>
                  </div>
                </div>

                <!-- 音量直條 -->
                <div v-if="isTestingAudio && selectedAudioDeviceId === device.deviceId" class="px-4 pb-4">
                  <div class="mb-2 text-xs text-gray-600">{{ $t('transcript.audioLevel') }}</div>
                  <div class="flex h-12 items-end space-x-1">
                    <div
                      v-for="(level, index) in audioLevels"
                      :key="index"
                      class="flex-1 rounded-t transition-all duration-100"
                      :style="{ height: Math.max(2, level * 100) + '%', backgroundColor: level > 0.1 ? '#22c55e' : '#9ca3af' }"
                    ></div>
                  </div>
                  <div class="mt-1 text-center text-xs text-gray-500">{{ $t('transcript.speakToTest') }}</div>
                </div>
              </div>
            </div>
          </div>

          <!-- 轉錄語言選擇 -->
          <div class="mb-6">
            <label class="mb-3 block text-sm font-medium text-gray-700">{{ $t('transcript.selectTranscriptionLanguage') }}</label>
            <TranscriptLanguageSwitcher v-model="transcriptionLanguage" />
          </div>

          <!-- 測試按鈕 -->
          <div class="mb-6">
            <button
              @click="isTestingAudio ? stopAudioTest() : testAudioDevice()"
              :disabled="!selectedAudioDeviceId"
              class="w-full rounded-lg px-4 py-3 text-white transition-colors disabled:cursor-not-allowed disabled:opacity-50"
              :class="isTestingAudio ? 'bg-red-500 hover:bg-red-600' : 'bg-jade-green hover:bg-jade-green/90'"
            >
              {{ isTestingAudio ? $t('transcript.stopTest') : $t('transcript.testAudioDevice') }}
            </button>
          </div>

          <!-- 儲存/取消按鈕 -->
          <div class="flex space-x-3">
            <button @click="saveAudioSettings" class="flex-1 rounded-lg bg-democratic-red px-4 py-3 text-white hover:bg-democratic-red/90">
              {{ $t('common.save') }}
            </button>
            <button @click="hideAudioSettings" class="flex-1 rounded-lg bg-gray-300 px-4 py-3 text-gray-700 hover:bg-gray-400">
              {{ $t('common.cancel') }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- 浮動按鈕組 -->
    <div class="fixed bottom-16 right-6 z-50 flex flex-col space-y-3">
      <!-- 手機版音訊設定按鈕 -->
      <div class="relative">
        <button
          v-if="isMobile && userData && userData.uid"
          @click="toggleAudioSettings"
          class="flex items-center justify-center rounded-full border border-gray-300 bg-white p-4 text-gray-600 shadow-lg hover:bg-gray-50"
          :title="$t('transcript.audioSettings')"
        >
          <IconWrapper name="settings" :size="24" />
          <div class="absolute -right-1 top-10 flex h-5 w-5 items-center justify-center rounded-full bg-white text-sm shadow-xs">
            {{ transcriptionLanguageFlag }}
          </div>
        </button>
      </div>

      <!-- 音訊轉錄按鈕 -->
      <div class="relative">
        <button
          v-if="userData && userData.uid"
          @click="toggleAudioRecording"
          :class="['relative rounded-full p-4 shadow-lg transition-all duration-300', isRecordingAudio ? 'animate-pulse bg-red-500 text-white hover:bg-red-600' : 'bg-purple-500 text-white hover:bg-purple-600']"
        >
          <IconWrapper :name="isRecordingAudio ? 'square' : 'mic'" :size="24" />
          <div v-if="isRecordingAudio" class="absolute -left-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full border-2 border-red-500 bg-white text-xs font-bold text-red-500">
            {{ recordingTimeLeft }}
          </div>
        </button>

        <!-- 錄音者顯示 -->
        <div
          v-if="meetingData.recordingSpeaker && !isTranscripting"
          class="absolute -bottom-2 -right-10 flex h-6 w-48 items-center justify-center rounded-full border-2 border-red-500 bg-white text-xs font-bold text-red-500"
        >
          {{ meetingData.recordingSpeaker }} 錄音中
        </div>

        <!-- 桌面版音訊設定按鈕 -->
        <button
          v-if="!isMobile && userData && userData.uid"
          @click="toggleAudioSettings"
          class="audio-settings-button absolute -right-1 -top-1 z-10 flex h-7 w-7 items-center justify-center rounded-full border border-gray-300 bg-white text-gray-500 shadow-lg hover:bg-gray-50"
          :title="$t('transcript.audioSettings')"
        >
          <IconWrapper name="chevron-up" :size="14" />
          <div class="absolute -right-1 top-4 flex h-5 w-5 items-center justify-center rounded-full bg-white text-sm shadow-xs">
            {{ transcriptionLanguageFlag }}
          </div>
        </button>
      </div>

      <!-- 逐字稿切換按鈕 -->
      <button
        v-if="userData && userData.uid"
        @click="toggleTranscript"
        :class="['rounded-full p-4 shadow-lg transition-all duration-300', showTranscript ? 'bg-democratic-red text-white hover:bg-democratic-red/90' : 'bg-jade-green text-white hover:bg-jade-green/90']"
      >
        <IconWrapper :name="showTranscript ? 'x' : 'file-text'" :size="24" />
      </button>
    </div>

    <!-- 加入後提示橫幅 -->
    <div
      v-if="hasJoined && showJitsiTipBanner"
      class="fixed left-1/2 top-4 z-[9999] max-w-[92vw] -translate-x-1/2 md:max-w-2xl"
    >
      <div class="flex items-start space-x-3 rounded-lg border border-yellow-300 bg-yellow-50 px-4 py-3 text-yellow-900 shadow-sm">
        <div class="flex-1 text-sm leading-relaxed">{{ $t('jitsi.tipBanner.message') }}</div>
        <button @click="dismissJitsiTipBanner" class="ml-2 text-yellow-900/70 hover:text-yellow-900">
          <IconWrapper name="x" :size="18" />
        </button>
      </div>
    </div>
  </div>
</template>

<script>
import TranscriptPanel from '../components/TranscriptPanel.vue'
import TranscriptLanguageSwitcher from '../components/TranscriptLanguageSwitcher.vue'
import IconWrapper from '../components/IconWrapper.vue'
import { useI18n } from 'vue-i18n'
import { supportedLocales } from '../i18n'

export default {
  name: 'JitsiView',
  components: { TranscriptPanel, TranscriptLanguageSwitcher, IconWrapper },
  props: {
    userData: { type: Object, required: false, default: () => ({}) },
  },
  setup() {
    const { t } = useI18n()
    return { t }
  },
  data() {
    return {
      isRecorder: false,
      isTranscripting: false,
      joinMeetingName: '',
      today: '',
      selectedDate: '',
      meetingData: { recordingStartTime: null, recordingSpeaker: null },
      transcriptData: {},
      firebaseUnsubscribe: null,
      appId: 'vpaas-magic-cookie-7c142b7a730e4478878703f86c03d5a1',
      room: 'vtaiwan',
      jwt: '',
      jitsiKey: 0,
      jitsiApi: null,
      hasJoined: false,
      jitsiDomain: '8x8.vc',
      showTranscript: false,
      drawerWidth: 400, // SSR safe: 不用 window.innerWidth
      isDragging: false,
      dragStartX: 0,
      dragStartWidth: 0,
      transcriptCache: {
        currentSpeaker: null,
        currentSpeakerId: null,
        currentText: '',
        lastMessageId: null,
        debounceTimer: null,
        maxWaitTime: 3000,
        debounceDelay: 1500,
      },
      isRecordingAudio: false,
      audioMediaRecorder: null,
      audioStream: null,
      audioChunks: [],
      audioRecordingTimer: null,
      maxRecordingTime: 30 * 1000,
      recordingTimeLeft: 0,
      countdownInterval: null,
      transcriptionApiUrl: '/api/transcriptions/transcription/', // 透過 hono 代理
      isPageVisible: true,
      audioQueue: [],
      isProcessingQueue: false,
      showAudioSettings: false,
      audioDevices: [],
      selectedAudioDeviceId: '',
      isTestingAudio: false,
      testAudioStream: null,
      audioLevels: [],
      audioAnalyser: null,
      audioContext: null,
      audioSource: null,
      levelUpdateInterval: null,
      recordingTimerInterval: null,
      recordingTimer: 0,
      transcriptionLanguage: 'zh-TW',
      showJitsiTipBanner: true, // SSR safe: 從 localStorage 讀在 mounted()
    }
  },
  computed: {
    fullRoomName() {
      return `${this.appId}/${this.room}`
    },
    isMobile() {
      // SSR safe guard
      if (typeof window === 'undefined') return false
      return window.innerWidth < 768
    },
    transcriptionLanguageFlag() {
      const found = supportedLocales.find((l) => l.code === this.transcriptionLanguage)
      return found ? found.flag : '🌐'
    },
    recordingDuration() {
      if (!this.meetingData.recordingStartTime) return 0
      this.recordingTimer // trigger reactive update
      return Math.floor((new Date().getTime() - this.meetingData.recordingStartTime) / 1000)
    },
  },
  created() {
    // SSR safe: 只計算日期（不用 Date 以外的 API）
    const now = new Date()
    const year = now.getFullYear()
    const month = String(now.getMonth() + 1).padStart(2, '0')
    const day = String(now.getDate()).padStart(2, '0')
    this.today = `${year}${month}${day}`
    this.selectedDate = `${year}-${month}-${day}`
  },
  mounted() {
    // 瀏覽器端才跑的初始化
    this.recordingTimerInterval = setInterval(() => {
      this.recordingTimer = Date.now()
    }, 1000)

    this.joinMeetingName = (this.userData || {}).name || 'Guest'
    window.addEventListener('resize', this.handleResize)

    // 從 localStorage 讀取設定
    try {
      const savedLang = localStorage.getItem('vtaiwan_transcription_language')
      if (savedLang) this.transcriptionLanguage = savedLang
      const dismissed = localStorage.getItem('vtaiwan_jitsi_tip_dismissed')
      if (dismissed === '1') this.showJitsiTipBanner = false
    } catch {}

    this.loadAudioDevices()
    this.loadAudioSettings()

    navigator.mediaDevices.addEventListener('devicechange', this.handleDeviceChange)
    document.addEventListener('visibilitychange', this.handleVisibilityChange)

    // Firebase：瀏覽器端才載入
    this.loadMeetingData()
  },
  beforeUnmount() {
    if (this.jitsiApi) {
      this.jitsiApi.dispose()
      this.jitsiApi = null
    }
    if (this.firebaseUnsubscribe) {
      this.firebaseUnsubscribe()
      this.firebaseUnsubscribe = null
    }
    this.clearTranscriptCache()
    this.cleanupAudioRecording()
    this.stopQueueProcessing()
    this.clearAudioQueue()
    if (this.recordingTimerInterval) {
      clearInterval(this.recordingTimerInterval)
      this.recordingTimerInterval = null
    }
    this.stopAudioTest()
    document.removeEventListener('mousemove', this.onDrag)
    document.removeEventListener('mouseup', this.stopDragging)
    document.removeEventListener('touchmove', this.onDrag)
    document.removeEventListener('touchend', this.stopDragging)
    window.removeEventListener('resize', this.handleResize)
    navigator.mediaDevices.removeEventListener('devicechange', this.handleDeviceChange)
    document.removeEventListener('visibilitychange', this.handleVisibilityChange)
  },
  watch: {
    userData: {
      handler(newVal) {
        this.isRecorder = this.meetingData.recorder === (newVal || {}).uid
        this.joinMeetingName = (newVal || {}).name || 'Guest'
      },
    },
    jwt(newJwt, oldJwt) {
      if (newJwt && newJwt !== oldJwt && this.hasJoined) {
        this.initializeJitsiMeet()
      }
    },
  },
  methods: {
    dismissJitsiTipBanner() {
      this.showJitsiTipBanner = false
      try { localStorage.setItem('vtaiwan_jitsi_tip_dismissed', '1') } catch {}
    },

    async getJwt() {
      const user_id = (this.userData || {}).uid || 'Guest'
      if (user_id === 'Guest') {
        window.alert('請先登入，方可加入會議')
        return
      }
      const user_name = this.joinMeetingName
      const user_email = (this.userData || {}).email || 'guest@vtaiwan.tw'
      const isAdmin = (this.userData || {}).isAdmin || false
      const res = await fetch(
        `/api/jitsi/token?room=vtaiwan&user_id=${user_id}&user_name=${encodeURIComponent(user_name)}&user_email=${encodeURIComponent(user_email)}&user_moderator=${isAdmin}`
      )
      const json = await res.json()
      this.jwt = json.token
    },

    loadJitsiExternalAPI() {
      if (window.JitsiMeetExternalAPI) return Promise.resolve()
      return new Promise((resolve, reject) => {
        const script = document.createElement('script')
        script.src = `https://${this.jitsiDomain}/${this.appId}/external_api.js`
        script.async = true
        script.onload = resolve
        script.onerror = reject
        document.head.appendChild(script)
      })
    },

    async joinMeeting() {
      if (!this.jwt) await this.getJwt()
      if (!this.jwt) return
      try {
        await this.loadJitsiExternalAPI()
        this.hasJoined = true
        this.$nextTick(() => this.initializeJitsiMeet())
      } catch (error) {
        console.error('Failed to join meeting:', error)
        this.hasJoined = false
      }
    },

    initializeJitsiMeet() {
      if (!window.JitsiMeetExternalAPI || !this.jwt || !this.$refs.jitsiContainer) return
      if (this.jitsiApi) {
        this.jitsiApi.dispose()
        this.jitsiApi = null
      }
      const options = {
        roomName: this.fullRoomName,
        parentNode: this.$refs.jitsiContainer,
        jwt: this.jwt,
        lang: 'en',
        width: '100%',
        height: '100%',
        configOverwrite: {
          disableDeepLinking: true,
          startWithAudioMuted: true,
          startWithVideoMuted: true,
          prejoinPageEnabled: false,
          analytics: { disabled: true },
          disableThirdPartyRequests: true,
          transcription: { enabled: false, useAppLanguage: false, preferredLanguage: 'en-US' },
        },
        interfaceConfigOverwrite: {
          TOOLBAR_BUTTONS: [
            'microphone','camera','closedcaptions','desktop','embedmeeting','fullscreen',
            'fodeviceselection','hangup','profile','chat','livestreaming','etherpad',
            'sharedvideo','settings','raisehand','videoquality','filmstrip','invite',
            'feedback','stats','shortcuts','tileview','videobackgroundblur','download',
            'help','mute-everyone','security',
          ],
          SHOW_JITSI_WATERMARK: false,
          SHOW_WATERMARK_FOR_GUESTS: false,
          DEFAULT_BACKGROUND: '#474747',
          MOBILE_APP_PROMO: false,
          LANG_DETECTION: false,
          DEFAULT_LANGUAGE: 'en-US',
        },
      }
      try {
        this.jitsiApi = new window.JitsiMeetExternalAPI(this.jitsiDomain, options)

        this.jitsiApi.addEventListener('transcriptionChunkReceived', (event) => {
          if (event.data) {
            const { language, participant, stable, messageID } = event.data
            if (stable && this.isRecorder) {
              this.handleTranscriptChunk({
                messageId: messageID,
                speakerId: participant.id,
                speakerName: participant.name,
                text: stable,
                language,
              })
            }
          }
        })

        this.jitsiApi.addEventListener('videoConferenceLeft', this.handleMeetingLeft)
        this.jitsiApi.addEventListener('readyToClose', this.handleMeetingLeft)
      } catch (error) {
        console.error('Failed to initialize Jitsi Meet:', error)
        this.hasJoined = false
      }
    },

    handleMeetingLeft() {
      if (this.jitsiApi) {
        this.jitsiApi.removeEventListener('videoConferenceLeft', this.handleMeetingLeft)
        this.jitsiApi.removeEventListener('readyToClose', this.handleMeetingLeft)
        this.jitsiApi.dispose()
        this.jitsiApi = null
      }
      if (this.$refs.jitsiContainer) this.$refs.jitsiContainer.innerHTML = ''
      this.hasJoined = false
    },

    toggleRecorder() {
      this.isRecorder = !this.isRecorder
      if (this.isRecorder) {
        this.meetingData.recorder = (this.userData || {}).uid
      } else {
        this.meetingData.recorder = ''
      }
      this.updateMeetingData()
    },

    toggleTranscript() { this.showTranscript = !this.showTranscript },
    hideTranscript() { this.showTranscript = false },

    addTranscriptData(newEntry) {
      this.transcriptData[newEntry.timestamp] = newEntry
      this.updateMeetingData()
    },
    updateTranscriptData(updatedData) {
      this.transcriptData[updatedData.timestamp] = updatedData
      this.updateMeetingData()
    },
    deleteTranscriptData(timestamp) {
      delete this.transcriptData[timestamp]
      this.updateMeetingData()
    },

    async updateMeetingData() {
      this.meetingData.transcripts = this.transcriptData
      try {
        const fb = await import('../lib/firebase').then((m) => m.getFirebaseServices())
        await fb.databaseSet(fb.databaseRef(fb.database, `/meetings/${this.today}/transcripts`), this.transcriptData)
      } catch (e) {
        console.error('Firebase update failed:', e)
      }
    },

    handleResize() {
      this.$forceUpdate()
    },

    startDragging(event) {
      this.isDragging = true
      this.dragStartX = event.type === 'mousedown' ? event.clientX : event.touches[0].clientX
      this.dragStartWidth = this.drawerWidth
      if (event.type === 'mousedown') {
        document.addEventListener('mousemove', this.onDrag)
        document.addEventListener('mouseup', this.stopDragging)
      } else {
        document.addEventListener('touchmove', this.onDrag)
        document.addEventListener('touchend', this.stopDragging)
      }
      event.preventDefault()
    },

    onDrag(event) {
      if (!this.isDragging) return
      const currentX = event.type === 'mousemove' ? event.clientX : event.touches[0].clientX
      const deltaX = this.dragStartX - currentX
      this.drawerWidth = Math.max(300, Math.min(window.innerWidth * 0.8, this.dragStartWidth + deltaX))
    },

    stopDragging() {
      this.isDragging = false
      document.removeEventListener('mousemove', this.onDrag)
      document.removeEventListener('mouseup', this.stopDragging)
      document.removeEventListener('touchmove', this.onDrag)
      document.removeEventListener('touchend', this.stopDragging)
    },

    handleTranscriptChunk(chunk) {
      const { messageId, speakerId, speakerName, text } = chunk
      const isSameSpeaker = this.transcriptCache.currentSpeakerId === speakerId
      if (isSameSpeaker) {
        if (this.isTextExtension(this.transcriptCache.currentText, text)) {
          this.transcriptCache.currentText = text
          this.transcriptCache.lastMessageId = messageId
          this.resetTranscriptTimer()
        } else {
          this.commitTranscriptCache()
          this.startNewTranscriptCache(speakerId, speakerName, text, messageId)
        }
      } else {
        this.commitTranscriptCache()
        this.startNewTranscriptCache(speakerId, speakerName, text, messageId)
      }
    },

    isTextExtension(oldText, newText) {
      if (!oldText) return true
      if (newText.length <= oldText.length) return false
      return newText.trim().toLowerCase().startsWith(oldText.trim().toLowerCase())
    },

    startNewTranscriptCache(speakerId, speakerName, text, messageId) {
      this.transcriptCache.currentSpeaker = speakerName
      this.transcriptCache.currentSpeakerId = speakerId
      this.transcriptCache.currentText = text
      this.transcriptCache.lastMessageId = messageId
      this.resetTranscriptTimer()
    },

    resetTranscriptTimer() {
      if (this.transcriptCache.debounceTimer) clearTimeout(this.transcriptCache.debounceTimer)
      this.transcriptCache.debounceTimer = setTimeout(() => {
        this.commitTranscriptCache()
      }, this.transcriptCache.debounceDelay)
    },

    commitTranscriptCache() {
      if (!this.transcriptCache.currentText || !this.transcriptCache.currentSpeaker) return
      this.addTranscriptData({
        id: this.transcriptCache.lastMessageId,
        timestamp: new Date().getTime(),
        speaker: this.transcriptCache.currentSpeaker,
        text: this.transcriptCache.currentText.trim(),
      })
      this.clearTranscriptCache()
    },

    clearTranscriptCache() {
      if (this.transcriptCache.debounceTimer) clearTimeout(this.transcriptCache.debounceTimer)
      this.transcriptCache = {
        ...this.transcriptCache,
        currentSpeaker: null,
        currentSpeakerId: null,
        currentText: '',
        lastMessageId: null,
        debounceTimer: null,
      }
    },

    async toggleAudioRecording() {
      if (this.isRecordingAudio) {
        await this.stopAudioRecording()
      } else {
        await this.requestNotificationPermission()
        await this.startAudioRecording()
      }
    },

    async startAudioRecording() {
      try {
        const audioConstraints = {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 44100,
          ...(this.selectedAudioDeviceId ? { deviceId: { exact: this.selectedAudioDeviceId } } : {}),
        }
        this.audioStream = await navigator.mediaDevices.getUserMedia({ audio: audioConstraints, video: false })
        this.audioChunks = []
        this.audioMediaRecorder = new MediaRecorder(this.audioStream, { mimeType: 'audio/webm;codecs=opus' })
        this.audioMediaRecorder.ondataavailable = (event) => {
          if (event.data.size > 0) this.audioChunks.push(event.data)
        }
        this.audioMediaRecorder.onstop = () => this.processRecordedAudio()
        this.audioMediaRecorder.start()
        this.isRecordingAudio = true

        const currentTime = new Date().getTime()
        const speakerName = (this.userData || {}).name || '未知說話者'
        this.meetingData.recordingStartTime = currentTime
        this.meetingData.recordingSpeaker = speakerName

        this.recordingTimeLeft = Math.ceil(this.maxRecordingTime / 1000)
        this.countdownInterval = setInterval(() => {
          if (this.recordingTimeLeft > 0) this.recordingTimeLeft--
        }, 1000)
        this.audioRecordingTimer = setTimeout(() => {
          this.stopAudioRecordingForNextRound()
        }, this.maxRecordingTime)
      } catch (error) {
        console.error('無法開始音訊錄製:', error)
        alert('無法開始錄音，請檢查麥克風權限')
      }
    },

    async stopAudioRecording() {
      this.meetingData.recordingStartTime = null
      this.meetingData.recordingSpeaker = null
      try {
        if (this.audioRecordingTimer) { clearTimeout(this.audioRecordingTimer); this.audioRecordingTimer = null }
        if (this.countdownInterval) { clearInterval(this.countdownInterval); this.countdownInterval = null }
        if (this.audioMediaRecorder && this.audioMediaRecorder.state !== 'inactive') this.audioMediaRecorder.stop()
        this.isRecordingAudio = false
        this.recordingTimeLeft = 0
        this.cleanupAudioRecording()
      } catch (error) {
        console.error('停止錄音時發生錯誤:', error)
      }
    },

    async processRecordedAudio() {
      if (this.audioChunks.length === 0) return
      const audioBlob = new Blob(this.audioChunks, { type: 'audio/webm' })
      this.audioChunks = []
      this.audioQueue.push({ id: Date.now(), blob: audioBlob, timestamp: new Date().toISOString() })
      if (this.meetingData.recordingSpeaker) this.startNextRecordingRound()
      this.startQueueProcessing()
    },

    async sendAudioToTranscription(audioBlob) {
      const formData = new FormData()
      formData.append('file', audioBlob, 'recording.webm')
      const transcriptionUrl = `${this.transcriptionApiUrl}${this.transcriptionLanguage}`
      const response = await fetch(transcriptionUrl, { method: 'POST', body: formData })
      if (response.status === 422) return
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`)
      const result = await response.text()
      if (result) {
        this.addTranscriptData({
          id: 'audio_' + Date.now(),
          timestamp: Date.now(),
          speaker: (this.userData || {}).name || '未知說話者',
          text: result,
        })
      }
    },

    cleanupAudioRecording() {
      if (this.audioRecordingTimer) { clearTimeout(this.audioRecordingTimer); this.audioRecordingTimer = null }
      if (this.countdownInterval) { clearInterval(this.countdownInterval); this.countdownInterval = null }
      if (this.audioStream) { this.audioStream.getTracks().forEach((t) => t.stop()); this.audioStream = null }
      this.audioMediaRecorder = null
      this.audioChunks = []
      this.isRecordingAudio = false
      this.recordingTimeLeft = 0
    },

    async loadAudioDevices() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
        stream.getTracks().forEach((t) => t.stop())
        const devices = await navigator.mediaDevices.enumerateDevices()
        this.audioDevices = devices.filter((d) => d.kind === 'audioinput')
      } catch {
        this.audioDevices = []
      }
    },

    loadAudioSettings() {
      try {
        const saved = localStorage.getItem('vtaiwan_selected_audio_device')
        if (saved) this.selectedAudioDeviceId = saved
      } catch {}
    },

    saveAudioSettings() {
      try {
        localStorage.setItem('vtaiwan_selected_audio_device', this.selectedAudioDeviceId)
        localStorage.setItem('vtaiwan_transcription_language', this.transcriptionLanguage)
      } catch {}
      this.hideAudioSettings()
    },

    selectAudioDevice(deviceId) { this.selectedAudioDeviceId = deviceId },

    async testAudioDevice() {
      if (!this.selectedAudioDeviceId) return
      try {
        this.isTestingAudio = true
        this.audioLevels = Array(20).fill(0)
        this.testAudioStream = await navigator.mediaDevices.getUserMedia({
          audio: { deviceId: { exact: this.selectedAudioDeviceId }, echoCancellation: true, noiseSuppression: true },
        })
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)()
        if (this.audioContext.state === 'suspended') await this.audioContext.resume()
        this.audioSource = this.audioContext.createMediaStreamSource(this.testAudioStream)
        this.audioAnalyser = this.audioContext.createAnalyser()
        this.audioAnalyser.fftSize = 256
        this.audioAnalyser.smoothingTimeConstant = 0.8
        this.audioSource.connect(this.audioAnalyser)
        this.audioAnalyser.connect(this.audioContext.destination)
        this.startAudioLevelMonitoring()
      } catch {
        this.isTestingAudio = false
      }
    },

    startAudioLevelMonitoring() {
      const bufferLength = this.audioAnalyser.frequencyBinCount
      const dataArray = new Uint8Array(bufferLength)
      const updateLevels = () => {
        if (!this.isTestingAudio) return
        this.audioAnalyser.getByteTimeDomainData(dataArray)
        let sum = 0
        for (let i = 0; i < bufferLength; i++) {
          const v = (dataArray[i] - 128) / 128
          sum += v * v
        }
        const rms = Math.sqrt(sum / bufferLength)
        const level = Math.min(1, rms * 3)
        this.audioLevels = this.audioLevels.map((l) => l * 0.8 + level * 0.2)
        this.levelUpdateInterval = requestAnimationFrame(updateLevels)
      }
      updateLevels()
    },

    stopAudioTest() {
      this.isTestingAudio = false
      if (this.levelUpdateInterval) { cancelAnimationFrame(this.levelUpdateInterval); this.levelUpdateInterval = null }
      if (this.audioSource) { this.audioSource.disconnect(); this.audioSource = null }
      this.audioAnalyser = null
      if (this.audioContext) { this.audioContext.close(); this.audioContext = null }
      if (this.testAudioStream) { this.testAudioStream.getTracks().forEach((t) => t.stop()); this.testAudioStream = null }
      this.audioLevels = []
    },

    toggleAudioSettings() {
      this.showAudioSettings = !this.showAudioSettings
      if (this.showAudioSettings) this.loadAudioDevices()
    },
    hideAudioSettings() {
      this.showAudioSettings = false
      this.stopAudioTest()
    },
    handleDeviceChange() { this.loadAudioDevices() },

    onDateChange(newDate) {
      const parts = newDate.split('-')
      this.today = parts[0] + parts[1] + parts[2]
      this.selectedDate = newDate
      this.loadMeetingData()
    },

    async loadMeetingData() {
      try {
        if (this.firebaseUnsubscribe) { this.firebaseUnsubscribe(); this.firebaseUnsubscribe = null }
        const fb = await import('../lib/firebase').then((m) => m.getFirebaseServices())
        const snapshot = await fb.databaseGet(fb.databaseRef(fb.database, `/meetings/${this.today}`))
        if (!snapshot.exists()) {
          await fb.databaseSet(fb.databaseRef(fb.database, `/meetings/${this.today}`), { recorder: '', transcripts: {} })
        }
        const { onValue, ref: dbRef } = await import('firebase/database')
        this.firebaseUnsubscribe = onValue(dbRef(fb.database, `/meetings/${this.today}`), (snap) => {
          if (snap.exists()) {
            this.meetingData = snap.val()
            this.transcriptData = (this.meetingData || {}).transcripts || {}
            this.isRecorder = this.meetingData.recorder === (this.userData || {}).uid
          } else {
            this.meetingData = { recorder: '', transcripts: {} }
            this.transcriptData = {}
            this.isRecorder = false
          }
        })
      } catch (error) {
        console.error('Error loading meeting data:', error)
      }
    },

    handleVisibilityChange() {
      this.isPageVisible = !document.hidden
    },

    async requestNotificationPermission() {
      if (!('Notification' in window)) return false
      if (Notification.permission === 'default') {
        const p = await Notification.requestPermission()
        return p === 'granted'
      }
      return Notification.permission === 'granted'
    },

    async stopAudioRecordingForNextRound() {
      if (this.audioRecordingTimer) { clearTimeout(this.audioRecordingTimer); this.audioRecordingTimer = null }
      if (this.countdownInterval) { clearInterval(this.countdownInterval); this.countdownInterval = null }
      if (this.audioMediaRecorder && this.audioMediaRecorder.state !== 'inactive') this.audioMediaRecorder.stop()
      this.isRecordingAudio = false
      this.recordingTimeLeft = 0
    },

    async startNextRecordingRound() {
      this.audioChunks = []
      await this.startAudioRecording()
    },

    startQueueProcessing() {
      if (this.isProcessingQueue || this.audioQueue.length === 0) return
      this.isProcessingQueue = true
      this.processNextAudioInQueue()
    },

    async processNextAudioInQueue() {
      if (this.audioQueue.length === 0) { this.stopQueueProcessing(); return }
      const audioItem = this.audioQueue.shift()
      try {
        this.isTranscripting = true
        await this.sendAudioToTranscription(audioItem.blob)
        if (this.audioQueue.length > 0) {
          this.$nextTick(() => this.processNextAudioInQueue())
        } else {
          this.stopQueueProcessing()
        }
      } catch {
        if (this.audioQueue.length > 0) {
          this.$nextTick(() => this.processNextAudioInQueue())
        } else {
          this.stopQueueProcessing()
        }
      } finally {
        this.isTranscripting = false
      }
    },

    stopQueueProcessing() { this.isProcessingQueue = false },
    clearAudioQueue() { this.audioQueue = [] },
  },
}
</script>

<style scoped>
.jitsi-container {
  width: 100% !important;
  height: calc(100vh - 50px) !important;
}
:deep(iframe) {
  width: 100% !important;
  height: 100% !important;
  border: none;
}
</style>
