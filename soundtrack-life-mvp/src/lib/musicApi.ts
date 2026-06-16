import type { LifeScene, Song } from '../types'

const BACKEND_BASE_URL = import.meta.env.VITE_BACKEND_BASE_URL as string | undefined

interface RemoteSong {
  id?: string | number
  mid?: string
  mediaMid?: string
  songType?: number
  title?: string
  name?: string
  artist?: string
  singer?: string
  album?: string
  coverUrl?: string
  playUrl?: string
  detailUrl?: string
}

function backendUrl(path: string): string | null {
  if (!BACKEND_BASE_URL) return null
  return `${BACKEND_BASE_URL.replace(/\/$/, '')}${path}`
}

function normalizeRemoteSong(raw: RemoteSong, scene: LifeScene, index: number): Song | null {
  const title = raw.title ?? raw.name
  const artist = raw.artist ?? raw.singer
  if (!title || !artist) return null
  return {
    id: `qq_${raw.mid ?? raw.id ?? `${scene.id}_${index}`}`,
    mid: raw.mid,
    mediaMid: raw.mediaMid,
    songType: raw.songType,
    title,
    artist,
    album: raw.album,
    coverUrl: raw.coverUrl,
    playUrl: raw.playUrl,
    detailUrl: raw.detailUrl,
    source: 'qqmusic',
    language: 'mandarin',
    mood: scene.recommendedTags,
    scene: [scene.timeOfDay, ...scene.recommendedTags],
    energy: scene.energy,
    bpm: 0,
    tags: scene.recommendedTags,
    reasonSeeds: [
      `来自 QQ 音乐搜索，匹配「${scene.emotion}」和「${scene.musicIntent}」这一段。`,
    ],
  }
}

function dedupeKey(song: Song): string {
  return song.title
    .replace(/\s+/g, '')
    .replace(/[（(].*?[）)]/g, '')
    .toLowerCase()
}

export async function searchQQMusic(keyword: string, scene: LifeScene, limit = 3): Promise<Song[]> {
  const url = backendUrl(`/api/music/search?keyword=${encodeURIComponent(keyword)}&num=${limit}`)
  if (!url) return []

  try {
    const res = await fetch(url)
    if (!res.ok) return []
    const data = await res.json()
    const songs = Array.isArray(data?.songs) ? data.songs : []
    return songs
      .map((song: RemoteSong, index: number) => normalizeRemoteSong(song, scene, index))
      .filter(Boolean)
      .slice(0, limit) as Song[]
  } catch {
    return []
  }
}

export async function searchQQMusicForScene(scene: LifeScene, limit = 2): Promise<Song[]> {
  const keywords = Array.from(new Set([
    ...(scene.searchKeywords ?? []),
    ...sceneSearchKeywords(scene),
  ].map((kw) => kw.trim()).filter(Boolean))).slice(0, 5)

  const picked: Song[] = []
  const usedTitles = new Set<string>()

  for (const keyword of keywords) {
    if (picked.length >= limit) break
    const candidates = await searchQQMusic(keyword, scene, Math.max(4, limit))
    for (const song of candidates) {
      const key = dedupeKey(song)
      if (usedTitles.has(key)) continue
      picked.push(song)
      usedTitles.add(key)
      break
    }
  }

  return picked.slice(0, limit)
}

export function sceneSearchKeywords(scene: LifeScene): string[] {
  const tags = scene.recommendedTags.join(' ')
  const fallback = [
    scene.sourceEvent,
    `${scene.emotion} ${scene.timeOfDay}`,
    tags,
  ]
  return fallback.map((kw) => kw.trim()).filter(Boolean)
}
