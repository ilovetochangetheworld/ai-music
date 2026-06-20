import { DEFAULT_ROOM_SETTINGS, type SingRoomSettings, type SongManifest, type SongTimeline } from './types'
import { loadPracticeManifest } from '../practice-room/catalog'
import { loadCustomSong } from '../practice-room/customSongs'

const SETTINGS_KEY = 'sing-room-settings'

export function saveSettings(settings: SingRoomSettings): void {
  sessionStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
}

export function loadSettings(): SingRoomSettings {
  try {
    const saved = sessionStorage.getItem(SETTINGS_KEY)
    return saved ? { ...DEFAULT_ROOM_SETTINGS, ...JSON.parse(saved) } : DEFAULT_ROOM_SETTINGS
  } catch {
    return DEFAULT_ROOM_SETTINGS
  }
}

export async function loadPracticeSong(songId = 'trajectory'): Promise<{ manifest: SongManifest; timeline: SongTimeline }> {
  if (songId.startsWith('upload-')) {
    const custom = await loadCustomSong(songId)
    if (!custom) throw new Error('本地歌曲不存在或已被浏览器清理')
    const audioUrl = URL.createObjectURL(custom.audio)
    const silentUrl = URL.createObjectURL(custom.silentTrack)
    return {
      manifest: {
        songId: custom.id, title: custom.manifest.title, artist: custom.manifest.artist, duration: custom.manifest.durationSec,
        assets: { accompaniment: audioUrl, rescueLead: silentUrl, harmony: silentUrl },
        mix: { accompanimentGain: .76, rescueGain: 0, harmonyGain: 0 },
      },
      timeline: custom.timeline,
    }
  }
  const base = import.meta.env.BASE_URL
  const practiceManifest = await loadPracticeManifest(songId)
  const timelineResponse = await fetch(`${base}${practiceManifest.assets.timeline}`)
  if (!timelineResponse.ok) throw new Error('歌曲时间轴加载失败')
  const timeline = await timelineResponse.json() as SongTimeline
  if (!practiceManifest.assets.rescueLead || !practiceManifest.assets.harmony) throw new Error('当前歌曲缺少陪练音轨')
  const manifest: SongManifest = {
    songId: practiceManifest.id,
    title: practiceManifest.title,
    artist: practiceManifest.artist,
    duration: practiceManifest.durationSec,
    assets: {
      accompaniment: `${base}${practiceManifest.assets.accompaniment}`,
      rescueLead: `${base}${practiceManifest.assets.rescueLead}`,
      harmony: `${base}${practiceManifest.assets.harmony}`,
    },
    mix: { accompanimentGain: .82, rescueGain: .66, harmonyGain: .55 },
  }
  return { manifest, timeline }
}

export const loadTrajectory = () => loadPracticeSong('trajectory')

export function formatTime(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds))
  return `${Math.floor(safe / 60)}:${String(safe % 60).padStart(2, '0')}`
}
