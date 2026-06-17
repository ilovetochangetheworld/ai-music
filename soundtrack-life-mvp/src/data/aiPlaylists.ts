import type { Song } from '../types'

export interface AiPlaylist {
  id: string
  title: string
  subtitle: string
  description: string
  coverTone?: string
  coverUrl?: string
  songCount?: number
  source?: 'mock' | 'qqmusic'
  type?: string
  quickPrompts: string[]
  songs: Song[]
}

export const aiPlaylists: AiPlaylist[] = [
  {
    id: 'jay',
    title: '周杰伦精选',
    subtitle: '68 首 · 华语流行 / R&B / 中国风',
    description: '从抒情、说唱、中国风到夜间驾驶感，适合展示歌手歌单里的精细化筛选。',
    coverTone: 'linear-gradient(135deg, #2a2018, #7b4b22)',
    quickPrompts: ['只听抒情歌', '适合通勤', '节奏感强但不要太炸', '类似七里香的感觉'],
    songs: [
      song('jay_001', '七里香', '周杰伦', '七里香', 'mandarin', 2004, ['pop', 'chinese-style'], ['romantic', 'warm', 'nostalgic'], ['walk', 'summer', 'alone'], 50, 76, ['抒情', '校园', '清新'], '温柔明亮的华语抒情歌，带夏天和回忆感', 42, '2026-05-28'),
      song('jay_002', '晴天', '周杰伦', '叶惠美', 'mandarin', 2003, ['pop', 'ballad'], ['sad', 'nostalgic', 'soft'], ['rain', 'school', 'night'], 44, 84, ['抒情', '回忆', '合唱'], '旋律熟悉、情绪清澈的校园回忆歌', 88, '2026-06-12'),
      song('jay_003', '夜曲', '周杰伦', '十一月的萧邦', 'mandarin', 2005, ['r&b', 'pop'], ['sad', 'restrained', 'night'], ['driving', 'night', 'alone'], 58, 83, ['夜晚', '节奏稳定', 'R&B'], '暗色夜间氛围，节奏稳定，伤感但克制', 36, '2026-04-18'),
      song('jay_004', '一路向北', '周杰伦', '十一月的萧邦', 'mandarin', 2005, ['rock', 'ballad'], ['sad', 'release', 'road'], ['driving', 'night'], 63, 92, ['驾驶', '电影感', '副歌'], '适合夜晚开车的公路感情歌，副歌有释放感', 27, '2026-03-20'),
      song('jay_005', '稻香', '周杰伦', '魔杰座', 'mandarin', 2008, ['pop', 'folk'], ['warm', 'optimistic', 'hopeful'], ['morning', 'commute', 'walk'], 66, 102, ['轻快', '治愈', '通勤'], '轻快治愈，适合重新出发和通勤路上听', 61, '2026-06-01'),
      song('jay_006', '以父之名', '周杰伦', '叶惠美', 'mandarin', 2003, ['hip-hop', 'orchestral'], ['dark', 'dramatic', 'tense'], ['focus', 'night'], 82, 95, ['说唱', '戏剧感', '暗黑'], '编曲戏剧化、能量高，适合强烈氛围但不适合睡前', 18, '2026-01-10'),
      song('jay_007', '简单爱', '周杰伦', '范特西', 'mandarin', 2001, ['pop'], ['romantic', 'fresh', 'warm'], ['walk', 'date', 'sunny'], 56, 88, ['轻松', '甜', '清新'], '轻松甜感的早期流行歌，适合放松和散步', 48, '2026-04-09'),
      song('jay_008', '双截棍', '周杰伦', '范特西', 'mandarin', 2001, ['hip-hop', 'rock'], ['energetic', 'playful'], ['run', 'party'], 92, 138, ['快歌', '燃', '说唱'], '节奏强、辨识度高，适合高能场景', 25, '2026-05-05'),
      song('jay_009', '安静', '周杰伦', '范特西', 'mandarin', 2001, ['ballad'], ['sad', 'soft', 'restrained'], ['night', 'alone', 'sleep'], 30, 68, ['抒情', '安静', '失恋'], '低能量钢琴情歌，适合深夜独处', 39, '2026-02-14'),
      song('jay_010', '告白气球', '周杰伦', '周杰伦的床边故事', 'mandarin', 2016, ['pop'], ['romantic', 'fresh', 'light'], ['date', 'commute', 'party'], 68, 112, ['甜', '轻快', '合唱'], '轻快甜歌，适合聚会或轻松通勤', 72, '2026-06-14'),
      song('jay_011', '烟花易冷', '周杰伦', '跨时代', 'mandarin', 2010, ['chinese-style', 'ballad'], ['sad', 'restrained', 'ancient'], ['night', 'alone'], 34, 72, ['中国风', '抒情', '冷感'], '中国风慢歌，情绪克制、画面感冷清', 22, '2026-01-26'),
      song('jay_012', '霍元甲', '周杰伦', '霍元甲 EP', 'mandarin', 2006, ['hip-hop', 'chinese-style'], ['energetic', 'heroic'], ['run', 'party', 'workout'], 88, 126, ['燃', '快歌', '中国风'], '高能量中国风快歌，适合运动和热场', 17, '2025-12-03'),
    ],
  },
  {
    id: 'cantonese',
    title: '粤语经典',
    subtitle: '82 首 · 粤语 / 港乐 / 经典合唱',
    description: '适合展示语言、年代、情绪和“不要太吵”的复合筛选。',
    coverTone: 'linear-gradient(135deg, #17212f, #315b73)',
    quickPrompts: ['只听快歌', '适合深夜开车', '90年代粤语歌', '伤感但不压抑'],
    songs: [
      song('can_001', '富士山下', '陈奕迅', 'What\'s Going On...?', 'cantonese', 2006, ['ballad'], ['sad', 'restrained', 'night'], ['night', 'alone', 'driving'], 36, 72, ['粤语', '抒情', '克制'], '克制伤感的粤语慢歌，适合夜晚独处', 58, '2026-06-02'),
      song('can_002', 'K歌之王', '陈奕迅', '打得火热', 'cantonese', 2000, ['pop'], ['sad', 'dramatic'], ['karaoke', 'night'], 56, 88, ['粤语', '合唱', '经典'], '情绪浓度高、适合合唱的粤语经典', 64, '2026-04-30'),
      song('can_003', '友情岁月', '郑伊健', '古惑仔电影原声', 'cantonese', 1996, ['rock', 'pop'], ['heroic', 'energetic'], ['party', 'driving'], 82, 122, ['90年代', '燃', '合唱'], '热血港片感，节奏明显，适合聚会和驾驶', 31, '2026-03-12'),
      song('can_004', '海阔天空', 'Beyond', '乐与怒', 'cantonese', 1993, ['rock'], ['hopeful', 'release', 'heroic'], ['road', 'party', 'night'], 78, 92, ['90年代', '摇滚', '合唱'], '经典摇滚大歌，副歌释放感强', 76, '2026-06-10'),
      song('can_005', '风继续吹', '张国荣', '风继续吹', 'cantonese', 1983, ['ballad'], ['sad', 'soft', 'nostalgic'], ['night', 'alone'], 32, 70, ['怀旧', '抒情', '粤语'], '温柔怀旧的粤语慢歌，适合深夜', 24, '2026-01-18'),
      song('can_006', '少女的祈祷', '杨千嬅', 'Play It Loud, Kiss Me Soft', 'cantonese', 2000, ['pop'], ['romantic', 'fresh', 'bittersweet'], ['commute', 'walk'], 64, 108, ['女声', '轻快', '粤语'], '轻快女声粤语歌，苦甜但不沉重', 47, '2026-05-17'),
      song('can_007', '下一站天后', 'Twins', 'Touch of Love', 'cantonese', 2003, ['pop'], ['fresh', 'optimistic'], ['commute', 'party'], 72, 116, ['女声', '轻快', '合唱'], '明亮轻快，适合通勤和合唱', 53, '2026-04-06'),
      song('can_008', '讲不出再见', '谭咏麟', '梦幻的笑容', 'cantonese', 1994, ['ballad'], ['sad', 'nostalgic', 'dramatic'], ['karaoke', 'night'], 48, 78, ['90年代', '抒情', '合唱'], '浓烈告别感，经典 K 歌氛围', 44, '2026-02-11'),
      song('can_009', '冷雨夜', 'Beyond', '现代舞台', 'cantonese', 1988, ['rock', 'ballad'], ['sad', 'night', 'restrained'], ['rain', 'driving', 'night'], 54, 86, ['雨夜', '摇滚', '克制'], '雨夜氛围明显，节奏稳定但不过度刺激', 21, '2025-11-29'),
      song('can_010', '红日', '李克勤', '红日', 'cantonese', 1992, ['pop-rock'], ['energetic', 'hopeful'], ['run', 'commute', 'party'], 86, 128, ['快歌', '90年代', '励志'], '高能量励志快歌，适合提神和运动', 69, '2026-06-15'),
    ],
  },
  {
    id: 'favorites',
    title: '我的收藏',
    subtitle: '156 首 · 多语言 / 多风格 / 私人常听',
    description: '模拟用户收藏库，适合展示“最近没听过”“冷门宝藏”“此刻场景”的个人音乐资产调用。',
    coverTone: 'linear-gradient(135deg, #1d2935, #4a6a51)',
    quickPrompts: ['最近没听过的宝藏', '适合深夜工作', '只听女歌手', '适合周末做饭'],
    songs: [
      song('fav_001', '平凡之路', '朴树', '猎户星座', 'mandarin', 2014, ['folk', 'pop'], ['reflective', 'hopeful'], ['commute', 'road', 'night'], 58, 82, ['公路', '民谣', '释怀'], '适合通勤路上回看一天，稳而不闷', 70, '2026-06-13'),
      song('fav_002', '慢慢喜欢你', '莫文蔚', '我们在中场相遇', 'mandarin', 2018, ['ballad'], ['warm', 'soft', 'romantic'], ['night', 'date', 'sleep'], 42, 78, ['女声', '温柔', '睡前'], '温柔低能量女声，适合夜晚放松', 48, '2026-05-01'),
      song('fav_003', 'New Boy', '朴树', '我去2000年', 'mandarin', 1999, ['pop-rock'], ['fresh', 'optimistic'], ['morning', 'commute'], 72, 124, ['轻快', '复古', '通勤'], '复古明亮，适合早晨重新启动', 36, '2026-03-24'),
      song('fav_004', 'Lemon Tree', 'Fool\'s Garden', 'Dish of the Day', 'english', 1995, ['pop'], ['fresh', 'playful', 'calm'], ['cooking', 'weekend'], 64, 100, ['英文', '轻松', '做饭'], '轻松但不吵，适合周末做饭当背景', 18, '2025-10-20'),
      song('fav_005', '夜空中最亮的星', '逃跑计划', '世界', 'mandarin', 2011, ['rock'], ['hopeful', 'release'], ['night', 'road'], 68, 128, ['摇滚', '副歌', '释放'], '副歌打开情绪，适合夜路和需要一点力量的时候', 55, '2026-02-20'),
      song('fav_006', 'Weightless', 'Marconi Union', 'Weightless', 'instrumental', 2011, ['ambient'], ['calm', 'soft'], ['sleep', 'focus', 'alone'], 18, 60, ['纯音乐', '睡前', '放松'], '极低能量氛围曲，适合睡前和专注', 9, '2025-09-02', 'instrumental'),
      song('fav_007', '起风了', '买辣椒也用券', '起风了', 'mandarin', 2017, ['pop', 'folk'], ['reflective', 'release', 'hopeful'], ['commute', 'night'], 60, 96, ['副歌', '青春', '释怀'], '叙事感强，副歌有释怀和向前走的力量', 83, '2026-06-16'),
      song('fav_008', '玫瑰色的人生', '陈珊妮', '后来我们都哭了', 'mandarin', 2004, ['indie-pop'], ['restrained', 'cool', 'lonely'], ['night', 'alone', 'focus'], 46, 92, ['冷门', '女声', '独处'], '冷感女声，适合深夜工作但不会太伤', 6, '2025-08-18'),
      song('fav_009', 'City of Stars', 'Ryan Gosling / Emma Stone', 'La La Land', 'english', 2016, ['soundtrack', 'jazz'], ['romantic', 'soft', 'night'], ['night', 'walk', 'date'], 34, 76, ['英文', '电影感', '爵士'], '轻柔电影感，适合夜晚散步', 23, '2026-01-03'),
      song('fav_010', '无与伦比的美丽', '苏打绿', '无与伦比的美丽', 'mandarin', 2007, ['pop'], ['warm', 'hopeful', 'soft'], ['walk', 'night'], 54, 88, ['温柔', '治愈', '合唱'], '温柔托举感，适合低落时慢慢恢复', 41, '2026-04-25'),
      song('fav_011', '红豆', '王菲', '唱游', 'mandarin', 1998, ['ballad'], ['sad', 'soft', 'restrained'], ['night', 'alone'], 36, 74, ['女声', '经典', '克制'], '克制女声情歌，伤感但不过度压抑', 63, '2026-05-30'),
      song('fav_012', 'September', 'Earth, Wind & Fire', 'The Best of Earth, Wind & Fire', 'english', 1978, ['funk', 'disco'], ['energetic', 'happy', 'playful'], ['party', 'cooking', 'weekend'], 88, 126, ['英文', '跳舞', '做饭'], '明亮高能量，适合周末做饭或聚会', 12, '2025-12-31'),
    ],
  },
]

function song(
  id: string,
  title: string,
  artist: string,
  album: string,
  language: Song['language'],
  releaseYear: number,
  genre: string[],
  mood: string[],
  scene: string[],
  energy: number,
  bpm: number,
  tags: string[],
  semanticDescription: string,
  playCount: number,
  lastPlayedAt: string,
  version: Song['version'] = 'studio',
): Song {
  return {
    id,
    title,
    artist,
    album,
    language,
    releaseYear,
    genre,
    version,
    mood,
    scene,
    energy,
    bpm,
    tags,
    semanticDescription,
    playCount,
    lastPlayedAt,
    source: 'mock',
    reasonSeeds: [
      semanticDescription,
      `${energy >= 75 ? '能量偏高' : energy <= 40 ? '能量偏低' : '能量适中'}，${bpm >= 115 ? '节奏较快' : bpm <= 80 ? '节奏偏慢' : '节奏稳定'}。`,
    ],
  }
}
