import type { Emotion } from '@/types'

const validEmotions: Emotion[] = [
  'eyeroll', 'embarrassed', 'grin', 'question', 'veryshy',
  'happy', 'shy', 'curious', 'doubt', 'frightened',
  'weird', 'angry', 'thinking', 'sigh', 'smile',
  'helpless', 'excited', 'serious', 'shocked', 'normal'
]

const emotionKeywords: Record<Emotion, { strong: string[]; weak: string[] }> = {
  eyeroll: {
    strong: ['翻白眼', '无语', '服了', '懒得说'],
    weak: ['无奈地', '扫兴', '真拿你没办法', '随便吧', '不想说话', '无所谓', '爱怎样怎样', '罢了']
  },
  embarrassed: {
    strong: ['不好意思', '惭愧', '对不起', '失礼', '丢脸', '无地自容'],
    weak: ['尴尬', '抱歉', '请恕我辈', '难为情', '见笑', '献丑', '过意不去', '抱歉抱歉', '别见怪', '抬不起头', '羞于启齿', '出丑']
  },
  grin: {
    strong: ['坏笑', '嘿嘿', '嘻', '捉弄', '恶作剧'],
    weak: ['偷笑', '窃笑', '调皮', '开玩笑', '逗你', '捉弄你', '使坏']
  },
  question: {
    strong: ['发问', '为什么', '怎么', '怎么回事', '难道'],
    weak: ['什么', '哪', '吗', '莫非', '不明白', '不懂', '能否告知', '请教', '请问']
  },
  veryshy: {
    strong: ['羞死了', '太害羞', '好害羞', '好丢脸', '别笑我', '恨不得钻地缝'],
    weak: ['羞', '不好意思', '不要取笑', '太丢人', '没脸见人', '羞死人了', '好难为情', '羞得不行', '没脸见主人']
  },
  happy: {
    strong: ['开心', '高兴', '太好了', '喜欢', '欢喜', '太棒了', '真开心'],
    weak: ['嘻嘻', '幸福', '快乐', '哈哈', '乐意', '愉快', '真好', '美妙', '令人高兴', '愉悦', '开开心心', '令人欣喜']
  },
  shy: {
    strong: ['害羞', '脸红', '红着脸', '脸红了', '讨厌啦', '扭捏', '支支吾吾'],
    weak: ['泛红', '发烫', '不好说', '怪不好意思', '不好意思说', '别扭', '难开口', '说不出口', '难以启齿', '微微泛红', '脸颊发烫', '耳根发烫', '羞红', '绯红', '移开视线', '低下头', '不敢看', '小声', '吞吞吐吐', '垂着头']
  },
  curious: {
    strong: ['好奇', '想知道', '告诉我', '说来听听'],
    weak: ['什么呀', '说一说', '讲讲', '打听', '问一下', '了解一下', '想知道呢', '快告诉我']
  },
  doubt: {
    strong: ['怀疑', '真的吗', '不信', '骗人', '假的吧'],
    weak: ['可疑', '确定', '当真', '开玩笑吧', '说谎', '难以相信', '不会吧', '怎么可能', '胡说的吧']
  },
  frightened: {
    strong: ['吓死', '好可怕', '恐怖', '好吓人', '鬼', '妖怪'],
    weak: ['惊吓', '吓人', '怕', '幽灵', '别吓我', '好恐怖', '惊悚', '阴森', '脊背发凉', '毛骨悚然']
  },
  weird: {
    strong: ['奇怪', '怪怪的', '不对劲', '诡异'],
    weak: ['异样', '怪异', '莫名其妙', '不解', '令人费解', '想不通', '离谱']
  },
  angry: {
    strong: ['生气', '哼', '可恶', '混蛋', '不可原谅', '气死'],
    weak: ['讨厌', '烦', '怒', '火大', '过分', '恼怒', '让人生气', '不要惹我', '忍无可忍', '愤愤不平', '令人不快']
  },
  thinking: {
    strong: ['让我想想', '思考', 'emmm', '考虑考虑', '斟酌'],
    weak: ['嗯', '唔', '考虑', '沉思', '想一想', '琢磨', '我辈想想', '容我想想', '思索', '盘算']
  },
  sigh: {
    strong: ['叹气', '唉', '无奈啊', '叹息', '可叹'],
    weak: ['算了吧', '没办法', '真没办法', '遗憾', '可惜了', '只能这样', '认了', '罢了罢了']
  },
  smile: {
    strong: ['微笑', '浅浅一笑', '含笑', '莞尔'],
    weak: ['笑', '呵呵', '轻轻笑', '浅笑', '微微一笑', '温柔地笑', '淡然一笑', '含笑不语']
  },
  helpless: {
    strong: ['无奈', '没办法', '无话可说', '无可奈何'],
    weak: ['无计可施', '真没办法', '束手无策', '爱莫能助', '拿你没办法', '随你去吧', '由着你']
  },
  excited: {
    strong: ['兴奋', '激动', '棒极了', '超级', '太棒', '极好'],
    weak: ['太好了', '期待', '超级好', '好激动', '迫不及待', '满怀期待', '欣喜若狂', '热血沸腾']
  },
  serious: {
    strong: ['严肃', '郑重', '认真说', '郑重其事'],
    weak: ['认真', '正经', '说正经的', '正色', '不苟言笑', '郑重地', '认真地说', '正儿八经']
  },
  shocked: {
    strong: ['震惊', '天哪', '居然', '不可思议', '难以置信'],
    weak: ['不会吧', '哇塞', '怎会', '大吃一惊', '吓一跳', '惊呆了', '怎么这样', '真的假的']
  },
  normal: { strong: [], weak: [] }
}

