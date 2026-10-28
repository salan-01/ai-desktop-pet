<script setup lang="ts">
import { ref, nextTick, watch } from 'vue'
import { useSpeechRecognition } from '@/composables/useSpeechRecognition'

const props = defineProps<{
  isStreaming: boolean
}>()

const emit = defineEmits<{
  (e: 'send', text: string): void
  (e: 'close'): void
}>()

const inputText = ref('')
const inputRef = ref<HTMLInputElement | null>(null)

const { isListening, interimText, isSupported, toggle } = useSpeechRecognition()

watch(() => props.isStreaming, (val) => {
  if (!val) {
    nextTick(() => inputRef.value?.focus())
  }
})

watch(interimText, (val) => {
  if (val) {
    inputText.value = val
  }
})

function onSend() {
  const text = inputText.value.trim()
  if (!text || props.isStreaming) return
  emit('send', text)
  inputText.value = ''
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    onSend()
  }
  if (e.key === 'Escape') {
    emit('close')
  }
}
</script>

<template>
  <div class="chat-input-area">
    <input
      ref="inputRef"
      v-model="inputText"
      class="chat-input"
      type="text"
      placeholder="想和她说些什么..."
      :disabled="isStreaming"
      @keydown="onKeydown"
    />
    <button
      class="send-btn"
      :disabled="isStreaming || !inputText.trim()"
      @click="onSend"
    >
      发送
    </button>
    <button
      class="mic-btn"
      :class="{ recording: isListening }"
      :disabled="!isSupported || props.isStreaming"
      :title="isListening ? '正在录音...' : '语音输入'"
      @click="toggle"
    >
      {{ isListening ? '⏹' : '🎤' }}
    </button>
    <button class="close-btn" @click="emit('close')" title="关闭">✕</button>
  </div>
</template>

<style scoped>
.chat-input-area {
  display: flex;
  gap: 6px;
  align-items: center;
  width: 100%;
  max-width: 360px;
}
.chat-input {
  flex: 1;
  background: linear-gradient(145deg, rgba(255, 255, 255, 0.74), rgba(255, 255, 255, 0.5));
  backdrop-filter: blur(18px) saturate(1.18);
  border: 1px solid rgba(255, 255, 255, 0.72);
  border-radius: 20px;
  padding: 8px 16px;
  color: #2b3040;
  font-size: 14px;
  outline: none;
  font-family: inherit;
  min-width: 0;
  box-shadow:
    0 8px 22px rgba(70, 78, 110, 0.13),
    inset 0 1px 0 rgba(255, 255, 255, 0.8);
}
.chat-input:focus {
  border-color: rgba(126, 136, 230, 0.72);
}
.chat-input::placeholder {
  color: rgba(80, 87, 106, 0.48);
}
.send-btn {
  background: #6f78e8;
  border: none;
  border-radius: 20px;
  padding: 8px 16px;
  color: white;
  font-size: 13px;
  cursor: pointer;
  font-family: inherit;
  white-space: nowrap;
  transition: background 0.2s;
  box-shadow: 0 8px 20px rgba(88, 96, 190, 0.22);
}
.send-btn:hover:not(:disabled) {
  background: #5d67dd;
}
.send-btn:disabled {
  opacity: 0.4;
  cursor: default;
}
.close-btn {
  background: rgba(255, 255, 255, 0.52);
  border: 1px solid rgba(255, 255, 255, 0.62);
  border-radius: 50%;
  width: 32px;
  height: 32px;
  color: #697084;
  font-size: 14px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: all 0.2s;
}
.close-btn:hover {
  background: rgba(255, 120, 120, 0.72);
  color: #ffffff;
}
.mic-btn {
  background: rgba(255, 255, 255, 0.52);
  border: 1px solid rgba(255, 255, 255, 0.62);
  border-radius: 50%;
  width: 32px;
  height: 32px;
  font-size: 14px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: all 0.2s;
}
.mic-btn:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.72);
}
.mic-btn.recording {
  background: rgba(255, 60, 60, 0.7);
  animation: mic-pulse 1.5s infinite;
}
.mic-btn:disabled {
  opacity: 0.4;
  cursor: default;
}
@keyframes mic-pulse {
  0%, 100% { box-shadow: 0 0 0 0 rgba(255, 60, 60, 0.5); }
  50% { box-shadow: 0 0 0 6px rgba(255, 60, 60, 0); }
}
</style>
