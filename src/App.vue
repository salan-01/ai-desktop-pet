<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useSettingsStore } from '@/stores/settings'
import { useChatStore } from '@/stores/chat'
import { useAiChat } from '@/composables/useAiChat'
import { useVits } from '@/composables/useVits'
import { useIdleBehavior } from '@/composables/useIdleBehavior'
import { usePetDrag } from '@/composables/usePetDrag'
import { useTimeGreeting } from '@/composables/useTimeGreeting'
import { listen } from '@tauri-apps/api/event'
import { invoke } from '@tauri-apps/api/core'
import PetStage from '@/components/PetStage.vue'
import ChatBubble from '@/components/ChatBubble.vue'
import ChatHistory from '@/components/ChatHistory.vue'
import ChatInput from '@/components/ChatInput.vue'
import SettingsModal from '@/components/SettingsModal.vue'
import MemoryModal from '@/components/MemoryModal.vue'
import type { Emotion } from '@/types'

const store = useSettingsStore()
const chatStore = useChatStore()
const { sendMessage, reset, isStreaming, streamText } = useAiChat()
const { speak, stop, isSpeaking } = useVits()
const { getTimeGreeting, getTimePeriod } = useTimeGreeting()

const showChat = ref(false)
const showSettings = ref(false)
const showHistory = ref(false)
const showMemory = ref(false)
const displayEmotion = ref<Emotion>('normal')
const lastFullResponse = ref('')
const speakingMsgIdx = ref(-1)
const preIdleEmotion = ref<Emotion>('normal')
const headPatReply = ref(false)
const headPatReplyText = ref('')
const idleReply = ref(false)
const idleReplyText = ref('')
const showWelcome = ref(false)
const hasLoaded = ref(false)
const welcomeSprite = ref('')
let headPatRevertTimer: ReturnType<typeof setTimeout> | null = null
let idleHideTimer: ReturnType<typeof setTimeout> | null = null
let chatEmotionTimer: ReturnType<typeof setTimeout> | null = null
let welcomeTimer: ReturnType<typeof setTimeout> | null = null
let stage1FiredPeriod: string | null = null

const cleanedStreamText = computed(() => {
  return streamText.value
    .replace(/\[voice:[^\]]*\][\s\S]*?\[\/voice\]/gi, '')
    .replace(/\[emotion\s*[:：=]\s*\w+\]/gi, '')
    .trim()
})

function onIdleEmotion(emotion: Emotion) {
  preIdleEmotion.value = displayEmotion.value
  displayEmotion.value = emotion
}

function onEmotionRevert() {
  displayEmotion.value = preIdleEmotion.value
}

function onIdleStage(stage: number, message: string, hintEmotion: Emotion) {
  // Stage 1: AI initiates conversation on its own with time context.
  // Stage 2+: send attention-seeking prompt from the idle conversation pool.
  let sendOpts: { skipHistory?: boolean; systemHint?: string; prompt?: string } = {}
  if (stage === 1) {
    // Fire only once per time period
    const currentPeriod = getTimePeriod()
    if (stage1FiredPeriod === currentPeriod) return
    const tg = getTimeGreeting()
    hintEmotion = tg.defaultEmotion
    message = ''
    sendOpts = { skipHistory: true, prompt: tg.greetingHint }
    stage1FiredPeriod = currentPeriod
  }
  idleReply.value = true
  displayEmotion.value = hintEmotion
  if (chatEmotionTimer) { clearTimeout(chatEmotionTimer); chatEmotionTimer = null }
  if (headPatRevertTimer) { clearTimeout(headPatRevertTimer); headPatRevertTimer = null }

  sendMessage(message, sendOpts).then(result => {
    const cleanText = result.response.replace(/\[voice:[^\]]*\][\s\S]*?\[\/voice\]/gi, '').replace(/\[emotion\s*[:：=]\s*\w+\]/gi, '').trim()
    displayEmotion.value = result.emotion as Emotion
    lastFullResponse.value = result.response
    idleReplyText.value = cleanText
    speak(result.response)
    // Auto-hide after 20s regardless of voice
    if (idleHideTimer) clearTimeout(idleHideTimer)
    idleHideTimer = setTimeout(() => {
      idleReply.value = false
      idleReplyText.value = ''
      displayEmotion.value = 'normal'
      idleHideTimer = null
    }, 12_000)
  }).catch(() => { /* silent */ })
}

