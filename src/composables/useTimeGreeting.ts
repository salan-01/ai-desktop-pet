import type { Emotion, TimePeriod } from '@/types'

export interface TimeGreetingInfo {
  period: TimePeriod
  greetingHint: string
  defaultEmotion: Emotion
}

export function useTimeGreeting() {
  function getTimePeriod(): TimePeriod {
    const h = new Date().getHours()
    if (h >= 6 && h <= 10) return 'morning'
    if (h >= 11 && h <= 13) return 'noon'
    if (h >= 14 && h <= 17) return 'afternoon'
    if (h >= 18 && h <= 23) return 'night'
    return 'late_night'
  }

  function getTimeGreeting(): TimeGreetingInfo {
    const period = getTimePeriod()
    switch (period) {
      case 'morning':
        return {
          period,
          greetingHint: '（清晨的阳光透过窗帘洒进房间，主人刚刚醒来，打开电脑看到了你）',
          defaultEmotion: 'smile',
        }
      case 'noon':
        return {
          period,
          greetingHint: '（中午了，窗外阳光正盛，主人已经在电脑前坐了很久，还没去吃午饭）',
          defaultEmotion: 'curious',
        }
      case 'afternoon':
        return {
          period,
          greetingHint: '（下午的时光慵懒地流淌，主人坐在电脑前，似乎刚忙完一阵，正在休息）',
          defaultEmotion: 'thinking',
        }
      case 'night':
        return {
          period,
          greetingHint: '（夜色已深，窗外一片漆黑，主人显得很疲惫，却还坐在电脑前没有离开）',
          defaultEmotion: 'sigh',
        }
      case 'late_night':
        return {
          period,
          greetingHint: '（已经凌晨了，万籁俱寂，主人居然还没睡，你看了很担心）',
          defaultEmotion: 'serious',
        }
    }
  }

  return { getTimePeriod, getTimeGreeting }
}
