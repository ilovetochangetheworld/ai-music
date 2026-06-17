import type { Song } from '../types'
import type { AiPlaylist } from '../data/aiPlaylists'
import { callLLMJson } from './llm'

const BACKEND_BASE_URL = import.meta.env.VITE_BACKEND_BASE_URL as string | undefined

export interface PlaylistTurn {
  query: string
  understood: string
}

export interface PlaylistFilterResult {
  query: string
  understood: string
  summary: string
  chips: string[]
  generatedName: string
  suggestions: string[]
  songs: Array<Song & { score: number; reason: string }>
  relaxed?: boolean
}

export interface PlaylistChatResult {
  kind: 'answer'
  query: string
  answer: string
  suggestions: string[]
  referencedSongIds: string[]
}

export type PlaylistConversationResult =
  | { kind: 'filter'; result: PlaylistFilterResult }
  | { kind: 'answer'; result: PlaylistChatResult }

interface ServerFilterResult {
  understood?: string
  summary?: string
  chips?: string[]
  generatedName?: string
  suggestions?: string[]
  results?: Array<{ id: string; score?: number; reason?: string }>
  relaxed?: boolean
}

const keywordMap: Record<string, string[]> = {
  cantonese: ['粤语', '港乐', '广东'],
  mandarin: ['国语', '华语', '中文'],
  english: ['英文', '英语'],
  fast: ['快歌', '快一点', '节奏快', '轻快', '跑步', '热身'],
  slow: ['慢歌', '慢一点', '安静', '睡前', '舒缓'],
  driving: ['开车', '驾驶', '夜路', '公路'],
  night: ['深夜', '晚上', '夜晚', '一个人', '独处'],
  commute: ['通勤', '上班', '路上'],
  cooking: ['做饭', '周末'],
  party: ['聚会', '合唱', '大家都会唱'],
  sad: ['伤感', '难过', '失恋'],
  warm: ['治愈', '温柔', '暖', '舒服'],
  energetic: ['燃', '炸', '热血', '高能'],
  female: ['女歌手', '女声'],
  recentAvoid: ['最近没听过', '很久没听', '冷门', '宝藏'],
  liveAvoid: ['不要现场', '排除现场', '非现场'],
  englishAvoid: ['不要英文', '排除英文'],
  instrumentalAvoid: ['不要纯音乐', '不要伴奏'],
}

function backendUrl(path: string): string | null {
  if (!BACKEND_BASE_URL) return null
  return `${BACKEND_BASE_URL.replace(/\/$/, '')}${path}`
}

export async function filterPlaylist(
  playlist: AiPlaylist,
  query: string,
  history: PlaylistTurn[] = [],
): Promise<PlaylistFilterResult> {
  const remote = await requestServerFilter(playlist, query, history)
  if (remote) return remote
  return localFilterPlaylist(playlist, query, history)
}

export async function converseWithPlaylist(
  playlist: AiPlaylist,
  query: string,
  history: PlaylistTurn[] = [],
): Promise<PlaylistConversationResult> {
  const remote = await requestConversation(playlist, query, history)
  if (remote?.kind === 'answer') return { kind: 'answer', result: remote }
  if (remote?.kind === 'filter') {
    const filtered = await filterPlaylist(playlist, remote.rewrittenQuery || query, history)
    return { kind: 'filter', result: filtered }
  }

  if (looksLikeQuestion(query)) {
    return { kind: 'answer', result: localAnswerPlaylistQuestion(playlist, query) }
  }
  return { kind: 'filter', result: await filterPlaylist(playlist, query, history) }
}

async function requestConversation(
  playlist: AiPlaylist,
  query: string,
  history: PlaylistTurn[],
): Promise<({ kind: 'answer' } & PlaylistChatResult) | { kind: 'filter'; rewrittenQuery?: string } | null> {
  const songs = playlist.songs.slice(0, 120).map((song) => ({
    id: song.id,
    title: song.title,
    artist: song.artist,
    album: song.album,
    language: song.language,
    releaseYear: song.releaseYear,
    genre: song.genre,
    mood: song.mood,
    scene: song.scene,
    energy: song.energy,
    bpm: song.bpm,
    tags: song.tags,
    semanticDescription: song.semanticDescription,
  }))

  return await callLLMJson<({ kind: 'answer' } & PlaylistChatResult) | { kind: 'filter'; rewrittenQuery?: string }>(
    `你是 QQ 音乐的 AI音乐管家。用户会围绕“当前歌单”与你多轮对话。
你有两种动作：
1. answer: 回答关于歌曲、风格、歌手、某首歌类型、适合场景的问题，帮助用户澄清想听什么。
2. filter: 当用户明确想“找/筛/播放/来一些/换一批/更轻快”等时，进入歌单筛选。
只能基于提供的当前歌单信息回答；不确定就说明信息有限。
返回严格 JSON：
{
  "kind": "answer" | "filter",
  "answer": "kind=answer 时的简洁回答",
  "referencedSongIds": ["提到的歌曲id"],
  "suggestions": ["下一步建议"],
  "rewrittenQuery": "kind=filter 时，结合上下文改写后的筛选请求"
}`,
    JSON.stringify({
      playlist: { id: playlist.id, title: playlist.title },
      history,
      query,
      songs,
    }),
    18000,
  )
}

