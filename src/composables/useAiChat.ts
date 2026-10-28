import { ref } from 'vue'
import { useSettingsStore } from '@/stores/settings'
import { useChatStore } from '@/stores/chat'
import { useEmotion } from './useEmotion'
import { invoke } from '@tauri-apps/api/core'
import type { MemoryItem } from '@/types'

export function useAiChat() {
  const store = useSettingsStore()
  const chatStore = useChatStore()
  const { parseAiEmotion, detectFromAction, detectFromText } = useEmotion()

  const isStreaming = ref(false)
  const streamText = ref('')
  const currentEmotion = ref<string>('normal')

  const memoryConfig = () => ({ url: store.memoryMysqlUrl })

  function activeCharacterId(): string {
    return store.activeCharacterId || 'default'
  }

  function uniqueMemories(items: MemoryItem[]): MemoryItem[] {
    const seen = new Set<number>()
    return items.filter(item => {
      if (seen.has(item.id)) return false
      seen.add(item.id)
      return true
    })
  }

  function cleanFactValue(value: string): string {
    return value
      .replace(/\[voice:[^\]]*\][\s\S]*?\[\/voice\]/gi, '')
      .replace(/\[emotion\s*[:：=]\s*\w+\]/gi, '')
      .replace(/[。！？!?，,；;：:\s]+$/g, '')
      .trim()
  }

  function isLikelyQuestion(text: string): boolean {
    return /[?？]|什么|吗|么|是不是|有没有|多少|哪里|怎么/.test(text)
  }

  function extractMemoryFacts(text: string): string[] {
    const raw = text.trim()
    if (!raw || isLikelyQuestion(raw)) return []

    const facts: string[] = []
    const candidates: Array<[RegExp, (value: string) => string]> = [
      [/我(?:很|最)?喜欢(.{1,40})/, value => `主人喜欢${value}。`],
      [/我(?:不喜欢|讨厌)(.{1,40})/, value => `主人不喜欢${value}。`],
      [/(?:我叫|我的名字叫|我的名字是)(.{1,24})/, value => `主人的名字是${value}。`],
      [/我是(.{1,40})/, value => `主人是${value}。`],
      [/我的生日(?:是|在)?(.{1,30})/, value => `主人的生日是${value}。`],
      [/我(?:住在|住)(.{1,40})/, value => `主人住在${value}。`],
      [/我来自(.{1,40})/, value => `主人来自${value}。`],
      [/以后(?:叫我|喊我)(.{1,24})/, value => `主人希望被称呼为${value}。`],
      [/(?:记住|记得|别忘了|不要忘了|帮我记一下)[:：,，\s]*(.{1,80})/, value => cleanFactValue(value)]
    ]

    for (const [pattern, build] of candidates) {
      const match = raw.match(pattern)
      if (!match) continue
      const value = cleanFactValue(match[1] || '')
      if (value.length < 1) continue
      facts.push(build(value))
    }

    return [...new Set(facts)].slice(0, 3)
  }

  function extractMemoryKeywords(text: string): string[] {
    const cleaned = text.replace(/[^\p{Script=Han}a-zA-Z0-9]/gu, ' ')
    const words = cleaned
      .split(/\s+/)
      .map(word => word.trim())
      .filter(word => word.length >= 2)
      .filter(word => !['记得', '记住', '知道', '什么', '怎么', '可以', '是不是', '有没有', '喜欢', '讨厌'].includes(word))
    return [...new Set(words)].slice(0, 4)
  }

  async function loadRelevantMemories(userText: string): Promise<MemoryItem[]> {
    if (!store.memoryEnabled || !store.memoryMysqlUrl) return []
    try {
      const recent = await invoke<MemoryItem[]>('search_memories', {
        config: memoryConfig(),
        characterId: activeCharacterId(),
        query: '',
        limit: 8
      })

      const keywordResults = await Promise.all(
        extractMemoryKeywords(userText).map(keyword =>
          invoke<MemoryItem[]>('search_memories', {
            config: memoryConfig(),
            characterId: activeCharacterId(),
            query: keyword,
            limit: 6
          }).catch(() => [])
        )
      )

      return uniqueMemories([...keywordResults.flat(), ...recent]).slice(0, 12)
    } catch {
      return []
    }
  }

  function buildMemoryPrompt(memories: MemoryItem[]): string {
    if (memories.length === 0) return ''
    const lines = memories.map((m, idx) => `${idx + 1}. ${m.content}`)
    return `\n\n【长期记忆】\n以下是你必须知道的长期记忆，代表你已经记住的关于主人和你们相处的信息。回答涉及主人偏好、身份、习惯、称呼、承诺、过往约定时，应优先使用这些记忆。不要说“我读取到了记忆”，要像本来就记得一样自然回应。\n${lines.join('\n')}`
  }

  async function memoryExists(content: string): Promise<boolean> {
    try {
      const existing = await invoke<MemoryItem[]>('search_memories', {
        config: memoryConfig(),
        characterId: activeCharacterId(),
        query: content,
        limit: 5
      })
      return existing.some(memory => memory.content === content)
    } catch {
      return false
    }
  }

  async function saveUserMemory(userText: string) {
    if (!store.memoryEnabled || !store.memoryMysqlUrl || !store.memoryAutoSave) return
    const facts = extractMemoryFacts(userText)
    if (facts.length === 0) return

    for (const content of facts) {
      if (await memoryExists(content)) continue
      try {
        await invoke('save_memory', {
          config: memoryConfig(),
          characterId: activeCharacterId(),
          content,
          source: 'auto'
        })
      } catch { /* memory should not break chat */ }
    }
  }

  async function sendMessage(
    userText: string,
    opts?: { prompt?: string; skipHistory?: boolean; systemHint?: string }
  ): Promise<{ response: string; emotion: string }> {
    if (!store.apiKey) {
      throw new Error('请先在设置中配置 API Key')
    }

    isStreaming.value = true
    streamText.value = ''
    currentEmotion.value = 'thinking'
    await saveUserMemory(userText)

    const memoryQuery = opts?.prompt || userText
    const memories = await loadRelevantMemories(memoryQuery)
    const historyMessages = opts?.skipHistory ? [] : chatStore.getApiMessages(40)
    const baseSystemContent = opts?.systemHint
      ? store.characterPrompt + '\n\n' + opts.systemHint
      : store.characterPrompt
    const systemContent = baseSystemContent + buildMemoryPrompt(memories)
    const messages = [
      { role: 'system', content: systemContent },
      ...historyMessages.map(m => ({ role: m.role, content: m.content }))
    ]

    if (opts?.prompt) {
      messages.push({ role: 'user', content: opts.prompt })
    } else if (userText) {
      messages.push({ role: 'user', content: userText })
    }

    try {
      let res: Response
      try {
        res = await fetch(store.apiEndpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${store.apiKey}`
          },
          body: JSON.stringify({
            model: store.model,
            messages,
            stream: true,
            temperature: 0.8,
            max_tokens: 300
          })
        })
      } catch {
        throw new Error('无法连接到 API 服务，请检查 API 地址和网络连接')
      }

      if (!res.ok) {
        const errText = await res.text()
        throw new Error(`API 请求失败 (${res.status}): ${errText}`)
      }

      const reader = res.body!.getReader()
      const decoder = new TextDecoder()
      let fullText = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value, { stream: true })
        const lines = chunk.split('\n').filter(l => l.startsWith('data: '))

        for (const line of lines) {
          const data = line.slice(6).trim()
          if (data === '[DONE]') continue
          try {
            const json = JSON.parse(data)
            const content = json.choices?.[0]?.delta?.content
            if (content) {
              fullText += content
              streamText.value = fullText
            }
          } catch { /* skip malformed chunks */ }
        }
      }

      const { emotion, cleanText } = parseAiEmotion(fullText)
      let finalEmotion = emotion
      if (finalEmotion === 'normal') {
        const actionEmotion = detectFromAction(cleanText)
        finalEmotion = actionEmotion || detectFromText(cleanText)
      }

      isStreaming.value = false
      currentEmotion.value = finalEmotion

      return { response: fullText, emotion: finalEmotion }
    } catch (err) {
      isStreaming.value = false
      currentEmotion.value = 'helpless'
      throw err
    }
  }

  function reset() {
    streamText.value = ''
    currentEmotion.value = 'normal'
    isStreaming.value = false
  }

  return { sendMessage, reset, isStreaming, streamText, currentEmotion }
}
