import { DEFAULT_ROOM_SETTINGS, type SingRoomSettings, type SongManifest, type SongTimeline } from './types'

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

export async function loadTrajectory(): Promise<{ manifest: SongManifest; timeline: SongTimeline }> {
  const base = import.meta.env.BASE_URL
  const root = `${base}audio/trajectory/`
  const [manifestResponse, timelineResponse] = await Promise.all([
    fetch(`${root}manifest.json`),
    fetch(`${root}timeline.json`),
  ])
  if (!manifestResponse.ok || !timelineResponse.ok) throw new Error('《轨迹》时间轴加载失败')
  const manifest = await manifestResponse.json() as SongManifest
  const timeline = await timelineResponse.json() as SongTimeline
  manifest.assets = {
    accompaniment: `${root}${manifest.assets.accompaniment}`,
    rescueLead: `${root}${manifest.assets.rescueLead}`,
    harmony: `${root}${manifest.assets.harmony}`,
  }
  return { manifest, timeline }
}

export function formatTime(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds))
  return `${Math.floor(safe / 60)}:${String(safe % 60).padStart(2, '0')}`
}
