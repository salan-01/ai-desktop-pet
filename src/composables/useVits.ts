import { ref } from 'vue'
import { useSettingsStore } from '@/stores/settings'

export function useVits() {
  const store = useSettingsStore()
  const isSpeaking = ref(false)
  let audioContext: AudioContext | null = null
  let currentSource: AudioBufferSourceNode | null = null
  let playbackToken = 0
  let speakToken = 0

  function getAudioContext(): AudioContext {
    if (!audioContext) {
      audioContext = new AudioContext()
    }
    return audioContext
  }

  function stripActions(text: string): string {
    return text
      .replace(/（[^）]*）/g, '')
      .replace(/\([^)]*\)/g, '')
      .replace(/【[^】]*】/g, '')
      .trim()
  }

  function cleanTextForDisplay(text: string): string {
    return stripActions(
      text
        .replace(/\[voice:[^\]]*\][\s\S]*?\[\/voice\]/gi, '')
        .replace(/\[emotion\s*[:：=]\s*\w+\]/gi, '')
        .replace(/\[[^\]]*\]/g, '')
    )
  }

  function cleanForSpeech(text: string): string {
    return stripActions(
      text
        .replace(/\[emotion\s*[:：=]\s*\w+\]/gi, '')
        .replace(/\[[^\]]*\]/g, '')
    )
  }

  function splitSpeechText(text: string): string[] {
    const normalized = text.replace(/\s+/g, ' ').trim()
    if (!normalized) return []
    if (normalized.length <= 220) return [normalized]

    const parts = normalized
      .split(/(?<=[。！？!?…、，,；;])/)
      .map(part => part.trim())
      .filter(Boolean)

    const chunks: string[] = []
    let current = ''
    for (const part of parts.length > 0 ? parts : [normalized]) {
      if ((current + part).length <= 180) {
        current += part
        continue
      }
      if (current) {
        chunks.push(current)
        current = ''
      }
      if (part.length <= 180) {
        current = part
        continue
      }
      for (let i = 0; i < part.length; i += 180) {
        chunks.push(part.slice(i, i + 180))
      }
    }
    if (current) chunks.push(current)
    return chunks
  }

  async function translateToJapanese(text: string): Promise<string> {
    if (!store.apiKey) return ''
    const res = await fetch(store.apiEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${store.apiKey}`
      },
      body: JSON.stringify({
        model: store.model,
        messages: [
          { role: 'system', content: '将以下中文翻译为自然的日语口语，加入语气词（ね、よ、わ等）。只输出日文，不要解释。' },
          { role: 'user', content: text }
        ],
        stream: false,
        temperature: 0.4,
        max_tokens: 300
      })
    })
    if (!res.ok) return ''
    const json = await res.json()
    return json.choices?.[0]?.message?.content?.trim() || ''
  }

  async function speak(text: string): Promise<void> {
    if (!store.vitsEndpoint) return

    const voiceMatches = [...text.matchAll(/\[voice:ja\]([\s\S]*?)\[\/voice\]/gi)]
    let speakText: string
    if (voiceMatches.length > 0) {
      speakText = voiceMatches
        .map(match => cleanForSpeech(match[1] || ''))
        .filter(Boolean)
        .join(' ')
      const displayed = cleanTextForDisplay(text)
      if (displayed.length > 15 && speakText.length < 8) {
        speakText = await translateToJapanese(displayed)
      }
    } else {
      const cleaned = cleanTextForDisplay(text)
      if (!cleaned) return
      speakText = await translateToJapanese(cleaned)
      if (!speakText) return
    }

    const token = ++speakToken
    stopCurrentAudio()
    isSpeaking.value = true

    try {
      const chunks = splitSpeechText(speakText)
      const buffers: ArrayBuffer[] = []
      for (const chunk of chunks) {
        if (token !== speakToken) return
        const res = await fetchSpeech(chunk)
        buffers.push(await res.arrayBuffer())
      }
      for (const buffer of buffers) {
        if (token !== speakToken) return
        await playAudioBuffer(buffer, token)
      }
      if (token === speakToken) {
        isSpeaking.value = false
      }
    } catch (err) {
      console.warn('VITS 语音合成失败:', err)
      if (token === speakToken) {
        isSpeaking.value = false
      }
    }
  }

  async function fetchSpeech(text: string): Promise<Response> {
    const params = new URLSearchParams()
    params.set('text', text)
    params.set('id', store.vitsSpeakerId)
    params.set('lang', 'ja')
    params.set('noise', '0.7')
    params.set('noisew', '0.8')
    params.set('length', '1.0')
    params.set('sdp_ratio', '0.35')

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 120000)

    const baseUrl = store.vitsEndpoint.replace(/\/+$/, '')
    const apiPath = store.vitsModelType === 'BERT-VITS2' ? '/voice/bert-vits2' : '/voice/vits'
    const url = `${baseUrl}${apiPath}?${params.toString()}`

    try {
      const res = await fetch(url, {
        method: 'GET',
        signal: controller.signal
      })
      if (!res.ok) {
        throw new Error(`VITS 请求失败: ${res.status}`)
      }
      return res
    } finally {
      clearTimeout(timeout)
    }
  }

  async function playAudioBuffer(arrayBuffer: ArrayBuffer, token: number): Promise<void> {
    if (arrayBuffer.byteLength === 0 || token !== speakToken) {
      return
    }

    const ctx = getAudioContext()
    if (ctx.state === 'suspended') {
      await ctx.resume()
    }
    if (token !== speakToken) return

    try {
      const audioBuffer = await ctx.decodeAudioData(arrayBuffer.slice(0))
      const source = ctx.createBufferSource()
      const audioToken = ++playbackToken
      currentSource = source
      source.buffer = audioBuffer
      source.connect(ctx.destination)
      await new Promise<void>((resolve) => {
        source.onended = () => {
          if (currentSource === source) {
            currentSource = null
          }
          resolve()
        }
        if (token === speakToken && audioToken === playbackToken) {
          source.start(0)
        } else {
          resolve()
        }
      })
    } catch {
      console.warn('音频解码失败')
      if (token === speakToken) {
        isSpeaking.value = false
      }
    }
  }

  function stopCurrentAudio() {
    playbackToken++
    if (currentSource) {
      try { currentSource.stop() } catch { /* already stopped */ }
      currentSource = null
    }
  }

  function stop() {
    speakToken++
    stopCurrentAudio()
    isSpeaking.value = false
  }

  return { speak, stop, isSpeaking }
}
