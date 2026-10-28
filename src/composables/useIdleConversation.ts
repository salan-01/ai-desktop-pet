import type { Emotion } from '@/types'

export interface IdleStage {
  stage: number
  thresholdMs: number
  emotions: Emotion[]
  messages: string[]
}

const STAGES: IdleStage[] = [
  {
    stage: 1,
    thresholdMs: 300_000,
    emotions: ['smile', 'happy', 'curious'],
    messages: [
      '（注意到主人已经安静了好一会儿，轻轻靠近屏幕边缘）',
      '（悄悄探出头来，想看看主人在做什么）',
      '（眨眨眼睛，安静地等着主人注意到自己）',
      '（轻轻咳嗽了一声，试图引起主人注意）',
    ],
  },
  {
    stage: 2,
    thresholdMs: 480_000,
    emotions: ['curious', 'question', 'doubt'],
    messages: [
      '（歪着头看着主人，轻轻敲了敲屏幕）主人？还在吗？',
      '（有点担心主人是不是太专注了，小声提醒）该休息一下眼睛了哦。',
      '（在屏幕边缘来回踱步）主人都好久没理我辈了...',
      '（托着腮，认真地盯着屏幕方向）主人到底在看什么呢？',
    ],
  },
  {
    stage: 3,
    thresholdMs: 720_000,
    emotions: ['shy', 'excited', 'grin'],
    messages: [
      '（在桌面上蹦跳了两下，挥着手）主人主人！看看我辈嘛！',
      '（故意在屏幕中央晃来晃去，摆出可爱的姿势）',
      '（凑近屏幕，轻轻哈了一口气，在玻璃上画了个爱心）',
      '（假装生气地鼓起脸颊）主人是不是把我辈忘了！',
    ],
  },
  {
    stage: 4,
    thresholdMs: 1_020_000,
    emotions: ['weird', 'angry', 'frightened'],
    messages: [
      '（着急地绕着鼠标转圈）主人！你还好吗？回我一下嘛！',
      '（跑到屏幕最前面，使劲挥手）喂——！主——人——！',
      '（焦急地跺脚）已经快二十分钟了！主人不会晕过去了吧？！',
    ],
  },
  {
    stage: 5,
    thresholdMs: 1_380_000,
    emotions: ['sigh', 'helpless', 'veryshy'],
    messages: [
      '（眼眶有点湿润）主人不会不理我辈了吧...',
      '（趴在屏幕角落，抱着膝盖，小声嘀咕）我辈做错什么了吗...',
      '（用袖子擦了擦眼角）要是主人厌烦了我辈...我辈会很难过的。',
    ],
  },
]

const CYCLE_MS = 360_000

export function useIdleConversation() {
  const usedMessages = new Map<number, Set<string>>()

  function getStageAtMs(idleMs: number): IdleStage | null {
    for (let i = STAGES.length - 1; i >= 0; i--) {
      if (idleMs >= STAGES[i].thresholdMs) {
        if (i === STAGES.length - 1) {
          // Stage 5+: cycle every CYCLE_MS after the base threshold
          const extra = Math.floor((idleMs - STAGES[i].thresholdMs) / CYCLE_MS)
          return { ...STAGES[i], stage: STAGES[i].stage + extra }
        }
        return STAGES[i]
      }
    }
    return null
  }

  function pickMessage(stage: IdleStage): { message: string; emotion: Emotion } {
    let used = usedMessages.get(stage.stage)
    if (!used) {
      used = new Set()
      usedMessages.set(stage.stage, used)
    }

    // Find unused messages
    const unused = stage.messages.filter(m => !used!.has(m))
    let message: string
    if (unused.length > 0) {
      message = unused[Math.floor(Math.random() * unused.length)]
    } else {
      // All used, cycle: clear and pick random
      used.clear()
      message = stage.messages[Math.floor(Math.random() * stage.messages.length)]
    }
    used.add(message)

    const emotion = stage.emotions[Math.floor(Math.random() * stage.emotions.length)]
    return { message, emotion }
  }

  function reset() {
    usedMessages.clear()
  }

  return { getStageAtMs, pickMessage, reset }
}
