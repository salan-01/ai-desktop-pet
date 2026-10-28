import { ref, onUnmounted } from 'vue'

export function useSpeechRecognition() {
  const isListening = ref(false)
  const interimText = ref('')
  const isSupported = ref(
    'SpeechRecognition' in window || 'webkitSpeechRecognition' in window
  )

  let recognition: SpeechRecognition | null = null

  function getCtor(): { new(): SpeechRecognition } | null {
    if (window.SpeechRecognition) return window.SpeechRecognition
    if (window.webkitSpeechRecognition) return window.webkitSpeechRecognition
    return null
  }

  function start() {
    if (!isSupported.value) return
    if (isListening.value) stop()

    const Ctor = getCtor()
    if (!Ctor) return

    recognition = new Ctor()
    recognition.continuous = false
    recognition.interimResults = true
    recognition.lang = 'zh-CN'

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let final = ''
      let interim = ''
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i]
        if (result.isFinal) {
          final += result[0].transcript
        } else {
          interim += result[0].transcript
        }
      }
      if (final) {
        interimText.value = final
      } else if (interim) {
        interimText.value = interim
      }
    }

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      console.warn('语音识别错误:', event.error, event.message)
      isListening.value = false
    }

    recognition.onend = () => {
      isListening.value = false
    }

    recognition.start()
    isListening.value = true
  }

  function stop() {
    if (recognition) {
      recognition.abort()
      recognition = null
    }
    isListening.value = false
  }

  function toggle() {
    if (isListening.value) {
      stop()
    } else {
      start()
    }
  }

  onUnmounted(() => stop())

  return { isListening, interimText, isSupported, start, stop, toggle }
}