async function requestServerFilter(
  playlist: AiPlaylist,
  query: string,
  history: PlaylistTurn[],
): Promise<PlaylistFilterResult | null> {
  const url = backendUrl('/api/playlist/filter')
  if (!url) return null
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ playlist, query, history }),
    })
    if (!res.ok) return null
    const data = (await res.json()) as ServerFilterResult
    const byId = new Map(playlist.songs.map((song) => [song.id, song]))
    const songs = (data.results ?? [])
      .map((item, index) => {
        const song = byId.get(item.id)
        if (!song) return null
        return {
          ...song,
          score: Math.round(item.score ?? 100 - index * 4),
          reason: item.reason || song.reasonSeeds[0] || '符合这次筛选条件。',
        }
      })
      .filter(Boolean) as PlaylistFilterResult['songs']

    if (!songs.length) return null

    return {
      query,
      understood: data.understood || `我理解你想从「${playlist.title}」里找：${query}`,
      summary: data.summary || `从「${playlist.title}」中筛出了 ${songs.length} 首歌。`,
      chips: data.chips?.length ? data.chips : inferChips(query),
      generatedName: data.generatedName || nameFromQuery(query),
      suggestions: data.suggestions?.length ? data.suggestions : defaultSuggestions(query),
      songs,
      relaxed: data.relaxed,
    }
  } catch {
    return null
  }
}

export function localFilterPlaylist(
  playlist: AiPlaylist,
  query: string,
  history: PlaylistTurn[] = [],
): PlaylistFilterResult {
  const combined = [...history.map((item) => item.query), query].join('，')
  const wanted = inferTokens(combined)
  const limit = inferLimit(combined)
  const scored = playlist.songs.map((song) => {
    const { score, reasons } = scoreSong(song, wanted, combined)
    return {
      ...song,
      score,
      reason: reasons[0] || song.reasonSeeds[0] || '整体气质符合这次描述。',
    }
  })

  const hardFiltered = scored
    .filter((song) => hardPass(song, wanted, combined))
    .sort((a, b) => b.score - a.score || (a.lastPlayedAt || '').localeCompare(b.lastPlayedAt || ''))

  const relaxed = hardFiltered.length < Math.min(5, limit)
  const pool = relaxed ? scored.sort((a, b) => b.score - a.score) : hardFiltered
  const songs = diversifyArtists(pool, limit)
  const chips = inferChips(combined)

  return {
    query,
    understood: `我理解你想从「${playlist.title}」里找：${chips.join(' · ') || query}`,
    summary: relaxed
      ? `严格匹配的歌曲不多，我先放宽部分模糊条件，给你挑了 ${songs.length} 首更接近的歌。`
      : `我从「${playlist.title}」中找到了 ${songs.length} 首歌，按语义相关度和播放顺序重新排好了。`,
    chips,
    generatedName: nameFromQuery(combined),
    suggestions: defaultSuggestions(combined),
    songs,
    relaxed,
  }
}

function inferTokens(query: string): Set<string> {
  const tokens = new Set<string>()
  for (const [token, words] of Object.entries(keywordMap)) {
    if (words.some((word) => query.includes(word))) tokens.add(token)
  }
  if (/90|九十|199/.test(query)) tokens.add('nineties')
  if (/周杰伦|杰伦/.test(query)) tokens.add('jay')
  if (/陈奕迅|eason/i.test(query)) tokens.add('eason')
  if (/七里香/.test(query)) tokens.add('qilixiang')
  if (/不要太吵|别太吵|不吵|不过度刺激/.test(query)) tokens.add('mediumEnergy')
  if (/再轻快|轻快一点/.test(query)) tokens.add('lighter')
  if (/换一批|换些|重新/.test(query)) tokens.add('shuffle')
  return tokens
}

