import { ref, onMounted, onUnmounted } from 'vue'
import { invoke } from '@tauri-apps/api/core'

export function usePetDrag() {
  const isDragging = ref(false)
  const DRAG_THRESHOLD = 5 // pixels

  function onPointerDown(e: PointerEvent) {
    if (e.button !== 0) return
    const target = e.target as HTMLElement
    if (target.closest('button, input, textarea, select, a, [data-no-drag]')) return

    const startX = e.clientX
    const startY = e.clientY
    let dragStarted = false

    target.setPointerCapture(e.pointerId)

    function onPointerMove(me: PointerEvent) {
      if (dragStarted) return
      const dx = me.clientX - startX
      const dy = me.clientY - startY
      if (Math.abs(dx) > DRAG_THRESHOLD || Math.abs(dy) > DRAG_THRESHOLD) {
        dragStarted = true
        isDragging.value = true
        invoke('start_native_drag')
      }
    }

    function onPointerUp(_e: PointerEvent) {
      target.releasePointerCapture(_e.pointerId)
      document.removeEventListener('pointermove', onPointerMove)
      document.removeEventListener('pointerup', onPointerUp)
      if (dragStarted) {
        // Small delay: let the native drag loop detect button release first
        setTimeout(() => { isDragging.value = false }, 50)
      }
    }

    document.addEventListener('pointermove', onPointerMove)
    document.addEventListener('pointerup', onPointerUp)
  }

  onMounted(() => {
    document.addEventListener('pointerdown', onPointerDown)
  })

  onUnmounted(() => {
    document.removeEventListener('pointerdown', onPointerDown)
  })

  return { isDragging }
}
