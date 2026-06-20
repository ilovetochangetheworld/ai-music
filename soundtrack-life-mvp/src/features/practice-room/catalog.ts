import type { MetricKey, PracticeSongManifest } from '../../../shared/contracts'
import { listCustomSongs, loadCustomSong } from './customSongs'

export interface CatalogSongSummary {
  id: string
  title: string
  artist: string
  difficulty: number
  focus: MetricKey[]
  availability: 'ready' | 'preparing'
  manifestUrl?: string
}

export async function loadCatalog(): Promise<CatalogSongSummary[]> {
  const response = await fetch(`${import.meta.env.BASE_URL}catalog/index.json`)
  if (!response.ok) throw new Error('练歌曲库加载失败')
  const data = await response.json() as { songs?: CatalogSongSummary[] }
  const builtIn = Array.isArray(data.songs) ? data.songs : []
  const custom = await listCustomSongs().catch(() => [])
  return [...custom.map((song) => ({ id: song.id, title: song.manifest.title, artist: song.manifest.artist, difficulty: song.manifest.difficulty, focus: song.manifest.focus, availability: 'ready' as const })), ...builtIn]
}

export async function loadPracticeManifest(songId: string): Promise<PracticeSongManifest> {
  if (songId.startsWith('upload-')) {
    const custom = await loadCustomSong(songId)
    if (!custom) throw new Error('本地歌曲不存在或已被浏览器清理')
    return custom.manifest
  }
  const response = await fetch(`${import.meta.env.BASE_URL}catalog/${encodeURIComponent(songId)}/manifest.json`)
  if (!response.ok) throw new Error('歌曲练习资源尚未准备好')
  return await response.json() as PracticeSongManifest
}

export const metricLabels: Record<MetricKey, string> = {
  pitch: '音高',
  rhythm: '节奏',
  breath: '呼吸',
  expression: '表达',
  consistency: '稳定',
}
