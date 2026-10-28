<script setup lang="ts">
import { ref, watch, nextTick, onMounted, computed } from 'vue'
import ChatBubble from './ChatBubble.vue'
import type { ChatMessage } from '@/types'

const props = defineProps<{
  messages: ChatMessage[]
  streamText: string
  isStreaming: boolean
  isSpeaking: boolean
  speakingIdx?: number
  filterRole?: 'user' | 'assistant'
  hideEmpty?: boolean
}>()

const emit = defineEmits<{
  (e: 'replay', text: string, idx: number): void
}>()

const filteredMessages = computed(() => {
  if (!props.filterRole) return props.messages
  return props.messages.filter(m => m.role === props.filterRole)
})

const showStreaming = computed(() => {
  if (props.filterRole && props.filterRole !== 'assistant') return false
  return props.isStreaming && props.streamText
})

const scrollContainer = ref<HTMLElement | null>(null)

function scrollToBottom() {
  nextTick(() => {
    if (scrollContainer.value) {
      scrollContainer.value.scrollTop = scrollContainer.value.scrollHeight
    }
  })
}

watch(() => filteredMessages.value.length, scrollToBottom)
watch(() => props.streamText, scrollToBottom)
onMounted(() => nextTick(scrollToBottom))
</script>

<template>
  <div ref="scrollContainer" class="chat-history">
    <div v-for="(msg, idx) in filteredMessages" :key="idx" :class="['msg-row', msg.role]">
      <ChatBubble
        :role="msg.role"
        :text="msg.content"
        stream-text=""
        :is-streaming="false"
        :is-speaking="false"
        hide-arrow
      />
      <button
        v-if="msg.role === 'assistant'"
        class="replay-btn"
        :class="{ playing: speakingIdx === idx }"
        @click="emit('replay', msg.content, idx)"
        :title="speakingIdx === idx ? '播放中...' : '重读'"
      >
        {{ speakingIdx === idx ? '🔊' : '📢' }}
      </button>
    </div>
    <ChatBubble
      v-if="showStreaming"
      role="assistant"
      text=""
      :stream-text="streamText"
      :is-streaming="true"
      :is-speaking="isSpeaking"
      hide-arrow
    />
    <div v-if="!hideEmpty && filteredMessages.length === 0 && !showStreaming" class="empty-hint">
      点击丛雨开始对话
    </div>
  </div>
</template>

<style scoped>
.chat-history {
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: 100%;
  max-width: 360px;
  height: 100%;
  overflow-y: auto;
  padding: 0 4px;
}
.chat-history::-webkit-scrollbar {
  width: 3px;
}
.chat-history::-webkit-scrollbar-thumb {
  background: rgba(128, 136, 168, 0.26);
  border-radius: 2px;
}
.empty-hint {
  text-align: center;
  color: rgba(80, 87, 106, 0.56);
  font-size: 12px;
  padding: 16px;
}
.msg-row {
  display: flex;
  align-items: flex-end;
  gap: 4px;
}
.msg-row.assistant {
  flex-direction: row;
}
.msg-row.user {
  flex-direction: row-reverse;
}
.replay-btn {
  background: rgba(255, 255, 255, 0.5);
  border: 1px solid rgba(255, 255, 255, 0.62);
  border-radius: 50%;
  width: 26px;
  height: 26px;
  font-size: 12px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: all 0.2s;
  margin-bottom: 4px;
}
.replay-btn:hover {
  background: rgba(255, 255, 255, 0.72);
}
.replay-btn.playing {
  background: rgba(120, 210, 150, 0.62);
}
</style>
