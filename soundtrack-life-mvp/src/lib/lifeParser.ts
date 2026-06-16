import type { LifeScene, Soundtrack, UserPreference } from '../types'
import { callLLMJson } from './llm'
import { searchQQMusicForScene } from './musicApi'
import { matchSongs } from './songMatcher'

// ── 情绪词典：用于本地启发式解析（LLM 不可用时的降级路径）──
interface Bucket {
  key: string
  emotion: string
  energy: number
  mood: string[]
  sceneTags: string[]
  intent: string
  keywords: string[]
  narration: string
}

const BUCKETS: Bucket[] = [
  {
    key: 'tense', emotion: '紧张', energy: 70, mood: ['energetic', 'fresh'],
    sceneTags: ['work', 'commute'], intent: '给紧张一点稳定的节奏，不火上浇油',
    keywords: ['汇报', '演讲', '面试', '考试', '压力', '紧张', '赶', 'deadline', '加班', '开会'],
    narration: '这一段心跳有点快。我们不压着你，也不催你，挑几首有骨架的歌，让节奏替你稳住手心的汗。',
  },
  {
    key: 'happy', emotion: '高兴', energy: 76, mood: ['optimistic', 'release', 'fresh'],
    sceneTags: ['walk', 'commute', 'morning'], intent: '把好心情放大，但不油腻',
    keywords: ['夸', '表扬', '开心', '高兴', '兴奋', '成功', '搞定', '通过', '升职', '惊喜', '好事'],
    narration: '今天有件事是值得记住的。这几首歌不解释太多，只想陪你把这点高兴多留一会儿。',
  },
  {
    key: 'down', emotion: '失落', energy: 28, mood: ['sad', 'restrained', 'soft'],
    sceneTags: ['alone', 'night'], intent: '接住情绪，不过度煽情',
    keywords: ['失败', '难过', '丧', '失落', '沮丧', '累', '哭', '淋雨', '雨', '崩', '委屈', '失望'],
    narration: '这一段先不急着振作。选几首低能量但不彻底坠落的歌，像有人在旁边安静坐着，不说话。',
  },
  {
    key: 'recover', emotion: '慢慢恢复', energy: 50, mood: ['hopeful', 'warm', 'reflective'],
    sceneTags: ['walk', 'night'], intent: '从低处往外走，留一点向前的光',
    keywords: ['恢复', '接住', '好起来', '亮起来', '希望', '继续', '重新', '走出', '放下', '慢慢'],
    narration: '你没有立刻变好，但已经从今天里面走出来了一点。这几首歌负责陪你把脚步重新放慢、再放稳。',
  },
  {
    key: 'calm', emotion: '平静', energy: 35, mood: ['calm', 'soft', 'warm'],
    sceneTags: ['walk', 'night', 'alone'], intent: '降低噪音，让一天慢慢收尾',
    keywords: ['散步', '放松', '松弛', '平静', '安静', '一个人', '独自', '放空', '发呆', '休息'],
    narration: '夜晚适合一个人慢慢走。这几首歌不抢话，只在你身边铺一层暖暖的底色。',
  },
  {
    key: 'irritable', emotion: '烦躁', energy: 40, mood: ['calm', 'reflective'],
    sceneTags: ['commute', 'work'], intent: '降低焦躁，让节奏慢慢稳定',
    keywords: ['堵', '烦', '烦躁', '挤', '吵', '催', '焦虑', '乱'],
    narration: '被城市卡住的时候，最不需要的就是更吵的歌。这一段我们把节奏往下压一点，先让呼吸跟上来。',
  },
  {
    key: 'run', emotion: '释放', energy: 84, mood: ['energetic', 'release'],
    sceneTags: ['run', 'night'], intent: '把情绪整个推上去再松开',
    keywords: ['夜跑', '跑步', '健身', '运动', '撒欢', '蹦', '嗨'],
    narration: '需要出汗的时候，话就少说。这几首歌只负责把你的步频和心率一起拉满。',
  },
]

const DEFAULT_BUCKET: Bucket = {
  key: 'reflective', emotion: '回看', energy: 52, mood: ['reflective', 'hopeful'],
  sceneTags: ['commute', 'night'], intent: '给这一天一个可以回看的视角',
  keywords: [],
  narration: '这一段没有强烈的起伏，就当作给今天留一段过场音乐，让你能稍微抽离地看一眼自己。',
}

const TIME_HINTS: { kw: string[]; time: string; scene: string }[] = [
  { kw: ['早上', '清晨', '早晨', '通勤', '上班路', '起床'], time: 'morning', scene: 'morning' },
  { kw: ['上午'], time: 'morning', scene: 'work' },
  { kw: ['中午', '午'], time: 'noon', scene: 'work' },
  { kw: ['下午'], time: 'afternoon', scene: 'work' },
  { kw: ['傍晚', '黄昏'], time: 'evening', scene: 'walk' },
  { kw: ['晚上', '夜', '凌晨', '深夜', '睡'], time: 'night', scene: 'night' },
]

