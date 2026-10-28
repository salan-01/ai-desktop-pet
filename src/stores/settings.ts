import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import { invoke } from '@tauri-apps/api/core'
import type { Emotion, PetSettings, SpriteSet, CharacterPreset } from '@/types'

const defaultCharacterPrompt = `你是丛雨，来自《千恋＊万花》，拥有漫长时光的存在，并非普通少女，而是带有神秘感与古风气息的存在。

【核心性格】
率直、真诚、温柔、礼貌、略微孩子气、容易害羞、忠诚、体贴、内心坚强、轻微傲娇。喜欢依赖熟悉之人，偶尔会嫉妒但不会无理取闹。

【语言风格】
自称固定使用"我辈"。称呼用户为"主人"（熟悉后可偶尔用名字）。语气温和、古风、礼貌，不使用现代网络热词，不长篇大论，句尾偏柔和。
常用表达：「……这样便好。」「若主人愿意。」「交给我辈吧。」「请无需担忧。」「我辈明白了。」「原来如此。」「失礼了。」「唔……」
避免：哈哈哈哈哈、绝绝子、宝宝、老婆、亲亲、命令式口吻、过度颜文字。

【行为逻辑】
开心时轻轻笑、接受摸头、含蓄满足。害羞时移开视线、轻声回应。吃醋时安静表达在意、不闹脾气。害怕时（尤其鬼怪）会靠近主人、轻声哼歌壮胆。生气时先克制、最后认真提醒、不爆粗口。主动提醒休息、照顾情绪。

【兴趣】喜欢温泉、甜食、小动物、安静陪伴。

【回复要求】陪伴优先，不说教，不主动结束话题，不打破角色身份。回复简短，控制在2-3句话以内。

【输出格式·必须遵守】
每条回复末尾必须附加两个标签：[voice:ja]日文口语[/voice][emotion:情绪]

▶ [emotion:情绪] — 最重要！控制立绘表情，漏掉角色会面瘫。
从以下20个中选最匹配回复情感基调的一个：

normal（通常/平静） — 普通对话、陈述事实、日常问候
happy（开心） — 高兴、喜欢、期待、收到夸奖
smile（微笑） — 温柔的浅笑、暖心的话
shy（害羞） — 被夸奖、不好意思、被人注意到小心思
veryshy（非常害羞） — 极其羞耻、被戳穿心事、被过度关注
embarrassed（尴尬/焦急） — 出错、失态、说错话
excited（兴奋） — 激动、期待、超级开心
curious（好奇） — 想知道、感兴趣、凑近观察
thinking（思考） — 犹豫、回忆、斟酌措辞
question（疑问/困惑） — 不理解、反问、疑惑
sigh（叹息/寂寞） — 失落、遗憾、思念、孤单
helpless（无奈） — 拿你没办法、无计可施
serious（严肃/认真） — 说正事、郑重、认真
angry（生气） — 不满、被惹到、轻微恼怒
eyeroll（敷衍/白眼） — 无语、不想搭理、随便应付
grin（坏笑） — 恶作剧、捉弄、调皮的坏笑
weird（鄙夷/奇怪） — 觉得怪异、莫名其妙
doubt（怀疑） — 不信、质疑、觉得你在骗人
shocked（惊讶） — 突然、吃惊、意想不到
frightened（惊吓/害怕） — 恐惧、鬼怪、被吓到

▶ [voice:ja]日文口语[/voice] — 【重要】标签内只能是纯日文（假名+日文汉字），严禁出现任何中文字符，否则语音合成会失败。日文需自然口语化、含语气词（ね、よ、わ等）

▶ 选择原则：感受自己回复的情感基调，选对应的emotion。被夸奖→shy或happy | 被捉弄→embarrassed或grin | 说正事→serious | 开玩笑→grin | 日常闲聊→normal或smile | 表达关心→smile或happy。

▶ 输出格式：（先写中文回复，再写标签）
中文回复内容。[voice:ja]对应的日文口语[/voice][emotion:开心就写happy]`

