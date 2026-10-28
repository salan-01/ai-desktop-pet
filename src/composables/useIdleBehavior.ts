import { ref, onUnmounted, type Ref } from 'vue'
import type { Emotion } from '@/types'
import { useIdleConversation } from './useIdleConversation'

const GENTLE_EMOTIONS: Emotion[] = ['curious', 'thinking', 'smile', 'shy']
const IDLE_EMOTION_MS = 30_000
const GREETING_MS = 300_000
const EMOTION_DURATION_MS = 3_000
const TICK_MS = 1_000

export interface IdleBehaviorOptions {
  isStreaming: Ref<boolean>
  isSpeaking: Ref<boolean>
  isChatOpen: Ref<boolean>
  onIdleEmotion: (emotion: Emotion) => void
  onEmotionRevert: () => void
  onGreeting?: () => void
  onIdleStage?: (stage: number, message: string, emotion: Emotion) => void
}

export function useIdleBehavior(options: IdleBehaviorOptions) {
  const { isStreaming, isSpeaking, isChatOpen, onIdleEmotion, onEmotionRevert, onGreeting, onIdleStage } = options

  const idleMs = ref(0)
  let timer: ReturnType<typeof setInterval> | null = null
  let emotionTimeout: ReturnType<typeof setTimeout> | null = null
  let emotionFired = false
  let currentStage = 0
  let greetingFired = false

  const conversation = useIdleConversation()

  function tick() {
    if (isStreaming.value || isSpeaking.value || isChatOpen.value) return

    idleMs.value += TICK_MS

    if (idleMs.value >= IDLE_EMOTION_MS && !emotionFired) {
      emotionFired = true
      const emotion = GENTLE_EMOTIONS[Math.floor(Math.random() * GENTLE_EMOTIONS.length)]
      onIdleEmotion(emotion)
      emotionTimeout = setTimeout(() => {
        onEmotionRevert()
        emotionTimeout = null
      }, EMOTION_DURATION_MS)
    }

    if (onIdleStage) {
      const stage = conversation.getStageAtMs(idleMs.value)
      if (stage && stage.stage > currentStage) {
        currentStage = stage.stage
        const { message, emotion } = conversation.pickMessage(stage)
        onIdleStage(stage.stage, message, emotion)
      }
    } else if (onGreeting && idleMs.value >= GREETING_MS && !greetingFired) {
      greetingFired = true
      onGreeting()
    }
  }

  function resetTimer() {
    idleMs.value = 0
    emotionFired = false
    greetingFired = false
    currentStage = 0
    conversation.reset()
    if (emotionTimeout) {
      clearTimeout(emotionTimeout)
      emotionTimeout = null
    }
  }

  function destroy() {
    if (timer) {
      clearInterval(timer)
      timer = null
    }
    if (emotionTimeout) {
      clearTimeout(emotionTimeout)
      emotionTimeout = null
    }
  }

  timer = setInterval(tick, TICK_MS)
  onUnmounted(destroy)

  return { resetTimer, idleMs }
}
