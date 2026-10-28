<script setup lang="ts">
import { ref, computed, watch, onUnmounted } from 'vue'
import { useSettingsStore } from '@/stores/settings'
import { useChatStore } from '@/stores/chat'
import { invoke } from '@tauri-apps/api/core'
import { getCurrentWindow } from '@tauri-apps/api/window'
import type { Emotion, SpriteSet, CharacterPreset, VitsSpeaker, ModelGroup } from '@/types'

const props = defineProps<{
  visible: boolean
}>()

const emit = defineEmits<{
  (e: 'close'): void
}>()

interface VitsPathInfo {
  path: string
  modelPath: string
  valid: boolean
  message: string
}

const store = useSettingsStore()
const chatStore = useChatStore()
const activeTab = ref<'api' | 'sprites' | 'character' | 'presets'>('api')
const imageCache = ref<Record<string, string>>({})
const editingCharId = ref<string | null>(null)

// VITS server state
const vitsStatus = ref<string>('stopped')
const vitsLoading = ref(false)
const vitsPathInfo = ref<VitsPathInfo | null>(null)
const vitsPathLoading = ref(false)
const memoryTesting = ref(false)
const memoryStatus = ref('')
const memoryStatusOk = ref(false)
let statusTimer: ReturnType<typeof setInterval> | null = null

const statusText = computed(() => {
  switch (vitsStatus.value) {
    case 'running': return '运行中'
    case 'starting': return '启动中...'
    case 'stopped': return '已停止'
    case 'error': return '异常'
    default: return '未知'
  }
})

// VITS speaker list
const vitsSpeakers = ref<VitsSpeaker[]>([])
const loadingSpeakers = ref(false)
const speakerFetchError = ref('')

// Model groups (from config.json in each model folder)
const modelGroups = ref<ModelGroup[]>([])
const selectedModelGroup = ref('')

const detectedVitsPath = computed(() => vitsPathInfo.value?.path || '')
const detectedModelPath = computed(() => vitsPathInfo.value?.modelPath || '')
const effectiveVitsPath = computed(() => store.vitsFolderPath || detectedVitsPath.value)
const effectiveModelPath = computed(() => store.vitsModelPath || detectedModelPath.value)
const vitsFolderPlaceholder = computed(() => detectedVitsPath.value || '选择 VITS 文件夹（包含 py310 和 app.py）')
const vitsModelPlaceholder = computed(() => detectedModelPath.value || '选择模型存放路径（通常是 VITS/data/models）')

// Speakers filtered by selected model group
const filteredSpeakers = computed(() => {
  if (!selectedModelGroup.value) return vitsSpeakers.value
  const group = modelGroups.value.find(g => g.name === selectedModelGroup.value)
  if (!group) return vitsSpeakers.value
  return vitsSpeakers.value.filter(s => group.speakers.includes(s.name))
})

async function refreshVitsPathInfo(path?: string) {
  vitsPathLoading.value = true
  try {
    vitsPathInfo.value = await invoke<VitsPathInfo>('get_vits_path_info', { path: path || store.vitsFolderPath || null })
  } catch (e) {
    vitsPathInfo.value = {
      path: '',
      modelPath: '',
      valid: false,
      message: String(e || '无法检测 VITS 路径')
    }
  } finally {
    vitsPathLoading.value = false
  }
}

async function fetchModelGroups() {
  const modelPath = effectiveModelPath.value
  if (!modelPath) {
    modelGroups.value = []
    return
  }
  try {
    modelGroups.value = await invoke<ModelGroup[]>('list_model_groups', { parent: modelPath })
  } catch {
    modelGroups.value = []
  }
}

async function fetchSpeakers() {
  if (!store.vitsEndpoint) return
  loadingSpeakers.value = true
  speakerFetchError.value = ''
  try {
    const baseUrl = store.vitsEndpoint.replace(/\/+$/, '')
    const res = await fetch(`${baseUrl}/voice/speakers`)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data = await res.json()
    const all: VitsSpeaker[] = []
    for (const key of Object.keys(data)) {
      if (Array.isArray(data[key])) {
        for (const s of data[key]) {
          all.push({ id: s.id, name: s.name, lang: s.lang || [], modelType: key })
        }
      }
    }
    vitsSpeakers.value = all
    // Sync model type for currently selected speaker
    const cur = vitsSpeakers.value.find(s => String(s.id) === store.vitsSpeakerId)
    if (cur) store.vitsModelType = cur.modelType
  } catch (e) {
    speakerFetchError.value = '无法获取语音列表'
    vitsSpeakers.value = []
  } finally {
    loadingSpeakers.value = false
  }
}

// When model groups load, keep selected group if it still exists
watch(modelGroups, (groups) => {
  if (selectedModelGroup.value && !groups.some(g => g.name === selectedModelGroup.value)) {
    selectedModelGroup.value = ''
  }
})

// Update model type when speaker changes
watch(() => store.vitsSpeakerId, (newId) => {
  const speaker = vitsSpeakers.value.find(s => String(s.id) === newId)
  if (speaker) {
    store.vitsModelType = speaker.modelType
  }
})

// Model management
const modelFolders = ref<{ name: string; path: string }[]>([])
const loadingModels = ref(false)