function looksLikeQuestion(query: string): boolean {
  return /什么|为何|为什么|吗|呢|介绍|解释|类型|风格|适合|属于|类似|怎么样|\?/.test(query)
    && !/找|筛|播放|来一些|来点|换一批|只听|不要|更|再/.test(query)
}

function localAnswerPlaylistQuestion(playlist: AiPlaylist, query: string): PlaylistChatResult {
  const mentioned = findMentionedSongs(playlist.songs, query)
  const song = mentioned[0]
  if (song) {
    const style = [
      song.genre?.join(' / '),
      song.tags?.slice(0, 3).join(' / '),
    ].filter(Boolean).join('，') || '偏流行语境'
    const energyText = song.energy >= 75 ? '能量偏高' : song.energy <= 40 ? '能量偏低' : '能量适中'
    const tempoText = song.bpm >= 115 ? '节奏偏快' : song.bpm > 0 && song.bpm <= 82 ? '节奏偏慢' : '节奏稳定'
    return {
      kind: 'answer',
      query,
      answer: `《${song.title}》在当前歌单里更接近「${style}」这一类。${song.bpm ? `它大约 ${song.bpm} BPM，` : ''}${tempoText}，${energyText}。${song.semanticDescription || '如果你喜欢这种感觉，可以继续让我找类似但更轻快、安静或更有节奏感的歌。'}`,
      referencedSongIds: [song.id],
      suggestions: [
        `找几首类似《${song.title}》的`,
        `类似《${song.title}》但更轻快一点`,
        `播放这种风格`,
      ],
    }
  }

  return {
    kind: 'answer',
    query,
    answer: `我可以先帮你理解当前歌单里的歌曲风格，也可以在多轮对话后再筛选播放。你可以问“某首歌是什么类型”，也可以说“这种感觉再轻快一点，帮我播放”。`,
    referencedSongIds: [],
    suggestions: ['解释这首歌的风格', '找类似但不太吵的', '适合晚上开车的歌'],
  }
}

function findMentionedSongs(songs: Song[], query: string): Song[] {
  const compactQuery = query.replace(/\s+/g, '').toLowerCase()
  return songs.filter((song) => {
    const title = song.title.replace(/\s+/g, '').toLowerCase()
    return title && compactQuery.includes(title)
  })
}

function hardPass(song: Song, tokens: Set<string>, query: string): boolean {
  if (tokens.has('cantonese') && song.language !== 'cantonese') return false
  if (tokens.has('mandarin') && song.language !== 'mandarin') return false
  if (tokens.has('english') && song.language !== 'english') return false
  if (tokens.has('englishAvoid') && song.language === 'english') return false
  if (tokens.has('instrumentalAvoid') && song.language === 'instrumental') return false
  if (tokens.has('liveAvoid') && song.version === 'live') return false
  if (tokens.has('female') && !['莫文蔚', '杨千嬅', '王菲', '陈珊妮'].some((name) => song.artist.includes(name))) return false
  if (tokens.has('jay') && !song.artist.includes('周杰伦')) return false
  if (tokens.has('eason') && !song.artist.includes('陈奕迅')) return false
  if (tokens.has('nineties') && !(song.releaseYear && song.releaseYear >= 1990 && song.releaseYear <= 1999)) return false
  if (/不要说唱|排除说唱/.test(query) && song.genre?.some((genre) => ['hip-hop', 'rap'].includes(genre))) return false
  return true
}

