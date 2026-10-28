export type Emotion =
  | 'eyeroll'
  | 'embarrassed'
  | 'grin'
  | 'question'
  | 'veryshy'
  | 'happy'
  | 'shy'
  | 'curious'
  | 'doubt'
  | 'frightened'
  | 'weird'
  | 'angry'
  | 'thinking'
  | 'sigh'
  | 'smile'
  | 'helpless'
  | 'excited'
  | 'serious'
  | 'shocked'
  | 'normal'

export interface SpriteSet {
  expression: Emotion
  images: string[]
  idleAnimation?: string
}

export interface VitsSpeaker {
  id: number
  name: string
  lang: string[]
  modelType: string
}

export interface ModelGroup {
  name: string
  path: string
  speakers: string[]
}

export interface PetSettings {
  apiKey: string
  apiEndpoint: string
  model: string
  characterPrompt: string
  vitsEndpoint: string
  vitsSpeakerId: string
  vitsModelType?: string
  sprites: Record<Emotion, SpriteSet>
  characters?: CharacterPreset[]
  activeCharacterId?: string
  vitsFolderPath?: string
  vitsModelPath?: string
  vitsAutoStart?: boolean
  memoryEnabled?: boolean
  memoryMysqlUrl?: string
  memoryAutoSave?: boolean
}

export interface MemoryItem {
  id: number
  characterId: string
  content: string
  source: string
  createdAt: string
}

export interface CharacterPreset {
  id: string
  name: string
  characterPrompt: string
  sprites: Record<Emotion, SpriteSet>
  vitsSpeakerId: string
}

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  emotion?: Emotion
}

export type TimePeriod = 'morning' | 'noon' | 'afternoon' | 'night' | 'late_night'