// Maps bracket action descriptions to emotions: （笑）→smile, （叹气）→sigh, etc.
const actionToEmotion: Record<string, Emotion> = {
  '笑': 'smile', '微笑': 'smile', '浅浅一笑': 'smile', '含笑': 'smile', '莞尔': 'smile',
  '浅笑': 'smile', '轻轻笑': 'smile', '淡然一笑': 'smile', '淡淡一笑': 'smile',
  '叹气': 'sigh', '叹息': 'sigh', '唉': 'sigh', '轻叹': 'sigh', '长叹': 'sigh',
  '害羞': 'shy', '脸红': 'shy', '扭捏': 'shy', '低头': 'shy', '垂眸': 'shy', '移开视线': 'shy', '小声': 'shy', '支吾': 'shy', '别过脸': 'shy', '垂头': 'shy',
  '非常害羞': 'veryshy', '羞死了': 'veryshy', '捂脸': 'veryshy', '超害羞': 'veryshy',
  '生气': 'angry', '愤怒': 'angry', '哼': 'angry', '恼怒': 'angry', '气鼓鼓': 'angry', '跺脚': 'angry',
  '开心': 'happy', '高兴': 'happy', '嘻嘻': 'happy', '欣喜': 'happy', '雀跃': 'happy', '欢笑': 'happy',
  '兴奋': 'excited', '激动': 'excited', '欢呼': 'excited', '雀跃不已': 'excited',
  '好奇': 'curious', '疑惑': 'curious', '歪头': 'curious', '探头': 'curious', '凑近': 'curious',
  '怀疑': 'doubt', '不信': 'doubt', '质疑': 'doubt', '皱眉': 'doubt',
  '害怕': 'frightened', '惊吓': 'frightened', '恐惧': 'frightened', '颤抖': 'frightened', '战栗': 'frightened', '退缩': 'frightened',
  '震惊': 'shocked', '惊讶': 'shocked', '天哪': 'shocked', '吃惊': 'shocked', '愣住': 'shocked', '呆住': 'shocked',
  '思考': 'thinking', '沉思': 'thinking', '想想': 'thinking', '唔': 'thinking', '思索': 'thinking', '琢磨': 'thinking', '斟酌': 'thinking',
  '无奈': 'helpless', '无助': 'helpless', '苦笑': 'helpless', '摊手': 'helpless', '摇头': 'helpless',
  '尴尬': 'embarrassed', '抱歉': 'embarrassed', '惭愧': 'embarrassed', '汗颜': 'embarrassed', '不好意思': 'embarrassed',
  '白眼': 'eyeroll', '无语': 'eyeroll', '扶额': 'eyeroll', '擦汗': 'eyeroll',
  '坏笑': 'grin', '嘿嘿': 'grin', '偷笑': 'grin', '窃笑': 'grin', '贼笑': 'grin',
  '问': 'question', '发问': 'question', '不解': 'question', '困惑': 'question',
  '严肃': 'serious', '正经': 'serious', '郑重': 'serious', '正色': 'serious', '认真': 'serious',
  '奇怪': 'weird', '怪怪的': 'weird', '莫名其妙': 'weird',
  // Interaction actions
  '摸头': 'shy', '摸头杀': 'veryshy', '摸': 'shy',
  '戳': 'curious', '戳肚子': 'shocked',
  '抱抱': 'happy', '拥抱': 'happy', '抱住': 'shy',
  '夸奖': 'shy', '称赞': 'shy', '表扬': 'shy',
  '安慰': 'sigh', '安抚': 'sigh',
  '调戏': 'embarrassed', '捉弄': 'grin',
  '道谢': 'smile', '谢谢': 'smile',
  '道歉': 'embarrassed', '对不起': 'embarrassed',
}

