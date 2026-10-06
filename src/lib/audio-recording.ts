// 能力偵測由呼叫端提供；模組頂層與 SSR 不存取瀏覽器 API。
const AUDIO_MIME_TYPES = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4;codecs=mp4a.40.2', 'audio/mp4']

export function createAudioRecorder(stream: MediaStream, Recorder: typeof MediaRecorder): MediaRecorder {
  if (typeof Recorder.isTypeSupported === 'function') {
    for (const mimeType of AUDIO_MIME_TYPES) {
      if (!Recorder.isTypeSupported(mimeType)) continue
      try {
        return new Recorder(stream, { mimeType })
      } catch (error) {
        // 部分瀏覽器的能力回報與實際編碼器不同，僅格式錯誤可嘗試下一個格式。
        if (errorName(error) !== 'NotSupportedError') throw error
      }
    }
  }
  return new Recorder(stream)
}

export function recordingFilename(mimeType: string): string {
  const type = mimeType.split(';')[0].trim().toLowerCase()
  const extension = type === 'audio/mp4' || type === 'video/mp4' ? 'mp4' : type === 'audio/webm' || type === 'video/webm' ? 'webm' : type === 'audio/ogg' ? 'ogg' : 'audio'
  return `recording.${extension}`
}

function errorName(error: unknown): string {
  return error !== null && typeof error === 'object' && 'name' in error && typeof error.name === 'string' ? error.name : ''
}

export function recordingErrorKey(error: unknown): string {
  switch (errorName(error)) {
    case 'NotAllowedError':
    case 'SecurityError':
      return 'jitsi.micPermissionError'
    case 'NotFoundError':
    case 'OverconstrainedError':
      return 'jitsi.micDeviceError'
    case 'NotSupportedError':
      return 'jitsi.micFormatError'
    default:
      return 'jitsi.micError'
  }
}
