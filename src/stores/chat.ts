import { defineStore } from 'pinia'
import { ref, watch } from 'vue'
import { invoke } from '@tauri-apps/api/core'
import type { ChatMessage } from '@/types'

const MAX_STORE_MESSAGES = 200
const MAX_API_MESSAGES = 40

export const useChatStore = defineStore('chat', () => {
  const messages = ref<ChatMessage[]>([])
  let loaded = false

  async function load() {
    if (loaded) return
    try {
      const data = await invoke<ChatMessage[]>('load_chat_history')
      if (data && Array.isArray(data)) {
        messages.value = data
      }
      loaded = true
    } catch {
      // Tauri API not available yet
    }
  }

  async function save() {
    try {
      await invoke('save_chat_history', { messages: messages.value })
    } catch { /* ignore */ }
  }

  function addMessage(msg: ChatMessage) {
    messages.value.push(msg)
    if (messages.value.length > MAX_STORE_MESSAGES) {
      messages.value = messages.value.slice(-MAX_STORE_MESSAGES)
    }
  }

  function clearMessages() {
    messages.value = []
  }

  function getApiMessages(maxMessages: number = MAX_API_MESSAGES): ChatMessage[] {
    return messages.value.slice(-maxMessages)
  }

  watch(messages, () => save(), { deep: true })

  return { messages, load, save, addMessage, clearMessages, getApiMessages }
})