async function refreshModels() {
  const modelPath = effectiveModelPath.value
  if (!modelPath) {
    modelFolders.value = []
    return
  }
  loadingModels.value = true
  try {
    modelFolders.value = await invoke<{ name: string; path: string }[]>('list_model_folders', { parent: modelPath })
  } catch {
    modelFolders.value = []
  } finally {
    loadingModels.value = false
  }
}

async function addModel() {
  try {
    const destParent = effectiveModelPath.value
    if (!destParent) {
      alert('请先选择 VITS 文件夹或模型存放路径')
      return
    }
    const folder = await invoke<string>('select_folder', { startDir: destParent })
    if (!folder) return
    await invoke('copy_model_folder', { source: folder, destParent })
    await refreshModels()
    await fetchModelGroups()
  } catch (e) {
    alert('添加模型失败: ' + (e as any))
  }
}

async function deleteModel(path: string) {
  if (!confirm('确定要删除此语音模型吗？此操作不可撤销。')) return
  try {
    await invoke('delete_folder', { path })
    await refreshModels()
    await fetchModelGroups()
  } catch (e) {
    alert('删除失败: ' + (e as any))
  }
}

// Refresh models and model groups when API tab is active
watch(activeTab, (tab) => {
  if (tab === 'api') {
    refreshModels()
    fetchModelGroups()
    fetchSpeakers()
  }
}, { immediate: true })

watch(effectiveModelPath, () => {
  if (activeTab.value === 'api') {
    refreshModels()
    fetchModelGroups()
  }
})

const editingChar = computed(() =>
  editingCharId.value ? store.characters.find(c => c.id === editingCharId.value) ?? null : null
)

async function loadImage(path: string) {
  if (!path || imageCache.value[path]) return
  try {
    imageCache.value[path] = await invoke<string>('read_image_base64', { path })
  } catch { /* ignore */ }
}

function refreshCache(sprites?: Record<Emotion, SpriteSet>) {
  const s = sprites || store.sprites
  for (const em of emotions) {
    for (const img of s[em.key].images) {
      loadImage(img)
    }
  }
}

watch(() => props.visible, (v) => {
  if (v) {
    editingCharId.value = null
    refreshCache()
    refreshVitsPathInfo()
    startPolling()
  } else {
    stopPolling()
  }
})

async function pollStatus() {
  try {
    vitsStatus.value = await invoke<string>('get_vits_status')
  } catch {
    vitsStatus.value = 'error'
  }
}

function startPolling() {
  stopPolling()
  pollStatus()
  statusTimer = setInterval(pollStatus, 3000)
}

function stopPolling() {
  if (statusTimer) { clearInterval(statusTimer); statusTimer = null }
}

// Auto-fetch speakers when VITS server transitions to running
watch(vitsStatus, (newStatus, oldStatus) => {
  if (newStatus === 'running' && oldStatus !== 'running' && activeTab.value === 'api') {
    fetchSpeakers()
  }
})

async function browseFolder() {
  try {
    const startDir = effectiveVitsPath.value || null
    const folder = await invoke<string>('select_folder', { startDir })
    if (folder) {
      store.vitsFolderPath = folder
      await refreshVitsPathInfo(folder)
      if (vitsPathInfo.value?.valid) {
        await invoke('set_vits_path', { path: folder })
      }
    }
  } catch { /* cancelled */ }
}

async function browseModelPath() {
  try {
    const startDir = effectiveModelPath.value || null
    const folder = await invoke<string>('select_folder', { startDir })
    if (folder) {
      store.vitsModelPath = folder
    }
  } catch { /* cancelled */ }
}

// Drag-and-drop paths from Explorer
const dragOverModel = ref(false)
const dragOverVits = ref(false)
let unlistenDnd: (() => void) | null = null

async function setupDnd() {
  if (unlistenDnd) return
  unlistenDnd = await getCurrentWindow().onDragDropEvent((event) => {
    if (event.payload.type === 'leave') {
      dragOverModel.value = false
      dragOverVits.value = false
    } else if (event.payload.type === 'drop') {
      const paths = event.payload.paths
      if (paths.length > 0) {
        if (dragOverModel.value) {
          store.vitsModelPath = paths[0]
        } else if (dragOverVits.value) {
          store.vitsFolderPath = paths[0]
          refreshVitsPathInfo(paths[0]).then(() => {
            if (vitsPathInfo.value?.valid) {
              invoke('set_vits_path', { path: paths[0] })
            }
          })
        }
      }
      dragOverModel.value = false
      dragOverVits.value = false
    }
  })
}

function teardownDnd() {
  if (unlistenDnd) { unlistenDnd(); unlistenDnd = null }
}

// Setup DnD when modal opens
watch(() => props.visible, (v) => {
  if (v) {
    setupDnd()
  } else {
    teardownDnd()
  }
})

onUnmounted(() => { stopPolling(); teardownDnd() })

async function startVits() {
  vitsLoading.value = true
  try {
    await refreshVitsPathInfo()
    if (effectiveVitsPath.value) {
      await invoke('set_vits_path', { path: effectiveVitsPath.value })
    }
    const result = await invoke<string>('start_vits_server')
    vitsStatus.value = result === 'already_running' ? 'running' : result
    if (vitsStatus.value === 'running') {
      fetchSpeakers()
    }
  } catch (e) {
    vitsStatus.value = 'error'
    console.warn('启动 VITS 失败:', e)
  } finally {
    vitsLoading.value = false
  }
}

