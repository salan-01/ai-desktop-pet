<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { invoke } from '@tauri-apps/api/core'
import { useSettingsStore } from '@/stores/settings'
import type { MemoryItem } from '@/types'

const props = defineProps<{
  visible: boolean
}>()

const emit = defineEmits<{
  (e: 'close'): void
}>()

const store = useSettingsStore()
const memories = ref<MemoryItem[]>([])
const query = ref('')
const draft = ref('')
const loading = ref(false)
const saving = ref(false)
const status = ref('')

const activeCharacterName = computed(() => {
  return store.characters.find(c => c.id === store.activeCharacterId)?.name || '当前角色'
})

const canUseMemory = computed(() => store.memoryEnabled && !!store.memoryMysqlUrl)
const memoryConfig = () => ({ url: store.memoryMysqlUrl })
const activeCharacterId = () => store.activeCharacterId || 'default'

async function loadMemories() {
  if (!canUseMemory.value) {
    memories.value = []
    status.value = '请先在设置中启用 MySQL 记忆。'
    return
  }
  loading.value = true
  status.value = ''
  try {
    memories.value = await invoke<MemoryItem[]>('search_memories', {
      config: memoryConfig(),
      characterId: activeCharacterId(),
      query: query.value.trim(),
      limit: 20
    })
    if (memories.value.length === 0) {
      status.value = query.value.trim() ? '没有找到匹配的记忆。' : '还没有记录。'
    }
  } catch (e) {
    status.value = `读取失败：${e}`
  } finally {
    loading.value = false
  }
}

async function addMemory() {
  const content = draft.value.trim()
  if (!content || !canUseMemory.value) return
  saving.value = true
  status.value = ''
  try {
    await invoke('save_memory', {
      config: memoryConfig(),
      characterId: activeCharacterId(),
      content,
      source: 'manual'
    })
    draft.value = ''
    await loadMemories()
    status.value = '已记住。'
  } catch (e) {
    status.value = `保存失败：${e}`
  } finally {
    saving.value = false
  }
}

async function deleteMemory(id: number) {
  if (!canUseMemory.value) return
  try {
    await invoke('delete_memory', {
      config: memoryConfig(),
      id
    })
    memories.value = memories.value.filter(memory => memory.id !== id)
    status.value = '已删除。'
  } catch (e) {
    status.value = `删除失败：${e}`
  }
}

function onBackdropClick(e: MouseEvent) {
  if ((e.target as HTMLElement).classList.contains('memory-backdrop')) {
    emit('close')
  }
}

watch(() => props.visible, visible => {
  if (visible) loadMemories()
})
</script>

<template>
  <Teleport to="body">
    <div v-if="visible" class="memory-backdrop" @click="onBackdropClick">
      <div class="memory-modal">
        <div class="memory-header">
          <div>
            <div class="memory-kicker">长期记忆</div>
            <h2>{{ activeCharacterName }}</h2>
          </div>
          <button class="icon-btn" title="关闭" @click="emit('close')">×</button>
        </div>

        <div class="memory-toolbar">
          <input
            v-model="query"
            type="text"
            placeholder="搜索记忆"
            @keydown.enter="loadMemories"
          />
          <button class="soft-btn" :disabled="loading" @click="loadMemories">
            {{ loading ? '读取中' : '搜索' }}
          </button>
        </div>

        <div class="memory-compose">
          <textarea
            v-model="draft"
            rows="3"
            placeholder="写下一条要记住的事"
            :disabled="!canUseMemory"
          />
          <button class="primary-btn" :disabled="saving || !draft.trim() || !canUseMemory" @click="addMemory">
            {{ saving ? '保存中' : '记住' }}
          </button>
        </div>

        <div v-if="status" class="memory-status">{{ status }}</div>

        <div class="memory-list">
          <div v-for="memory in memories" :key="memory.id" class="memory-item">
            <div class="memory-content">{{ memory.content }}</div>
            <div class="memory-meta">
              <span>{{ memory.source === 'manual' ? '手动' : '自动' }}</span>
              <span>{{ memory.createdAt }}</span>
              <button title="删除" @click="deleteMemory(memory.id)">删除</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.memory-backdrop {
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 18px;
  background: rgba(248, 250, 255, 0.68);
  backdrop-filter: blur(20px) saturate(1.18);
  -webkit-backdrop-filter: blur(20px) saturate(1.18);
  pointer-events: auto;
}