export function useEmotion() {
  function parseAiEmotion(text: string): { emotion: Emotion; cleanText: string } {
    // Handle various formats: [emotion:happy], [emotion: happy], [emotion：happy],
    // [Emotion:HAPPY], [emotion=happy], with optional spaces
    const match = text.match(/\[emotion\s*[:：=]\s*(\w+)\]/i)
    if (match) {
      const tag = match[1].toLowerCase()
      if (validEmotions.includes(tag as Emotion)) {
        return {
          emotion: tag as Emotion,
          cleanText: text.replace(/\[voice:[^\]]*\][\s\S]*?\[\/voice\]/gi, '').replace(/\[emotion\s*[:：=]\s*\w+\]/gi, '').trim()
        }
      }
    }
    return { emotion: 'normal', cleanText: text }
  }

  // Strip [voice:ja]...[/voice] tags so they don't interfere with Chinese text analysis
  function stripVoiceTags(text: string): string {
    return text.replace(/\[voice:[^\]]*\][\s\S]*?\[\/voice\]/gi, '').trim()
  }

  function detectFromAction(text: string): Emotion | null {
    // Find ALL bracket pairs and check each one — use the last match
    // since actions tend to appear after the text they describe
    const regex = /[（(【]([^）)】]{1,15})[）)】]/g
    let match: RegExpExecArray | null
    let lastEmotion: Emotion | null = null
    while ((match = regex.exec(text)) !== null) {
      const action = match[1].trim()
      // Try exact match first
      let emotion = actionToEmotion[action]
      // Try partial contains match (e.g. "轻轻摸了摸你的头" contains "摸头")
      if (!emotion) {
        for (const [key, val] of Object.entries(actionToEmotion)) {
          if (action.includes(key)) {
            emotion = val
            break
          }
        }
      }
      if (emotion) lastEmotion = emotion
    }
    return lastEmotion
  }

  function detectFromText(text: string): Emotion {
    // Strip voice tags first to avoid Japanese text influencing detection
    const clean = stripVoiceTags(text)

    let best: Emotion = 'normal'
    let bestScore = 0

    for (const [emotion, { strong, weak }] of Object.entries(emotionKeywords)) {
      if (emotion === 'normal') continue
      let score = 0
      for (const kw of strong) {
        if (clean.includes(kw)) score += 3
      }
      for (const kw of weak) {
        if (clean.includes(kw)) score += 1
      }
      if (score > bestScore) {
        bestScore = score
        best = emotion as Emotion
      }
    }

    if (bestScore === 0) {
      return detectSentiment(clean)
    }

    return best
  }

  // Last-resort: basic sentiment analysis when no keywords match
  function detectSentiment(text: string): Emotion {
    const pos = ['开心', '高兴', '喜欢', '欢喜', '乐意', '愉快', '温暖', '美好', '期待', '希望', '谢谢', '感谢', '不错', '好哦', '真不错', '真好', '太好了']
    const neg = ['难过', '伤心', '孤独', '遗憾', '可惜', '担心', '担忧', '叹气', '唉', '失落', '悲伤']
    const excited = ['太棒', '超级', '极好', '哇', '耶', '太厉害', '棒极了']
    const question = ['为什么', '怎么', '什么', '哪', '莫非', '难道']

    for (const w of excited) if (text.includes(w)) return 'excited'
    if (/[！!]{2,}/.test(text)) return 'excited'
    if (/[？?]/.test(text) && question.some(w => text.includes(w))) return 'question'
    if (/[？?]/.test(text) && pos.some(w => text.includes(w))) return 'happy'
    if (/[？?]/.test(text)) return 'question'
    for (const w of neg) if (text.includes(w)) return 'sigh'
    for (const w of pos) if (text.includes(w)) return 'happy'

    return 'normal'
  }

  return { parseAiEmotion, detectFromAction, detectFromText }
}
