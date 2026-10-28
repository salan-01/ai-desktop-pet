<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { useSettingsStore } from '@/stores/settings'
import { invoke } from '@tauri-apps/api/core'
import type { Emotion } from '@/types'

const props = defineProps<{
  emotion: Emotion
  isDragging: boolean
}>()

const emit = defineEmits<{
  (e: 'click-pet', event: MouseEvent): void
  (e: 'click-settings'): void
}>()

const store = useSettingsStore()
const stageRef = ref<HTMLElement | null>(null)

const spriteImages = computed(() => {
  const current = store.sprites[props.emotion]?.images || []
  if (current.length > 0) return current
  if (props.emotion !== 'normal') {
    const normal = store.sprites.normal?.images || []
    if (normal.length > 0) return normal
  }
  return []
})

// Cache loaded base64 data URLs by file path to avoid re-reading from disk
const frameCache = ref<Map<string, string>>(new Map())

const loadedFrames = ref<string[]>([])
const frameIndex = ref(0)
let animTimer: ReturnType<typeof setInterval> | null = null

async function loadFrames(paths: string[]) {
  if (animTimer) { clearInterval(animTimer); animTimer = null }
  if (paths.length === 0) {
    loadedFrames.value = []
    frameIndex.value = 0
    return
  }
  // Check if all paths are already cached (same emotion as before)
  const allCached = paths.every(p => frameCache.value.has(p))
  if (allCached && paths.length === loadedFrames.value.length &&
      paths.every((p, i) => loadedFrames.value[i] === frameCache.value.get(p))) {
    // Same frames, no reload needed 鈥?just restart animation
    if (loadedFrames.value.length > 1) {
      startAnimation()
    }
    return
  }

  frameIndex.value = 0
  const results: string[] = []
  for (const p of paths) {
    const cached = frameCache.value.get(p)
    if (cached) {
      results.push(cached)
    } else {
      try {
        const dataUrl = await invoke<string>('read_image_base64', { path: p })
        if (dataUrl) {
          frameCache.value.set(p, dataUrl)
          results.push(dataUrl)
        }
      } catch (e) { console.error('Failed to load sprite:', p, e) }
    }
  }
  loadedFrames.value = results.filter(Boolean)
  if (loadedFrames.value.length > 1) {
    startAnimation()
  }
}

function startAnimation() {
  if (animTimer) clearInterval(animTimer)
  animTimer = setInterval(() => {
    frameIndex.value = (frameIndex.value + 1) % loadedFrames.value.length
  }, 500)
}

const currentSprite = computed(() => {
  if (loadedFrames.value.length === 0) return ''
  return loadedFrames.value[frameIndex.value] || loadedFrames.value[0]
})

watch(spriteImages, (imgs) => {
  loadFrames(imgs)
}, { immediate: true })

// Preload sprites that need instant switching (head pat)
function preloadSprite(emotion: Emotion) {
  for (const path of store.sprites[emotion]?.images || []) {
    if (path && !frameCache.value.has(path)) {
      invoke<string>('read_image_base64', { path }).then(dataUrl => {
        if (dataUrl) frameCache.value.set(path, dataUrl)
      }).catch(() => { /* skip */ })
    }
  }
}

onMounted(() => {
  stageRef.value?.addEventListener('contextmenu', (e) => {
    e.preventDefault()
    emit('click-settings')
  })
  preloadSprite('veryshy')
})

function onClick(e: MouseEvent) {
  if (props.isDragging) return
  emit('click-pet', e)
  e.stopPropagation()
}

function onClickSettings(e: MouseEvent) {
  e.stopPropagation()
  emit('click-settings')
}
</script>

<template>
  <div
    ref="stageRef"
    class="pet-stage"
    :class="{ dragging: props.isDragging }"
    @click="onClick"
  >
    <img
      v-if="currentSprite"
      :src="currentSprite"
      class="pet-sprite"
      :class="{ 'anim-bounce': !isDragging, 'dragging-sprite': isDragging }"
      alt="pet"
      draggable="false"
    />
    <div v-else class="pet-placeholder">
      <div class="placeholder-text">馃惐</div>
      <div class="placeholder-label" @mousedown.stop @click="onClickSettings">鐐瑰嚮璁剧疆绔嬬粯</div>
    </div>
  </div>
</template>

<style scoped>
.pet-stage {
  cursor: grab;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-end;
  overflow: visible;
}
.pet-stage.dragging {
  cursor: grabbing;
}
.pet-stage.dragging .pet-sprite {
  animation: none;
}
.pet-sprite {
  height: min(380px, calc(100vh - 32px));
  max-width: calc(100vw - 48px);
  width: auto;
  object-fit: contain;
  pointer-events: none;
  image-rendering: auto;
  transform-origin: center bottom;
}
.dragging-sprite {
  height: min(320px, calc(100vh - 72px));
  max-width: calc(100vw - 96px);
}
.anim-bounce {
  animation: pet-idle 3s ease-in-out infinite;
}
@keyframes pet-idle {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-8px); }
}
.pet-placeholder {
  width: 200px;
  height: 250px;
  border: 2px dashed rgba(255, 255, 255, 0.5);
  border-radius: 20px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  background: rgba(0, 0, 0, 0.25);
  backdrop-filter: blur(4px);
}
.placeholder-text {
  font-size: 60px;
  filter: grayscale(0.3);
}
.placeholder-label {
  color: rgba(255, 255, 255, 0.8);
  font-size: 13px;
  cursor: pointer;
  transition: color 0.2s;
}
.placeholder-label:hover {
  color: #a0a0ff;
}
.sprite-fade-enter-active,
.sprite-fade-leave-active {
  transition: opacity 0.2s ease;
}
.sprite-fade-enter-from,
.sprite-fade-leave-to {
  opacity: 0;
}
</style>