const { resetTimer } = useIdleBehavior({
  isStreaming,
  isSpeaking,
  isChatOpen: showChat,
  onIdleEmotion,
  onEmotionRevert,
  onIdleStage
})

const { isDragging } = usePetDrag()

const lastAiText = computed(() => {
  const aiMessages = chatStore.messages.filter(m => m.role === 'assistant')
  const last = aiMessages[aiMessages.length - 1]
  return last ? last.content : ''
})

const needsApiSetup = computed(() => !store.apiKey)
const welcomeText = computed(() => {
  if (!hasLoaded.value) return '正在醒来...'
  if (needsApiSetup.value) return '还没有配置 API Key，先把连接设好吧。'
  return '我在这里。想说话的话，点一下开始就好。'
})
const welcomeCharacterName = computed(() => {
  const active = store.characters.find(c => c.id === store.activeCharacterId)
  return active?.name || '桌宠'
})
const welcomeInitial = computed(() => welcomeCharacterName.value.trim().slice(0, 1) || '宠')
const welcomeSpritePath = computed(() => store.sprites.normal?.images?.[0] || '')
const shouldShowWelcome = computed(() => {
  return showWelcome.value && !showChat.value && !showHistory.value && !showSettings.value && !showMemory.value && !headPatReply.value && !idleReply.value
})

async function loadWelcomeSprite(path: string) {
  welcomeSprite.value = ''
  if (!path) return
  try {
    welcomeSprite.value = await invoke<string>('read_image_base64', { path })
  } catch {
    welcomeSprite.value = ''
  }
}

let unlisten: (() => void) | null = null

onMounted(async () => {
  await store.load()
  await chatStore.load()
  await loadWelcomeSprite(welcomeSpritePath.value)
  hasLoaded.value = true
  showWelcome.value = true
  displayEmotion.value = needsApiSetup.value ? 'curious' : 'smile'
  if (!needsApiSetup.value) {
    welcomeTimer = setTimeout(() => {
      showWelcome.value = false
      welcomeTimer = null
    }, 10_000)
  }
  unlisten = await listen('open-settings', () => {
    showSettings.value = true
  })
  if (store.vitsAutoStart && store.vitsEndpoint) {
    invoke('start_vits_server').catch(() => { /* silent */ })
  }
})

onUnmounted(() => {
  unlisten?.()
  if (welcomeTimer) clearTimeout(welcomeTimer)
})

function openChatFromWelcome() {
  showWelcome.value = false
  showChat.value = true
  resetTimer()
}

function openSettingsFromWelcome() {
  showWelcome.value = false
  showSettings.value = true
  resetTimer()
}

function openMemoryFromWelcome() {
  showWelcome.value = false
  showMemory.value = true
  resetTimer()
}

function onClickPet(event: MouseEvent) {
  if (isStreaming.value) return
  stop()
  resetTimer()
  showWelcome.value = false

  const target = event.currentTarget as HTMLElement
  const rect = target.getBoundingClientRect()
  const yRatio = (event.clientY - rect.top) / rect.height

  // Head pat: top 35%
  if (yRatio < 0.35) {
    headPatReply.value = true
    onSend('（轻轻摸了摸你的头）', { skipThinking: true, skipHistory: true, systemHint: '主人正在温柔地摸你的头，你感到害羞和开心。' })
    return
  }

  // Belly poke: middle 35%-65%
  if (yRatio >= 0.35 && yRatio < 0.65) {
    headPatReply.value = true
    onSend('（戳了戳你的肚子）', { skipThinking: true, skipHistory: true, systemHint: '主人戳了戳你的肚子，你有点惊讶又害羞。' })
    return
  }

  showChat.value = !showChat.value
  if (!showChat.value) {
    reset()
  }
}