async function stopVits() {
  try {
    await invoke('stop_vits_server')
    vitsStatus.value = 'stopped'
  } catch (e) {
    console.warn('停止 VITS 失败:', e)
  }
}

async function testMemoryConnection() {
  if (!store.memoryMysqlUrl.trim()) {
    memoryStatus.value = '请先填写 MySQL 连接 URL'
    memoryStatusOk.value = false
    return
  }
  memoryTesting.value = true
  memoryStatus.value = ''
  try {
    await invoke('test_memory_connection', { config: { url: store.memoryMysqlUrl } })
    memoryStatus.value = '连接成功，记忆表已准备好'
    memoryStatusOk.value = true
  } catch (e) {
    memoryStatus.value = `连接失败：${e}`
    memoryStatusOk.value = false
  } finally {
    memoryTesting.value = false
  }
}

const emotions: { key: Emotion; label: string; emoji: string }[] = [
  { key: 'normal', label: '正常', emoji: '😐' },
  { key: 'eyeroll', label: '白眼', emoji: '🙄' },
  { key: 'embarrassed', label: '不怀好意', emoji: '😅' },
  { key: 'grin', label: '嘲笑', emoji: '😏' },
  { key: 'question', label: '发问', emoji: '❓' },
  { key: 'veryshy', label: '非常羞', emoji: '😳' },
  { key: 'happy', label: '高兴', emoji: '😊' },
  { key: 'shy', label: '害羞', emoji: '😚' },
  { key: 'curious', label: '好奇', emoji: '🤔' },
  { key: 'doubt', label: '怀疑', emoji: '🤨' },
  { key: 'frightened', label: '惊吓', emoji: '😨' },
  { key: 'weird', label: '奇怪', emoji: '😕' },
  { key: 'angry', label: '生气', emoji: '😠' },
  { key: 'thinking', label: '思考', emoji: '💭' },
  { key: 'sigh', label: '叹气', emoji: '😮‍💨' },
  { key: 'smile', label: '微笑', emoji: '🙂' },
  { key: 'helpless', label: '无奈', emoji: '🤷' },
  { key: 'excited', label: '兴奋', emoji: '🤩' },
  { key: 'serious', label: '严肃', emoji: '😤' },
  { key: 'shocked', label: '震惊', emoji: '😲' }
]

async function selectImages(emotion: Emotion, target?: Record<Emotion, SpriteSet>) {
  try {
    const files = await invoke<string[]>('select_images')
    if (files && files.length > 0) {
      const sp = target || store.sprites
      sp[emotion].images = files
      sp[emotion].expression = emotion
    }
  } catch { /* cancelled */ }
}

function removeSprite(emotion: Emotion, index: number, target?: Record<Emotion, SpriteSet>) {
  const sp = target || store.sprites
  sp[emotion].images.splice(index, 1)
}

function getConfiguredCount(sprites: Record<Emotion, SpriteSet>): number {
  return emotions.filter(e => sprites[e.key]?.images?.length > 0).length
}

function getMissingEmotions(sprites: Record<Emotion, SpriteSet>): string {
  return emotions.filter(e => !sprites[e.key]?.images?.length).map(e => e.label).join('、')
}

async function onImportFolder(target?: Record<Emotion, SpriteSet>) {
  try {
    const folderPath = await invoke<string>('select_folder', { startDir: null })
    if (!folderPath) return
    const spriteMap = await invoke<Record<string, string[]>>('import_sprites_from_folder', { folderPath })
    const count = Object.keys(spriteMap).length
    if (count === 0) {
      alert('未在文件夹中找到匹配的表情图片。请确保文件名包含表情英文名（如 happy.png）或中文名（如 开心.png）。')
      return
    }
    store.batchImportSprites(spriteMap, target)
    if (target) {
      refreshCache(target)
    } else {
      refreshCache()
    }
  } catch (e) {
    alert(`导入失败: ${e}`)
  }
}

function startEdit(char: CharacterPreset) {
  editingCharId.value = char.id
  if (char.sprites) refreshCache(char.sprites)
}

function stopEdit() {
  editingCharId.value = null
}

function onCreateCharacter() {
  const char = store.createCharacter('新角色')
  editingCharId.value = char.id
}

function onDeleteCharacter(id: string) {
  store.deleteCharacter(id)
  chatStore.clearMessages()
}

function onSetActive(id: string) {
  store.setActiveCharacter(id)
  chatStore.clearMessages()
}

function onBackdropClick(e: MouseEvent) {
  if ((e.target as HTMLElement).classList.contains('settings-backdrop')) {
    emit('close')
  }
}

const tabs = [
  { key: 'api' as const, label: 'API 设置' },
  { key: 'character' as const, label: '角色设定' },
  { key: 'sprites' as const, label: '立绘管理' },
  { key: 'presets' as const, label: '角色预设' },
]
</script>

