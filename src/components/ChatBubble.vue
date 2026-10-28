<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  role: 'user' | 'assistant'
  text: string
  streamText: string
  isStreaming: boolean
  isSpeaking: boolean
  hideArrow?: boolean
}>()

const displayText = computed(() => {
  if (props.isStreaming && props.streamText) return props.streamText
  if (props.text) return props.text
  return ''
})

const visible = computed(() => {
  if (props.role === 'user') return props.text.length > 0
  return props.isStreaming || props.text.length > 0
})
</script>

<template>
  <div v-if="visible" :class="['chat-bubble', role, { 'no-arrow': hideArrow }]">
    <div class="bubble-content">
      <span class="bubble-text">{{ displayText }}</span>
      <span v-if="role === 'assistant' && isStreaming" class="cursor">|</span>
    </div>
    <div v-if="role === 'assistant' && isSpeaking" class="speaking-indicator" title="正在说话...">
      🔊
    </div>
  </div>
</template>

<style scoped>
.chat-bubble {
  position: relative;
  backdrop-filter: blur(18px) saturate(1.18);
  padding: 12px 16px;
  max-width: 320px;
  min-width: 80px;
  word-break: break-word;
  border: 1px solid rgba(255, 255, 255, 0.7);
  box-shadow:
    0 10px 26px rgba(70, 78, 110, 0.16),
    inset 0 1px 0 rgba(255, 255, 255, 0.82);
}
.chat-bubble.assistant {
  align-self: flex-start;
  background: linear-gradient(145deg, rgba(255, 255, 255, 0.74), rgba(255, 255, 255, 0.48));
  border-radius: 16px 16px 4px 16px;
}
/* Speech tail pointing toward character (right, bottom corner) */
.chat-bubble.assistant::after {
  content: '';
  position: absolute;
  bottom: 8px;
  left: 100%;
  width: 0;
  height: 0;
  border-top: 8px solid transparent;
  border-bottom: 8px solid transparent;
  border-left: 10px solid rgba(255, 255, 255, 0.62);
}
.chat-bubble.assistant.no-arrow::after {
  display: none;
}
.chat-bubble.user {
  align-self: flex-end;
  background: linear-gradient(145deg, rgba(246, 248, 255, 0.78), rgba(228, 232, 255, 0.56));
  border-radius: 16px 16px 4px 16px;
}
.bubble-content {
  color: #2b3040;
  font-size: 14px;
  line-height: 1.6;
}
.bubble-text {
  white-space: pre-wrap;
}
.cursor {
  display: inline;
  animation: blink 0.8s infinite;
  color: #6f78e8;
}
@keyframes blink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0; }
}
.speaking-indicator {
  position: absolute;
  top: -10px;
  right: -6px;
  font-size: 16px;
  animation: pulse 1s infinite;
}
@keyframes pulse {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.2); }
}
</style>