async function onSend(text: string, opts?: { skipThinking?: boolean; skipHistory?: boolean; systemHint?: string }) {
  resetTimer()
  if (chatEmotionTimer) { clearTimeout(chatEmotionTimer); chatEmotionTimer = null }
  if (!opts?.skipHistory) {
    chatStore.addMessage({ role: 'user', content: text })
  }
  if (!opts?.skipThinking) {
    displayEmotion.value = 'thinking'
  }

  try {
    const result = await sendMessage(text, { skipHistory: opts?.skipHistory, systemHint: opts?.systemHint })
    // Strip voice tag for display
    const cleanText = result.response.replace(/\[voice:[^\]]*\][\s\S]*?\[\/voice\]/gi, '').replace(/\[emotion\s*[:：=]\s*\w+\]/gi, '').trim()
    displayEmotion.value = result.emotion as Emotion

    if (!opts?.skipHistory) {
      chatStore.addMessage({
        role: 'assistant',
        content: cleanText,
        emotion: result.emotion as Emotion
      })
    }

    // Revert emotion to normal after 12s
    if (chatEmotionTimer) clearTimeout(chatEmotionTimer)
    chatEmotionTimer = setTimeout(() => {
      displayEmotion.value = 'normal'
      chatEmotionTimer = null
    }, 12_000)

    // Save full response for replay
    lastFullResponse.value = result.response
    if (opts?.skipThinking) {
      headPatReplyText.value = cleanText
      if (headPatRevertTimer) clearTimeout(headPatRevertTimer)
      headPatRevertTimer = setTimeout(() => {
        displayEmotion.value = 'normal'
        headPatReply.value = false
        headPatReplyText.value = ''
        headPatRevertTimer = null
      }, 12_000)
    }

    if (store.vitsEndpoint) {
      speak(result.response)
    }
  } catch (err: unknown) {
    const errorText = err instanceof Error ? err.message : '出错了...'
    if (!opts?.skipHistory) {
      chatStore.addMessage({
        role: 'assistant',
        content: errorText,
        emotion: 'helpless' as Emotion
      })
    }
    displayEmotion.value = 'helpless'
    if (opts?.skipThinking) {
      if (headPatRevertTimer) clearTimeout(headPatRevertTimer)
      headPatRevertTimer = setTimeout(() => {
        displayEmotion.value = 'normal'
        headPatReply.value = false
        headPatReplyText.value = ''
        headPatRevertTimer = null
      }, 12_000)
    }
  }
}

function onCloseChat() {
  resetTimer()
  showChat.value = false
  reset()
  stop()
}

function onClearHistory() {
  chatStore.clearMessages()
  displayEmotion.value = 'normal'
}

function replayVoice() {
  if (lastFullResponse.value && store.vitsEndpoint) {
    stop()
    speak(lastFullResponse.value)
  }
}

function replayFromHistory(text: string, idx: number) {
  if (store.vitsEndpoint) {
    stop()
    speakingMsgIdx.value = idx
    speak(text)
  }
}

watch(isSpeaking, (val) => {
  if (!val) {
    speakingMsgIdx.value = -1
  }
})

watch(welcomeSpritePath, (path) => {
  loadWelcomeSprite(path)
})
</script>