function scoreSong(song: Song, tokens: Set<string>, query: string): { score: number; reasons: string[] } {
  let score = 40
  const reasons: string[] = []
  const text = [
    song.title,
    song.artist,
    song.album,
    song.language,
    ...(song.genre ?? []),
    ...song.mood,
    ...song.scene,
    ...song.tags,
    song.semanticDescription,
  ].join(' ').toLowerCase()

  for (const word of query.toLowerCase().split(/[，,\s]+/)) {
    if (word && text.includes(word)) score += 4
  }

  add(tokens.has('fast') && (song.bpm >= 105 || song.energy >= 70), 16, '节奏和能量更接近快歌需求。')
  add(tokens.has('slow') && (song.bpm <= 82 || song.energy <= 42), 16, '节奏偏慢，适合安静收束。')
  add(tokens.has('mediumEnergy') && song.energy >= 38 && song.energy <= 70, 14, '能量适中，有氛围但不会太吵。')
  add(tokens.has('driving') && (song.scene.includes('driving') || song.scene.includes('road')), 18, '带有驾驶或公路场景感。')
  add(tokens.has('night') && (song.scene.includes('night') || song.mood.includes('night')), 14, '夜晚氛围明显。')
  add(tokens.has('commute') && song.scene.includes('commute'), 14, '适合通勤路上的稳定节奏。')
  add(tokens.has('cooking') && song.scene.includes('cooking'), 14, '轻松不抢戏，适合做饭当背景。')
  add(tokens.has('party') && (song.scene.includes('party') || song.tags.includes('合唱')), 14, '适合聚会或一起跟唱。')
  add(tokens.has('sad') && (song.mood.includes('sad') || song.mood.includes('bittersweet')), 14, '有伤感底色。')
  add(tokens.has('warm') && (song.mood.includes('warm') || song.mood.includes('soft') || song.tags.includes('治愈')), 14, '气质温柔，有治愈感。')
  add(tokens.has('energetic') && song.energy >= 75, 14, '能量更高，适合提神。')
  add(tokens.has('recentAvoid') && isOldPlay(song.lastPlayedAt), 16, '最近较少播放，适合重新发现。')
  add(tokens.has('qilixiang') && (song.mood.includes('romantic') || song.tags.includes('清新') || Boolean(song.genre?.includes('chinese-style'))), 16, '和《七里香》一样偏清新、抒情或有画面感。')
  add(tokens.has('lighter') && song.energy >= 55 && song.energy <= 78, 12, '比上一轮更轻快，但没有过度刺激。')

  if (tokens.has('shuffle')) score += Math.max(0, 20 - (song.playCount ?? 0) / 5)
  score += Math.min(10, (song.playCount ?? 0) / 12)

  return { score: Math.max(0, Math.min(100, Math.round(score))), reasons }

  function add(condition: boolean, points: number, reason: string) {
    if (!condition) return
    score += points
    reasons.push(reason)
  }
}

function diversifyArtists<T extends Song & { score: number }>(songs: T[], limit: number): T[] {
  const picked: T[] = []
  const artistCount = new Map<string, number>()
  for (const song of songs) {
    const count = artistCount.get(song.artist) ?? 0
    if (count >= 3 && songs.length > limit) continue
    picked.push(song)
    artistCount.set(song.artist, count + 1)
    if (picked.length >= limit) break
  }
  return picked
}

function inferLimit(query: string): number {
  const match = query.match(/(\d+)\s*首/)
  if (match) return Math.max(3, Math.min(30, Number(match[1])))
  if (/一小时|1小时|60分钟/.test(query)) return 15
  if (/半小时|30分钟/.test(query)) return 8
  return 12
}

function inferChips(query: string): string[] {
  const chips: string[] = []
  if (/粤语/.test(query)) chips.push('粤语')
  if (/国语|华语/.test(query)) chips.push('华语')
  if (/快|节奏|轻快|跑步/.test(query)) chips.push('节奏感')
  if (/开车|驾驶|公路/.test(query)) chips.push('驾驶场景')
  if (/深夜|夜晚|晚上/.test(query)) chips.push('夜晚氛围')
  if (/伤感|难过/.test(query)) chips.push('伤感克制')
  if (/不要太吵|不吵/.test(query)) chips.push('能量适中')
  if (/最近没听|很久没听|冷门/.test(query)) chips.push('重新发现')
  if (/女歌手|女声/.test(query)) chips.push('女声')
  if (/90|九十/.test(query)) chips.push('90年代')
  if (!chips.length) chips.push('语义匹配')
  return chips.slice(0, 5)
}

function nameFromQuery(query: string): string {
  if (/开车|驾驶/.test(query)) return '今晚开车听'
  if (/通勤/.test(query)) return '今日通勤精选'
  if (/粤语/.test(query) && /快/.test(query)) return '粤语快歌精选'
  if (/深夜|夜晚/.test(query)) return '深夜不打烊'
  if (/最近没听|冷门|宝藏/.test(query)) return '被我忘记的宝藏'
  return 'AI 为我选的歌'
}

function defaultSuggestions(query: string): string[] {
  if (/快|燃|炸/.test(query)) return ['再轻快一点', '不要太吵', '换一批']
  if (/深夜|睡前|伤感/.test(query)) return ['再轻一点', '不要太压抑', '只保留前10首']
  return ['再轻快一点', '不要英文歌', '换一批']
}

function isOldPlay(lastPlayedAt?: string): boolean {
  if (!lastPlayedAt) return true
  return new Date(lastPlayedAt).getTime() < new Date('2026-03-17T00:00:00+08:00').getTime()
}
