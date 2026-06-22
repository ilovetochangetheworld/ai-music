import type { Song } from '../types'
import songsData from '../data/songs.json'

export const ALL_SONGS = songsData as Song[]

export interface MatchContext {
  scene: string[]
  mood: string[]
  energy: number
  languages?: string[]
}

/**
 * 纯本地规则匹配（无需 LLM）。旧 Lab 优先级见 docs/archive/life-soundtrack/technical-design.md：
 * 1. scene 命中  2. mood 命中  3. energy 距离最小  4. 用户语言偏好加权  5. 避免同歌手连续出现
 */
export function matchSongs(
  ctx: MatchContext,
  limit = 3,
  excludeIds: string[] = [],
): Song[] {
  const scored = ALL_SONGS
    .filter((s) => !excludeIds.includes(s.id))
    .map((song) => {
      let score = 0
      const sceneHits = song.scene.filter((s) => ctx.scene.includes(s)).length
      const moodHits = song.mood.filter((m) => ctx.mood.includes(m)).length
      score += sceneHits * 100
      score += moodHits * 40
      // energy 越接近越好（最多 -30）
      score += Math.max(0, 30 - Math.abs(song.energy - ctx.energy) * 0.6)
      // 语言偏好加权
      if (ctx.languages?.length && ctx.languages.includes(song.language)) score += 18
      return { song, score }
    })
    .sort((a, b) => b.score - a.score)

  // 避免同一歌手连续出现
  const picked: Song[] = []
  const usedArtists = new Set<string>()
  for (const { song } of scored) {
    if (picked.length >= limit) break
    if (usedArtists.has(song.artist) && scored.length > limit) continue
    picked.push(song)
    usedArtists.add(song.artist)
  }
  // 数量不足时放宽歌手限制补齐
  if (picked.length < limit) {
    for (const { song } of scored) {
      if (picked.length >= limit) break
      if (!picked.find((p) => p.id === song.id)) picked.push(song)
    }
  }
  return picked
}