<template>
  <div class="pet-container">
    <!-- History panel (toggle via button) -->
    <transition name="fade">
      <div v-if="showHistory" class="history-panel" @click.stop>
        <div class="history-header">
          <span>聊天记录</span>
          <button class="history-close" @click="showHistory = false">✕</button>
        </div>
        <div class="history-body">
          <ChatHistory
            :messages="chatStore.messages"
            stream-text=""
            :is-streaming="false"
            :is-speaking="isSpeaking"
            :speaking-idx="speakingMsgIdx"
            @replay="replayFromHistory"
          />
        </div>
        <button class="history-clear-btn" @click="onClearHistory">清空记录</button>
      </div>
    </transition>

    <div class="pet-main">
      <PetStage
        :emotion="displayEmotion"
        :is-dragging="isDragging"
        @click-pet="onClickPet"
        @click-settings="showSettings = true"
      />

      <transition name="welcome">
        <div v-if="shouldShowWelcome" class="welcome-panel" @click.stop>
          <div class="welcome-head">
            <div class="welcome-mark">
              <img
                v-if="welcomeSprite"
                :src="welcomeSprite"
                alt=""
                draggable="false"
              />
              <span v-else>{{ welcomeInitial }}</span>
            </div>
            <div>
              <div class="welcome-kicker">当前角色</div>
              <div class="welcome-name">{{ welcomeCharacterName }}</div>
            </div>
          </div>
          <div class="welcome-text">{{ welcomeText }}</div>
          <div class="welcome-actions">
            <button
              v-if="needsApiSetup"
              class="welcome-btn primary"
              @click="openSettingsFromWelcome"
            >
              去设置
            </button>
            <button
              v-else
              class="welcome-btn primary"
              @click="openChatFromWelcome"
            >
              开始聊天
            </button>
            <button class="welcome-icon-btn" title="设置" @click="openSettingsFromWelcome">
              ⚙
            </button>
            <button class="welcome-icon-btn" title="记忆" @click="openMemoryFromWelcome">
              🧠
            </button>
            <button class="welcome-icon-btn" title="收起" @click="showWelcome = false">
              ×
            </button>
          </div>
        </div>
      </transition>
    </div>

    <!-- AI reply: positioned to the left of character's head -->
    <transition name="fade">
      <div v-if="(showChat || headPatReply || idleReply) && (lastAiText || idleReplyText || headPatReplyText || cleanedStreamText || (isStreaming && streamText))" class="ai-reply-area">
        <ChatBubble
          role="assistant"
          :text="idleReply ? (idleReplyText || cleanedStreamText) : headPatReply ? (headPatReplyText || cleanedStreamText) : lastAiText"
          :stream-text="cleanedStreamText"
          :is-streaming="isStreaming"
          :is-speaking="isSpeaking"
          hide-arrow
        />
        <button
          v-if="lastFullResponse && !isStreaming"
          class="replay-btn"
          :class="{ playing: isSpeaking }"
          @click="replayVoice"
          :title="isSpeaking ? '播放中...' : '重读回复'"
        >
          {{ isSpeaking ? '🔊' : '📢' }}
        </button>
      </div>
    </transition>

    <!-- Bottom: input area -->
    <transition name="fade">
      <div v-if="showChat" class="chat-area">
        <div class="chat-row">
          <button class="history-btn" @click="showHistory = !showHistory" title="聊天记录">
            📋
          </button>
          <button class="history-btn" @click="showMemory = true" title="长期记忆">
            🧠
          </button>
          <ChatInput
            :is-streaming="isStreaming"
            @send="onSend"
            @close="onCloseChat"
          />
        </div>
      </div>
    </transition>
    <SettingsModal
      :visible="showSettings"
      @close="showSettings = false"
    />
    <MemoryModal
      :visible="showMemory"
      @close="showMemory = false"
    />
  </div>
</template>

<style>
@import url('https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@400;500;700&display=swap');

.pet-container {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-end;
  padding-bottom: 8px;
  font-family: 'Noto Sans SC', 'Microsoft YaHei', sans-serif;
  position: relative;
  box-sizing: border-box;
  pointer-events: none;
}
.pet-container > .pet-main,
.pet-container > .chat-area,
.pet-container > .ai-reply-area,
.pet-container > .history-panel {
  pointer-events: auto;
}
.pet-main {
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-end;
  flex-shrink: 0;
}
.chat-area {
  flex-shrink: 0;
  padding: 2px 0 6px;
}
.chat-row {
  display: flex;
  align-items: center;
  gap: 6px;
}
.history-btn {
  background: rgba(255, 255, 255, 0.52);
  border: 1px solid rgba(255, 255, 255, 0.62);
  border-radius: 50%;
  width: 34px;
  height: 34px;
  font-size: 16px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: background 0.2s;
}
.history-btn:hover {
  background: rgba(255, 255, 255, 0.72);
}
.history-panel {
  position: absolute;
  inset: 0;
  background: linear-gradient(145deg, rgba(255, 255, 255, 0.78), rgba(255, 255, 255, 0.52));
  backdrop-filter: blur(18px) saturate(1.18);
  z-index: 50;
  display: flex;
  flex-direction: column;
  border-radius: 12px;
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.7);
  box-shadow:
    0 12px 30px rgba(70, 78, 110, 0.16),
    inset 0 1px 0 rgba(255, 255, 255, 0.82);
}
.history-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  border-bottom: 1px solid rgba(185, 193, 218, 0.42);
  color: #2b3040;
  font-size: 15px;
  font-weight: 600;
}
.history-close {
  background: none;
  border: none;
  color: #697084;
  font-size: 16px;
  cursor: pointer;
}
.history-close:hover {
  color: #2f3545;
}
.history-body {
  flex: 1;
  overflow-y: auto;
  padding: 12px;
}
.history-body::-webkit-scrollbar {
  width: 3px;
}
.history-body::-webkit-scrollbar-thumb {
  background: rgba(128, 136, 168, 0.26);
  border-radius: 2px;
}
.history-clear-btn {
  margin: 8px 16px 12px;
  background: rgba(255, 120, 120, 0.36);
  border: none;
  border-radius: 8px;
  padding: 8px;
  color: #b34242;
  font-size: 13px;
  cursor: pointer;
  font-family: inherit;
}
.history-clear-btn:hover {
  background: rgba(255, 120, 120, 0.52);
}