.memory-modal {
  width: min(520px, 100%);
  max-height: min(680px, 100%);
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 18px;
  border-radius: 8px;
  color: #2b3040;
  background: linear-gradient(145deg, rgba(255, 255, 255, 0.82), rgba(250, 252, 255, 0.64));
  border: 1px solid rgba(255, 255, 255, 0.76);
  box-shadow:
    0 20px 50px rgba(70, 78, 110, 0.18),
    inset 0 1px 0 rgba(255, 255, 255, 0.86);
}

.memory-header,
.memory-toolbar,
.memory-compose,
.memory-meta {
  display: flex;
  align-items: center;
  gap: 10px;
}

.memory-header {
  justify-content: space-between;
}

.memory-kicker {
  font-size: 12px;
  color: #7b8194;
}

h2 {
  margin: 2px 0 0;
  font-size: 18px;
  font-weight: 700;
  color: #242936;
}

.icon-btn,
.soft-btn,
.primary-btn,
.memory-meta button {
  font-family: inherit;
  cursor: pointer;
  border-radius: 8px;
  transition: background 0.2s, color 0.2s, opacity 0.2s;
}

.icon-btn {
  width: 32px;
  height: 32px;
  border: 1px solid rgba(255, 255, 255, 0.62);
  background: rgba(255, 255, 255, 0.5);
  color: #697084;
  font-size: 20px;
}

.icon-btn:hover,
.soft-btn:hover,
.memory-meta button:hover {
  background: rgba(255, 255, 255, 0.78);
  color: #2f3545;
}

.memory-toolbar input,
.memory-compose textarea {
  width: 100%;
  box-sizing: border-box;
  border: 1px solid rgba(255, 255, 255, 0.72);
  border-radius: 8px;
  outline: none;
  background: rgba(255, 255, 255, 0.58);
  color: #2b3040;
  font-family: inherit;
  font-size: 13px;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.78);
}

.memory-toolbar input {
  flex: 1;
  padding: 10px 12px;
}

.memory-compose {
  align-items: stretch;
}

.memory-compose textarea {
  resize: vertical;
  min-height: 76px;
  padding: 10px 12px;
}

.soft-btn,
.primary-btn {
  white-space: nowrap;
  border: none;
  padding: 0 16px;
  font-size: 13px;
}

.soft-btn {
  min-height: 38px;
  border: 1px solid rgba(255, 255, 255, 0.62);
  background: rgba(255, 255, 255, 0.5);
  color: #697084;
}

.primary-btn {
  min-width: 68px;
  background: #6f78e8;
  color: white;
}

.primary-btn:hover {
  background: #5d67dd;
}

button:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.memory-status {
  min-height: 18px;
  font-size: 12px;
  color: #7b8194;
}

.memory-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
  overflow-y: auto;
  padding-right: 2px;
}

.memory-item {
  padding: 12px;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.46);
  border: 1px solid rgba(255, 255, 255, 0.66);
}

.memory-content {
  white-space: pre-wrap;
  word-break: break-word;
  font-size: 13px;
  line-height: 1.55;
}

.memory-meta {
  justify-content: flex-end;
  margin-top: 8px;
  font-size: 11px;
  color: #8a91a4;
}

.memory-meta button {
  border: none;
  padding: 3px 8px;
  background: rgba(255, 120, 120, 0.16);
  color: #b34242;
}
</style>