const COLORS: Record<string, string> = {
  紧张: '#c2562f', 高兴: '#e7a13b', 失落: '#7b5e8f', 慢慢恢复: '#4c8a86',
  平静: '#4c8a86', 烦躁: '#8c8377', 释放: '#c2562f', 回看: '#6f7f86',
}

function splitClauses(text: string): string[] {
  return text
    .split(/[，。！？；,.!?;\n]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
}

function pickBucket(clause: string): Bucket {
  let best: Bucket | null = null
  let bestHits = 0
  for (const b of BUCKETS) {
    const hits = b.keywords.filter((k) => clause.includes(k)).length
    if (hits > bestHits) {
      bestHits = hits
      best = b
    }
  }
  return best ?? DEFAULT_BUCKET
}

function detectTime(clause: string, index: number, total: number): string {
  for (const t of TIME_HINTS) {
    if (t.kw.some((k) => clause.includes(k))) return t.time
  }
  // 按出现顺序推断
  const ratio = index / Math.max(1, total - 1)
  if (ratio < 0.34) return 'morning'
  if (ratio < 0.67) return 'afternoon'
  return 'night'
}

function timeToSceneTag(time: string): string {
  return ({ morning: 'morning', noon: 'work', afternoon: 'work', evening: 'walk', night: 'night' } as Record<string, string>)[time] ?? 'night'
}

const TITLES: Record<string, string[]> = {
  down: ['雨后慢慢亮起来', '把今天轻轻放下', '低处也有光'],
  happy: ['今天值得单曲循环', '好天气存进耳朵里', '把高兴多留一会儿'],
  tense: ['深呼吸的一天', '在紧张里找到节拍', '心跳调成正常速度'],
  calm: ['一个人慢慢走', '夜色把白天调暗', '安静地收尾'],
  run: ['把今天跑出去', '心率拉满的夜晚', '出汗就不丧'],
  reflective: ['平凡的一天，认真听', '今天的过场音乐', '回看这一天'],
}

function hashPick<T>(arr: T[], seed: string): T {
  let h = 0
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0
  return arr[h % arr.length]
}

/** 本地启发式解析（mock 降级路径） */
function heuristicParse(text: string, pref?: UserPreference): Omit<Soundtrack, 'scenes'> & { scenes: LifeScene[] } {
  const clauses = splitClauses(text)
  const total = clauses.length || 1

  let scenes: LifeScene[] = clauses.map((clause, i) => {
    const b = pickBucket(clause)
    const time = detectTime(clause, i, total)
    const sceneTags = Array.from(new Set([...b.sceneTags, timeToSceneTag(time)]))
    return {
      id: `scene_${i + 1}`,
      label: clause.length > 14 ? clause.slice(0, 14) + '…' : clause,
      timeOfDay: time,
      sourceEvent: clause,
      emotion: b.emotion,
      energy: b.energy,
      musicIntent: b.intent,
      recommendedTags: [...b.mood, ...sceneTags],
      djNarration: b.narration,
      recommendedSongs: matchSongs(
        { scene: sceneTags, mood: b.mood, energy: b.energy, languages: pref?.languages },
        2,
      ),
    } as LifeScene
  })

  // 收敛到 3-5 个场景
  if (scenes.length > 5) scenes = scenes.slice(0, 5)

  const overall = scenes[0]?.emotion ?? '平静'
  const arcKey = pickBucket(text).key
  const title = hashPick(TITLES[arcKey] ?? TITLES.reflective, text)

  return {
    id: `soundtrack_${Date.now()}`,
    title,
    subtitle: scenes.length
      ? `一张从「${scenes[0].emotion}」走到「${scenes[scenes.length - 1].emotion}」的私人原声带`
      : '一张属于今天的私人原声带',
    date: new Date().toISOString().slice(0, 10),
    overallEmotion: overall,
    moodPath: scenes.map((s) => ({ label: s.emotion, energy: s.energy })),
    scenes,
    openingNarration:
      '今天这张原声带，不急着替你下结论。我们先按时间把它铺开，一段一段慢慢听。',
    closingNarration:
      '这就是你今天的声音。它不一定完美，但它确实属于你。明天的，明天再录。',
    shareCopy: `《${title}》— 我把今天，听成了一张电影原声带。`,
    sourceText: text,
  }
}

export function emotionColor(emotion: string): string {
  return COLORS[emotion] ?? '#8c8377'
}

// ── LLM 返回结构（对应 prompts/life-soundtrack.md）──
interface LLMScene {
  id: string; label: string; timeOfDay: string; sourceEvent: string
  emotion: string; energy: number; musicIntent: string
  recommendedTags: string[]; searchKeywords?: string[]; djNarration: string
}
interface LLMResult {
  title: string; subtitle: string; overallEmotion: string
  moodPath: { label: string; energy: number }[]
  scenes: LLMScene[]
  openingNarration: string; closingNarration: string; shareCopy: string
}

const SYSTEM = `你是一个中文 AI 音乐导演。理解用户今天的生活轨迹，拆成 3-5 个有情绪起伏的场景，为每个场景设计音乐意图、推荐标签和电台旁白。不要过度鸡汤，情绪细腻，必须返回 JSON。recommendedTags 用英文标签：mood(warm/soft/hopeful/sad/calm/energetic/release/reflective/fresh/optimistic/restrained) 与 scene(commute/walk/work/night/run/sleep/morning/alone)。energy 为 0-100 整数。`

const SCHEMA_HINT = `只返回如下 JSON，不要 markdown，不要解释：
{
  "title": "今日原声带标题",
  "subtitle": "一句副标题",
  "overallEmotion": "整体情绪",
  "moodPath": [
    { "label": "情绪名", "energy": 0 }
  ],
  "scenes": [
    {
      "id": "scene_1",
      "label": "场景标题",
      "timeOfDay": "morning | noon | afternoon | evening | night",
      "sourceEvent": "用户原始事件片段",
      "emotion": "中文情绪",
      "energy": 0,
      "musicIntent": "这一段需要什么音乐",
      "recommendedTags": ["warm", "soft", "walk"],
      "searchKeywords": ["具体歌曲名或歌名+歌手", "第二个不同歌名", "第三个不同歌名"],
      "djNarration": "15-30 秒中文电台旁白"
    }
  ],
  "openingNarration": "开场旁白",
  "closingNarration": "收尾旁白",
  "shareCopy": "分享文案"
}
searchKeywords 必须提供 3-5 个适合 QQ 音乐搜索的候选，优先用不同歌名或“歌名 歌手”，不要只写抽象情绪词，也不要重复同一首歌的不同版本。`

/**
 * 解析生活文本生成今日原声带。优先 LLM，失败自动降级到本地启发式。
 * 歌曲推荐始终由本地 songMatcher 完成（避免 LLM 编造不存在的歌）。
 */
export async function generateSoundtrack(text: string, pref?: UserPreference): Promise<Soundtrack> {
  const user = `${SCHEMA_HINT}\n\n用户今天的描述：\n${text}\n\n用户偏好：\n${JSON.stringify(pref ?? {})}`
  const llm = await callLLMJson<LLMResult>(SYSTEM, user)

  if (llm?.scenes?.length) {
    const scenes: LifeScene[] = await Promise.all(llm.scenes.slice(0, 5).map(async (s, i) => {
      const sceneTags = (s.recommendedTags ?? []).filter((t) =>
        ['commute', 'walk', 'work', 'night', 'run', 'sleep', 'morning', 'alone'].includes(t),
      )
      const moodTags = (s.recommendedTags ?? []).filter((t) => !sceneTags.includes(t))
      const localSongs = matchSongs(
        { scene: sceneTags, mood: moodTags, energy: s.energy, languages: pref?.languages },
        2,
      )
      const baseScene: LifeScene = {
        id: s.id || `scene_${i + 1}`,
        label: s.label,
        timeOfDay: s.timeOfDay,
        sourceEvent: s.sourceEvent,
        emotion: s.emotion,
        energy: s.energy,
        musicIntent: s.musicIntent,
        recommendedTags: s.recommendedTags ?? [],
        searchKeywords: s.searchKeywords ?? [],
        djNarration: s.djNarration,
        recommendedSongs: localSongs,
      }
      const remoteSongs = await searchQQMusicForScene(baseScene, 2)
      return {
        ...baseScene,
        recommendedSongs: remoteSongs.length >= 2
          ? remoteSongs
          : [...remoteSongs, ...localSongs.filter((song) => !remoteSongs.some((remote) => remote.title === song.title))].slice(0, 2),
      }
    }))
    return {
      id: `soundtrack_${Date.now()}`,
      title: llm.title,
      subtitle: llm.subtitle,
      date: new Date().toISOString().slice(0, 10),
      overallEmotion: llm.overallEmotion,
      moodPath: llm.moodPath?.length ? llm.moodPath : scenes.map((s) => ({ label: s.emotion, energy: s.energy })),
      scenes,
      openingNarration: llm.openingNarration,
      closingNarration: llm.closingNarration,
      shareCopy: llm.shareCopy,
      sourceText: text,
    }
  }

  // 降级
  return heuristicParse(text, pref)
}