.welcome-panel {
  position: relative;
  width: min(320px, calc(100% - 28px));
  padding: 12px;
  margin: -4px auto 8px;
  border-radius: 8px;
  background: linear-gradient(145deg, rgba(255, 255, 255, 0.72), rgba(255, 255, 255, 0.46));
  border: 1px solid rgba(255, 255, 255, 0.7);
  box-shadow:
    0 12px 30px rgba(70, 78, 110, 0.16),
    inset 0 1px 0 rgba(255, 255, 255, 0.82);
  backdrop-filter: blur(18px) saturate(1.18);
  color: #262a36;
  z-index: 12;
  flex-shrink: 0;
}
.welcome-head {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 9px;
}
.welcome-mark {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  flex-shrink: 0;
  background:
    radial-gradient(circle at 34% 22%, rgba(255, 255, 255, 0.92), transparent 38%),
    rgba(255, 255, 255, 0.42);
  border: 1px solid rgba(255, 255, 255, 0.72);
  box-shadow:
    0 6px 18px rgba(78, 88, 126, 0.13),
    inset 0 1px 0 rgba(255, 255, 255, 0.72);
}
.welcome-mark img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: top center;
}
.welcome-mark span {
  font-size: 19px;
  font-weight: 700;
  color: #596078;
}
.welcome-kicker {
  font-size: 11px;
  line-height: 1;
  color: #7b8194;
  font-weight: 700;
  margin-bottom: 5px;
}
.welcome-name {
  max-width: 150px;
  font-size: 15px;
  line-height: 1.1;
  color: #202431;
  font-weight: 700;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.welcome-text {
  font-size: 13px;
  line-height: 1.55;
  color: #50576a;
  overflow-wrap: anywhere;
}
.welcome-actions {
  display: flex;
  align-items: center;
  gap: 7px;
  margin-top: 11px;
}
.welcome-btn,
.welcome-icon-btn {
  border: none;
  font-family: inherit;
  cursor: pointer;
  transition: background 0.2s, transform 0.2s, color 0.2s;
}
.welcome-btn {
  min-height: 30px;
  padding: 0 13px;
  border-radius: 8px;
  font-size: 13px;
  color: #ffffff;
}
.welcome-btn.primary {
  background: #6f78e8;
}
.welcome-btn.primary:hover {
  background: #5d67dd;
  transform: translateY(-1px);
}
.welcome-icon-btn {
  width: 30px;
  height: 30px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.42);
  border: 1px solid rgba(255, 255, 255, 0.58);
  color: #697084;
  font-size: 15px;
}
.welcome-icon-btn:hover {
  background: rgba(255, 255, 255, 0.68);
  color: #2f3545;
}

.ai-reply-area {
  position: absolute;
  top: 12%;
  left: 8px;
  width: fit-content;
  max-width: calc(50% - 40px);
  z-index: 10;
  display: flex;
  align-items: flex-end;
  gap: 4px;
}
.replay-btn {
  background: rgba(255, 255, 255, 0.52);
  border: 1px solid rgba(255, 255, 255, 0.62);
  border-radius: 50%;
  width: 28px;
  height: 28px;
  font-size: 13px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: all 0.2s;
  margin-bottom: 2px;
}
.replay-btn:hover {
  background: rgba(255, 255, 255, 0.72);
}
.replay-btn.playing {
  background: rgba(120, 210, 150, 0.62);
  animation: pulse 1s infinite;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.25s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
.welcome-enter-active,
.welcome-leave-active {
  transition: opacity 0.24s ease, transform 0.24s ease;
}
.welcome-enter-from,
.welcome-leave-to {
  opacity: 0;
  transform: translateY(8px) scale(0.98);
}
</style>