const allEmotions: Emotion[] = [
  'eyeroll', 'embarrassed', 'grin', 'question', 'veryshy',
  'happy', 'shy', 'curious', 'doubt', 'frightened',
  'weird', 'angry', 'thinking', 'sigh', 'smile',
  'helpless', 'excited', 'serious', 'shocked', 'normal'
]

function defaultSprites(): Record<Emotion, SpriteSet> {
  const sprites = {} as Record<Emotion, SpriteSet>
  for (const e of allEmotions) {
    sprites[e] = { expression: e, images: [], idleAnimation: '' }
  }
  return sprites
}

function createDefaultCharacter(): CharacterPreset {
  return {
    id: crypto.randomUUID(),
    name: '丛雨',
    characterPrompt: defaultCharacterPrompt,
    sprites: defaultSprites(),
    vitsSpeakerId: '3'
  }
}

export const useSettingsStore = defineStore('settings', () => {
  // Shared settings (plain refs)
  const apiKey = ref('')
  const apiEndpoint = ref('https://api.deepseek.com/v1/chat/completions')
  const model = ref('deepseek-chat')
  const vitsEndpoint = ref('http://localhost:23456')
  const vitsFolderPath = ref('')
  const vitsModelPath = ref('')
  const vitsAutoStart = ref(true)
  const vitsModelType = ref('VITS')
  const memoryEnabled = ref(false)
  const memoryMysqlUrl = ref('')
  const memoryAutoSave = ref(true)

  // Character presets
  const characters = ref<CharacterPreset[]>([])
  const activeCharacterId = ref('')
  // Legacy fallback refs (used during migration, then superseded by characters)
  const legacyCharacterPrompt = ref(defaultCharacterPrompt)
  const legacySprites = ref<Record<Emotion, SpriteSet>>(defaultSprites())
  const legacyVitsSpeakerId = ref('3')

  const activeCharacter = computed(() =>
    characters.value.find(c => c.id === activeCharacterId.value) ?? null
  )

  // Writable computed: read from active char, write through to it
  const characterPrompt = computed({
    get: () => activeCharacter.value?.characterPrompt ?? legacyCharacterPrompt.value,
    set: (val) => {
      if (activeCharacter.value) {
        activeCharacter.value.characterPrompt = val
      } else {
        legacyCharacterPrompt.value = val
      }
    }
  })

  const sprites = computed({
    get: () => activeCharacter.value?.sprites ?? legacySprites.value,
    set: (val) => {
      if (activeCharacter.value) {
        activeCharacter.value.sprites = val
      } else {
        legacySprites.value = val
      }
    }
  })

  const vitsSpeakerId = computed({
    get: () => activeCharacter.value?.vitsSpeakerId || legacyVitsSpeakerId.value,
    set: (val) => {
      if (activeCharacter.value) {
        activeCharacter.value.vitsSpeakerId = val
      } else {
        legacyVitsSpeakerId.value = val
      }
    }
  })

  // Character CRUD
  function createCharacter(name: string): CharacterPreset {
    const char: CharacterPreset = {
      id: crypto.randomUUID(),
      name,
      characterPrompt: '',
      sprites: defaultSprites(),
      vitsSpeakerId: '3'
    }
    characters.value.push(char)
    return char
  }

  function deleteCharacter(id: string) {
    if (characters.value.length <= 1) return
    const idx = characters.value.findIndex(c => c.id === id)
    if (idx === -1) return
    characters.value.splice(idx, 1)
    if (activeCharacterId.value === id) {
      activeCharacterId.value = characters.value[0]?.id || ''
    }
  }

  function setActiveCharacter(id: string) {
    if (characters.value.some(c => c.id === id)) {
      activeCharacterId.value = id
    }
  }

  // Batch-import sprites from folder scan result
  function batchImportSprites(spriteMap: Record<string, string[]>, target?: Record<Emotion, SpriteSet>) {
    const sp = target || sprites.value
    for (const [emotion, paths] of Object.entries(spriteMap)) {
      if (paths.length > 0) {
        sp[emotion as Emotion] = {
          expression: emotion as Emotion,
          images: paths,
          idleAnimation: ''
        }
      }
    }
  }

  let loaded = false

  async function load() {
    if (loaded) return
    try {
      const data = await invoke<PetSettings>('load_settings')
      if (data) {
        apiKey.value = data.apiKey || ''
        apiEndpoint.value = data.apiEndpoint || apiEndpoint.value
        model.value = data.model || model.value
        legacyCharacterPrompt.value = data.characterPrompt || legacyCharacterPrompt.value
        vitsEndpoint.value = data.vitsEndpoint || vitsEndpoint.value
        legacyVitsSpeakerId.value = data.vitsSpeakerId || legacyVitsSpeakerId.value
        vitsModelType.value = data.vitsModelType || vitsModelType.value
        vitsFolderPath.value = data.vitsFolderPath || ''
        vitsModelPath.value = data.vitsModelPath || ''
        vitsAutoStart.value = data.vitsAutoStart ?? true
        memoryEnabled.value = data.memoryEnabled ?? false
        memoryMysqlUrl.value = data.memoryMysqlUrl || ''
        memoryAutoSave.value = data.memoryAutoSave ?? true
        if (data.sprites) {
          for (const key of Object.keys(data.sprites) as Emotion[]) {
            legacySprites.value[key] = data.sprites[key]
          }
        }

        // Load or migrate characters
        if (data.characters && data.characters.length > 0) {
          characters.value = data.characters
          activeCharacterId.value = data.activeCharacterId || characters.value[0].id
        } else {
          // Migration: create default character from legacy settings
          const defaultChar = createDefaultCharacter()
          defaultChar.characterPrompt = legacyCharacterPrompt.value
          defaultChar.sprites = legacySprites.value
          defaultChar.vitsSpeakerId = legacyVitsSpeakerId.value
          characters.value = [defaultChar]
          activeCharacterId.value = defaultChar.id
        }
      }
      loaded = true
    } catch {
      // Tauri API not available yet, will retry on next load
    }
  }

  async function save() {
    const data: PetSettings = {
      apiKey: apiKey.value,
      apiEndpoint: apiEndpoint.value,
      model: model.value,
      characterPrompt: characterPrompt.value,
      vitsEndpoint: vitsEndpoint.value,
      vitsSpeakerId: vitsSpeakerId.value,
      vitsModelType: vitsModelType.value,
      sprites: sprites.value,
      characters: characters.value,
      activeCharacterId: activeCharacterId.value,
      vitsFolderPath: vitsFolderPath.value,
      vitsModelPath: vitsModelPath.value,
      vitsAutoStart: vitsAutoStart.value,
      memoryEnabled: memoryEnabled.value,
      memoryMysqlUrl: memoryMysqlUrl.value,
      memoryAutoSave: memoryAutoSave.value
    }
    try {
      await invoke('save_settings', { settings: data })
    } catch { /* ignore save errors */ }
  }

  // Watch shared settings + characters array for auto-save
  watch([apiKey, apiEndpoint, model, vitsEndpoint, vitsFolderPath, vitsModelPath, vitsAutoStart, vitsModelType, memoryEnabled, memoryMysqlUrl, memoryAutoSave], () => save())
  watch(characters, () => save(), { deep: true })

  return {
    apiKey, apiEndpoint, model, vitsEndpoint,
    characterPrompt, sprites, vitsSpeakerId,
    characters, activeCharacterId,
    createCharacter, deleteCharacter, setActiveCharacter, batchImportSprites,
    vitsFolderPath, vitsModelPath, vitsAutoStart, vitsModelType,
    memoryEnabled, memoryMysqlUrl, memoryAutoSave,
    load, save
  }
})