<template>
  <Teleport to="body">
    <div v-if="visible" class="settings-backdrop" @click="onBackdropClick">
      <div class="settings-modal">
        <div class="modal-header">
          <h2>设置</h2>
          <button class="modal-close" @click="emit('close')">✕</button>
        </div>

        <div class="modal-tabs">
          <button
            v-for="tab in tabs"
            :key="tab.key"
            :class="['tab-btn', { active: activeTab === tab.key }]"
            @click="activeTab = tab.key"
          >
            {{ tab.label }}
          </button>
        </div>

        <div class="modal-body">
          <!-- API Settings -->
          <div v-if="activeTab === 'api'" class="tab-content">
            <label class="field">
              <span>DeepSeek API Key</span>
              <input v-model="store.apiKey" type="password" placeholder="sk-..." />
            </label>
            <label class="field">
              <span>API 地址</span>
              <input v-model="store.apiEndpoint" type="text" placeholder="https://api.deepseek.com/v1/chat/completions" />
            </label>
            <label class="field">
              <span>模型名称</span>
              <input v-model="store.model" type="text" placeholder="deepseek-chat" />
            </label>
            <div class="section-divider"><span>长期记忆</span></div>
            <label class="field checkbox-field">
              <div class="checkbox-row">
                <input v-model="store.memoryEnabled" type="checkbox" />
                <span>启用 MySQL 记忆存储</span>
              </div>
            </label>
            <label class="field">
              <span>MySQL 连接 URL</span>
              <div class="path-row">
                <input
                  v-model="store.memoryMysqlUrl"
                  type="password"
                  placeholder="mysql://user:password@127.0.0.1:3306/desktop_pet"
                />
                <button class="browse-btn" :disabled="memoryTesting" @click="testMemoryConnection">
                  {{ memoryTesting ? '测试中' : '测试' }}
                </button>
              </div>
              <span
                v-if="memoryStatus"
                :class="['path-hint', memoryStatusOk ? 'ok' : 'warn']"
              >
                {{ memoryStatus }}
              </span>
            </label>
            <label class="field checkbox-field">
              <div class="checkbox-row">
                <input v-model="store.memoryAutoSave" type="checkbox" />
                <span>自动保存“记住/我喜欢/我叫”等用户记忆</span>
              </div>
            </label>
            <div class="section-divider"><span>VITS 语音设置</span></div>
            <label class="field">
              <span>VITS 服务地址</span>
              <input v-model="store.vitsEndpoint" type="text" placeholder="http://localhost:23456/voice" />
            </label>
            <label class="field">
              <span>语音模型组</span>
              <div class="speaker-row">
                <select v-model="selectedModelGroup" class="speaker-select">
                  <option value="">-- 全部模型 --</option>
                  <option v-for="g in modelGroups" :key="g.name" :value="g.name">
                    {{ g.name }} ({{ g.speakers.length }}个角色)
                  </option>
                </select>
                <button class="refresh-btn" :disabled="loadingSpeakers" @click="fetchModelGroups" title="刷新模型组列表">
                  刷新
                </button>
              </div>
            </label>
            <label class="field">
              <span>说话人 / 语音角色</span>
              <div class="speaker-row">
                <select v-model="store.vitsSpeakerId" class="speaker-select">
                  <option value="">-- 手动输入ID --</option>
                  <option v-for="s in filteredSpeakers" :key="s.id" :value="String(s.id)">
                    {{ s.name }} (ID: {{ s.id }})
                  </option>
                </select>
                <button class="refresh-btn" :disabled="loadingSpeakers || vitsStatus !== 'running'" @click="fetchSpeakers" title="从服务器获取语音列表">
                  {{ loadingSpeakers ? '...' : '刷新' }}
                </button>
              </div>
              <input v-if="store.vitsSpeakerId && !vitsSpeakers.some(s => String(s.id) === store.vitsSpeakerId)" v-model="store.vitsSpeakerId" type="text" placeholder="手动输入说话人ID" class="speaker-manual" />
              <span v-if="speakerFetchError" class="fetch-error">{{ speakerFetchError }}</span>
            </label>
            <div class="section-divider"><span>VITS 模型管理</span></div>
            <label class="field">
              <span>模型存放路径</span>
              <div
                class="path-row"
                :class="{ 'drop-active': dragOverModel }"
                @dragover.prevent="dragOverModel = true"
                @dragleave="dragOverModel = false"
              >
                <input v-model="store.vitsModelPath" type="text" :placeholder="vitsModelPlaceholder" />
                <button class="browse-btn" @click="browseModelPath">浏览</button>
              </div>
              <span v-if="!store.vitsModelPath && detectedModelPath" class="path-hint">已自动使用：{{ detectedModelPath }}</span>
            </label>
            <div class="model-list-section">
              <div class="model-list-header">
                <span>已安装的语音模型</span>
                <div class="model-header-actions">
                  <button class="refresh-btn small" :disabled="loadingModels" @click="refreshModels" title="刷新模型列表">
                    {{ loadingModels ? '...' : '刷新' }}
                  </button>
                  <button class="add-model-btn" @click="addModel">+ 添加模型</button>
                </div>
              </div>
              <div v-if="modelFolders.length === 0 && !loadingModels" class="model-empty">
                暂无模型，请添加模型到模型存放路径
              </div>
              <div v-for="m in modelFolders" :key="m.path" class="model-item">
                <div class="model-item-info">
                  <span class="model-item-name">{{ m.name }}</span>
                  <span class="model-item-path">{{ m.path }}</span>
                </div>
                <button class="model-delete-btn" @click="deleteModel(m.path)" title="删除模型">删除</button>
              </div>
            </div>
            <div class="section-divider"><span>VITS 服务器管理</span></div>
            <label class="field">
              <span>VITS 文件夹路径</span>
              <div
                class="path-row"
                :class="{ 'drop-active': dragOverVits }"
                @dragover.prevent="dragOverVits = true"
                @dragleave="dragOverVits = false"
              >
                <input v-model="store.vitsFolderPath" type="text" :placeholder="vitsFolderPlaceholder" />
                <button class="browse-btn" @click="browseFolder">浏览</button>
              </div>
              <span
                v-if="vitsPathInfo"
                :class="['path-hint', vitsPathInfo.valid ? 'ok' : 'warn']"
              >
                {{ vitsPathLoading ? '正在检测 VITS 路径...' : vitsPathInfo.message }}
              </span>
            </label>
            <label class="field checkbox-field">
              <div class="checkbox-row">
                <input v-model="store.vitsAutoStart" type="checkbox" />
                <span>启动应用时自动运行 VITS 服务器</span>
              </div>
            </label>
            <div class="vits-status-row">
              <span class="status-label">服务器状态</span>
              <span :class="['status-badge', vitsStatus]">{{ statusText }}</span>
              <button
                v-if="vitsStatus === 'stopped' || vitsStatus === 'error'"
                class="vits-action-btn start"
                :disabled="vitsLoading"
                @click="startVits"
              >
                {{ vitsLoading ? '启动中...' : '启动' }}
              </button>
              <button
                v-if="vitsStatus === 'running'"
                class="vits-action-btn stop"
                @click="stopVits"
              >
                停止
              </button>
            </div>
          </div>

          <!-- Character Settings -->
          <div v-if="activeTab === 'character'" class="tab-content">
            <label class="field">
              <span>角色人设 Prompt</span>
              <textarea v-model="store.characterPrompt" rows="8" placeholder="描述角色的性格、口癖、回复风格..."></textarea>
            </label>
          </div>

          <!-- Sprite Settings -->
          <div v-if="activeTab === 'sprites'" class="tab-content">
            <div class="sprite-import-bar">
              <span class="import-status">
                已配置 {{ getConfiguredCount(store.sprites) }}/20 表情
                <span v-if="getConfiguredCount(store.sprites) === 20" class="status-ok"> 完成</span>
                <span v-else class="status-warn">（缺少: {{ getMissingEmotions(store.sprites) }}）</span>
              </span>
              <button class="import-folder-btn" @click="onImportFolder()">从文件夹导入</button>
            </div>
            <div v-for="em in emotions" :key="em.key" class="sprite-group">
              <div class="sprite-header">
                <span class="sprite-emoji">{{ em.emoji }}</span>
                <span class="sprite-label">{{ em.label }}</span>
                <button class="add-btn" @click="selectImages(em.key)">+ 添加图片</button>
              </div>
              <div v-if="store.sprites[em.key].images.length > 0" class="sprite-preview-list">
                <div v-for="(img, idx) in store.sprites[em.key].images" :key="idx" class="sprite-preview-item">
                  <img :src="imageCache[img] || ''" class="sprite-thumb" />
                  <button class="remove-btn" @click="removeSprite(em.key, idx)">✕</button>
                  <span v-if="idx === 0" class="primary-badge">主</span>
                </div>
              </div>
              <div v-else class="sprite-empty">未设置</div>
            </div>
          </div>

          <!-- Character Presets -->
          <div v-if="activeTab === 'presets'" class="tab-content">
            <!-- Editing character detail -->
            <template v-if="editingChar">
              <button class="back-btn" @click="stopEdit">← 返回角色列表</button>
              <label class="field">
                <span>角色名称</span>
                <input v-model="editingChar.name" type="text" placeholder="输入角色名称" />
              </label>
              <label class="field">
                <span>角色人设 Prompt</span>
                <textarea v-model="editingChar.characterPrompt" rows="6" placeholder="描述角色的性格、口癖、回复风格..."></textarea>
              </label>
              <label class="field">
                <span>VITS 说话人 ID</span>
                <input v-model="editingChar.vitsSpeakerId" type="text" placeholder="3" />
              </label>
              <div class="section-divider"><span>立绘管理</span></div>
              <div class="sprite-import-bar">
                <span class="import-status">
                  已配置 {{ getConfiguredCount(editingChar.sprites) }}/20 表情
                  <span v-if="getConfiguredCount(editingChar.sprites) === 20" class="status-ok"> 完成</span>
                  <span v-else class="status-warn">（缺少: {{ getMissingEmotions(editingChar.sprites) }}）</span>
                </span>
                <button class="import-folder-btn" @click="onImportFolder(editingChar.sprites)">从文件夹导入</button>
              </div>
              <div v-for="em in emotions" :key="em.key" class="sprite-group">
                <div class="sprite-header">
                  <span class="sprite-emoji">{{ em.emoji }}</span>
                  <span class="sprite-label">{{ em.label }}</span>
                  <button class="add-btn" @click="selectImages(em.key, editingChar.sprites)">+ 添加图片</button>
                </div>
                <div v-if="editingChar.sprites[em.key].images.length > 0" class="sprite-preview-list">
                  <div v-for="(img, idx) in editingChar.sprites[em.key].images" :key="idx" class="sprite-preview-item">
                    <img :src="imageCache[img] || ''" class="sprite-thumb" />
                    <button class="remove-btn" @click="removeSprite(em.key, idx, editingChar.sprites)">✕</button>
                    <span v-if="idx === 0" class="primary-badge">主</span>
                  </div>
                </div>
                <div v-else class="sprite-empty">未设置</div>
              </div>
            </template>

            <!-- Character list -->
            <template v-else>
              <div v-for="char in store.characters" :key="char.id" class="char-card" :class="{ active: char.id === store.activeCharacterId }">
                <div class="char-info">
                  <span class="char-name">{{ char.name }}</span>
                  <span v-if="char.id === store.activeCharacterId" class="active-badge">当前</span>
                </div>
                <div class="char-actions">
                  <button v-if="char.id !== store.activeCharacterId" class="action-btn primary" @click="onSetActive(char.id)">启用</button>
                  <button class="action-btn" @click="startEdit(char)">编辑</button>
                  <button class="action-btn danger" :disabled="store.characters.length <= 1" @click="onDeleteCharacter(char.id)">删除</button>
                </div>
              </div>
              <button class="new-char-btn" @click="onCreateCharacter">+ 新建角色</button>
            </template>
          </div>
        </div>

        <div class="modal-footer">
          <button class="save-btn" @click="emit('close')">完成</button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.settings-backdrop {
  position: fixed;
  inset: 0;
  background:
    linear-gradient(135deg, rgba(255, 255, 255, 0.92), rgba(244, 247, 255, 0.86));
  backdrop-filter: blur(22px) saturate(1.18);
  -webkit-backdrop-filter: blur(22px) saturate(1.18);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  pointer-events: auto;
}
.settings-modal {
  background: linear-gradient(145deg, rgba(255, 255, 255, 0.78), rgba(250, 252, 255, 0.6));
  border: 1px solid rgba(255, 255, 255, 0.78);
  border-radius: 0;
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.86);
  color: #2b3040;
}
.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 18px 24px 0;
}
.modal-header h2 { font-size: 18px; font-weight: 600; color: #242936; }
.modal-close {
  background: rgba(255, 255, 255, 0.42); border: 1px solid rgba(255, 255, 255, 0.62); color: #697084;
  font-size: 18px; cursor: pointer; padding: 4px 8px; border-radius: 6px;
}
.modal-close:hover { background: rgba(255, 255, 255, 0.75); color: #2f3545; }
.modal-tabs {
  display: flex; gap: 4px; padding: 16px 24px 0;
  border-bottom: 1px solid rgba(185, 193, 218, 0.42);
}
.tab-btn {
  background: none; border: none; color: #6f7588;
  padding: 8px 14px; font-size: 13px; cursor: pointer; font-family: inherit;
  border-bottom: 2px solid transparent; transition: all 0.2s;
}
.tab-btn.active { color: #626ce0; border-bottom-color: #6f78e8; }
.tab-btn:hover:not(.active) { color: #343a4c; }
.modal-body {
  padding: 20px 24px; overflow-y: auto; flex: 1;
}
.modal-body::-webkit-scrollbar { width: 4px; }
.modal-body::-webkit-scrollbar-thumb { background: rgba(128, 136, 168, 0.28); border-radius: 2px; }
.tab-content { display: flex; flex-direction: column; gap: 16px; }
.field { display: flex; flex-direction: column; gap: 6px; }
.field span { font-size: 13px; color: #596078; }
.field input, .field textarea {
  background: rgba(255, 255, 255, 0.58); border: 1px solid rgba(255, 255, 255, 0.72);
  border-radius: 8px; padding: 10px 12px; color: #2b3040;
  font-size: 13px; font-family: inherit; outline: none; resize: vertical;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.78);
}
.field input:focus, .field textarea:focus { border-color: rgba(126, 136, 230, 0.72); background: rgba(255, 255, 255, 0.76); }
.section-divider {
  display: flex; align-items: center; gap: 12px; margin: 8px 0;
}
.section-divider::before, .section-divider::after {
  content: ''; flex: 1; height: 1px; background: rgba(185, 193, 218, 0.42);
}
.section-divider span { font-size: 12px; color: #7b8194; white-space: nowrap; }
.sprite-import-bar {
  display: flex; align-items: center; justify-content: space-between;
  background: rgba(255, 255, 255, 0.46); border: 1px solid rgba(255, 255, 255, 0.66);
  border-radius: 10px; padding: 10px 14px; margin-bottom: 12px;
}
.import-status { font-size: 13px; color: #596078; }
.import-status .status-ok { color: #2f9a5f; }
.import-status .status-warn { color: #b77b20; font-size: 11px; }
.import-folder-btn {
  background: rgba(111, 120, 232, 0.14); border: 1px solid rgba(111, 120, 232, 0.22); color: #5661cf;
  padding: 6px 14px; border-radius: 8px; font-size: 13px;
  cursor: pointer; font-family: inherit; transition: all 0.2s; white-space: nowrap;
}
.import-folder-btn:hover { background: rgba(111, 120, 232, 0.24); }
.sprite-group { border: 1px solid rgba(255, 255, 255, 0.64); background: rgba(255, 255, 255, 0.36); border-radius: 10px; padding: 12px; }
.sprite-header { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
.sprite-emoji { font-size: 18px; }
.sprite-label { font-size: 13px; color: #50576a; flex: 1; }
.add-btn {
  background: rgba(111, 120, 232, 0.14); border: 1px solid rgba(111, 120, 232, 0.2); color: #5661cf;
  padding: 4px 12px; border-radius: 12px; font-size: 12px;
  cursor: pointer; font-family: inherit; transition: background 0.2s;
}
.add-btn:hover { background: rgba(111, 120, 232, 0.24); }
.sprite-preview-list { display: flex; gap: 8px; flex-wrap: wrap; }
.sprite-preview-item {
  position: relative; width: 60px; height: 60px;
  border-radius: 6px; overflow: hidden; border: 1px solid rgba(185, 193, 218, 0.42);
}
.sprite-thumb { width: 100%; height: 100%; object-fit: cover; }
.remove-btn {
  position: absolute; top: 2px; right: 2px; background: rgba(255, 0, 0, 0.7);
  border: none; color: white; border-radius: 50%; width: 18px; height: 18px;
  font-size: 10px; cursor: pointer; display: flex; align-items: center; justify-content: center;
}
.primary-badge {
  position: absolute; bottom: 2px; left: 2px; background: rgba(120, 120, 255, 0.8);
  color: white; font-size: 9px; padding: 1px 5px; border-radius: 4px;
}
.sprite-empty { font-size: 12px; color: #9aa1b2; }
.modal-footer { padding: 12px 24px 18px; display: flex; justify-content: flex-end; }
.save-btn {
  background: #6f78e8; border: none; border-radius: 8px;
  padding: 8px 28px; color: white; font-size: 14px; cursor: pointer;
  font-family: inherit; transition: background 0.2s;
}
.save-btn:hover { background: #5d67dd; }
.reset-btn {
  background: rgba(255, 255, 255, 0.44); border: 1px solid rgba(255, 255, 255, 0.62); color: #697084;
  padding: 4px 12px; border-radius: 12px; font-size: 12px; cursor: pointer;
  font-family: inherit; transition: background 0.2s;
}
.reset-btn:hover { background: rgba(255, 120, 120, 0.24); color: #b34242; }

/* Presets tab */
.back-btn {
  background: none; border: none; color: #697084; font-size: 13px;
  cursor: pointer; padding: 4px 0; text-align: left; font-family: inherit; align-self: flex-start;
}
.back-btn:hover { color: #626ce0; }
.char-card {
  display: flex; align-items: center; justify-content: space-between;
  background: rgba(255, 255, 255, 0.46); border: 1px solid rgba(255, 255, 255, 0.66);
  border-radius: 10px; padding: 12px 14px;
}
.char-card.active { border-color: rgba(111, 120, 232, 0.36); background: rgba(111, 120, 232, 0.1); }
.char-info { display: flex; align-items: center; gap: 8px; }
.char-name { font-size: 14px; color: #2b3040; font-weight: 500; }
.active-badge {
  font-size: 10px; background: rgba(111, 120, 232, 0.72);
  color: white; padding: 2px 8px; border-radius: 10px;
}
.char-actions { display: flex; gap: 6px; }
.action-btn {
  background: rgba(255, 255, 255, 0.5); border: 1px solid rgba(255, 255, 255, 0.62); color: #697084;
  padding: 4px 10px; border-radius: 8px; font-size: 12px; cursor: pointer;
  font-family: inherit; transition: all 0.2s;
}
.action-btn:hover { background: rgba(255, 255, 255, 0.76); color: #2f3545; }
.action-btn.primary { background: rgba(111, 120, 232, 0.14); color: #5661cf; }
.action-btn.primary:hover { background: rgba(111, 120, 232, 0.24); }
.action-btn.danger:hover { background: rgba(255, 120, 120, 0.24); color: #b34242; }
.action-btn:disabled { opacity: 0.3; cursor: not-allowed; }
.new-char-btn {
  background: rgba(111, 120, 232, 0.1); border: 1px dashed rgba(111, 120, 232, 0.32);
  color: #5661cf; padding: 10px; border-radius: 10px; font-size: 13px;
  cursor: pointer; font-family: inherit; transition: all 0.2s;
}
.new-char-btn:hover { background: rgba(111, 120, 232, 0.18); }
/* VITS speaker selection */
.speaker-row {
  display: flex;
  gap: 8px;
}
.speaker-select {
  flex: 1;
  background: rgba(255, 255, 255, 0.58);
  border: 1px solid rgba(255, 255, 255, 0.72);
  border-radius: 8px;
  padding: 10px 12px;
  color: #2b3040;
  font-size: 13px;
  font-family: inherit;
  outline: none;
  cursor: pointer;
}
.speaker-select:focus { border-color: rgba(126, 136, 230, 0.72); }
.speaker-select option {
  background: #ffffff;
  color: #2b3040;
}
.speaker-manual {
  margin-top: 6px;
}
.refresh-btn {
  background: rgba(255, 255, 255, 0.5);
  border: 1px solid rgba(255, 255, 255, 0.62);
  border-radius: 8px;
  padding: 0 12px;
  color: #697084;
  font-size: 12px;
  cursor: pointer;
  font-family: inherit;
  white-space: nowrap;
  transition: background 0.2s;
}
.refresh-btn:hover:not(:disabled) { background: rgba(255, 255, 255, 0.76); }
.refresh-btn:disabled { opacity: 0.4; cursor: not-allowed; }
.fetch-error {
  font-size: 11px;
  color: #ff8888;
  margin-top: 2px;
}
.path-hint {
  font-size: 11px;
  color: #8a91a4;
  line-height: 1.4;
}
.path-hint.ok {
  color: #2f9a5f;
}
.path-hint.warn {
  color: #b77b20;
}

/* Model list */
.model-list-section {
  background: rgba(255, 255, 255, 0.42);
  border-radius: 10px;
  padding: 12px 14px;
  border: 1px solid rgba(255, 255, 255, 0.62);
}
.model-list-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}
.model-list-header > span {
  font-size: 13px;
  color: #697084;
}
.model-header-actions {
  display: flex;
  gap: 6px;
}
.add-model-btn {
  background: rgba(80, 180, 100, 0.3);
  border: 1px solid rgba(80, 180, 100, 0.3);
  border-radius: 8px;
  padding: 4px 12px;
  color: #70d090;
  font-size: 12px;
  font-family: inherit;
  cursor: pointer;
  white-space: nowrap;
  transition: background 0.2s;
}
.add-model-btn:hover { background: rgba(80, 180, 100, 0.5); }
.refresh-btn.small {
  padding: 4px 10px;
  font-size: 11px;
}
.model-empty {
  color: #9aa1b2;
  font-size: 12px;
  text-align: center;
  padding: 12px 0;
}
.model-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 10px;
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.52);
  margin-bottom: 4px;
}
.model-item:last-child { margin-bottom: 0; }
.model-item-info {
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.model-item-name {
  font-size: 13px;
  color: #2b3040;
}
.model-item-path {
  font-size: 10px;
  color: #8a91a4;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 280px;
}
.model-delete-btn {
  background: rgba(255, 80, 80, 0.2);
  border: none;
  border-radius: 6px;
  padding: 4px 10px;
  color: #ff8888;
  font-size: 11px;
  font-family: inherit;
  cursor: pointer;
  white-space: nowrap;
  transition: background 0.2s;
}
.model-delete-btn:hover { background: rgba(255, 80, 80, 0.4); }

/* VITS server management */
.path-row {
  display: flex;
  gap: 8px;
  padding: 4px;
  margin: -4px;
  border-radius: 10px;
  border: 2px solid transparent;
  transition: border-color 0.2s, background 0.2s;
}
.path-row.drop-active {
  border-color: rgba(126, 136, 230, 0.6);
  background: rgba(111, 120, 232, 0.08);
}
.path-row input {
  flex: 1;
}
.browse-btn {
  background: rgba(255, 255, 255, 0.5);
  border: 1px solid rgba(255, 255, 255, 0.62);
  border-radius: 8px;
  padding: 0 14px;
  color: #697084;
  font-size: 13px;
  cursor: pointer;
  font-family: inherit;
  white-space: nowrap;
  transition: background 0.2s;
}
.browse-btn:hover { background: rgba(255, 255, 255, 0.76); }
.checkbox-field { flex-direction: row; }
.checkbox-row {
  display: flex;
  align-items: center;
  gap: 8px;
}
.checkbox-row input[type="checkbox"] {
  width: 16px;
  height: 16px;
  accent-color: #6f78e8;
  cursor: pointer;
}
.checkbox-row span {
  color: #596078;
  font-size: 13px;
  cursor: pointer;
}
.vits-status-row {
  display: flex;
  align-items: center;
  gap: 10px;
  background: rgba(255, 255, 255, 0.46);
  border: 1px solid rgba(255, 255, 255, 0.66);
  border-radius: 8px;
  padding: 10px 14px;
}
.status-label {
  font-size: 13px;
  color: #697084;
}
.status-badge {
  font-size: 12px;
  font-weight: 500;
  padding: 2px 10px;
  border-radius: 10px;
}
.status-badge.running { background: rgba(80, 200, 120, 0.18); color: #2f9a5f; }
.status-badge.starting { background: rgba(255, 200, 80, 0.18); color: #b77b20; }
.status-badge.stopped { background: rgba(128, 136, 168, 0.14); color: #8a91a4; }
.status-badge.error { background: rgba(255, 80, 80, 0.16); color: #b34242; }
.vits-action-btn {
  border: none;
  border-radius: 8px;
  padding: 6px 16px;
  font-size: 12px;
  font-family: inherit;
  cursor: pointer;
  transition: all 0.2s;
  margin-left: auto;
}
.vits-action-btn:disabled {
  opacity: 0.55;
  cursor: wait;
}
.vits-action-btn.start { background: rgba(80, 200, 120, 0.18); color: #2f9a5f; }
.vits-action-btn.start:hover { background: rgba(80, 200, 120, 0.28); }
.vits-action-btn.stop { background: rgba(255, 80, 80, 0.16); color: #b34242; }
.vits-action-btn.stop:hover { background: rgba(255, 80, 80, 0.26); }
</style>
