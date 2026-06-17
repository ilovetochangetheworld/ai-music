const BACKEND_BASE_URL = import.meta.env.VITE_BACKEND_BASE_URL as string | undefined
const SESSION_KEY = 'qq_music_session'

export interface QQMusicPlaylistSummary {
  id: string
  dirid?: number
  title: string
  subtitle: string
  description: string
  coverUrl?: string
  songCount: number
  source: 'qqmusic'
  type: string
}

interface QRCodeResponse {
  code: number
  msg: string
  data?: {
    identifier: string
    img: string
  }
}

interface QRStatusResponse {
  code: number
  msg: string
  data?: {
    event: number
    done: boolean
    identifier: string
    login_type: string
    sessionId?: string
    expiresAt?: number
  }
}

function backendUrl(path: string): string | null {
  if (!BACKEND_BASE_URL) return null
  return `${BACKEND_BASE_URL.replace(/\/$/, '')}${path}`
}

export function getQQMusicSession(): string | null {
  try {
    return localStorage.getItem(SESSION_KEY)
  } catch {
    return null
  }
}

export function clearQQMusicSession() {
  try {
    localStorage.removeItem(SESSION_KEY)
  } catch {
    // ignore
  }
}

export async function validateQQMusicSession(): Promise<boolean> {
  const session = getQQMusicSession()
  const url = backendUrl('/api/music/session/status')
  if (!url || !session) return false
  try {
    const res = await fetch(url, {
      headers: { 'X-Music-Session': session },
    })
    if (!res.ok) {
      clearQQMusicSession()
      return false
    }
    const data = await res.json()
    if (!data?.ok) clearQQMusicSession()
    return Boolean(data?.ok)
  } catch {
    return Boolean(session)
  }
}

export async function createQQMusicQRCode(type = 'qq'): Promise<QRCodeResponse | null> {
  const url = backendUrl(`/api/music/login/qrcode?type=${encodeURIComponent(type)}`)
  if (!url) return null
  const res = await fetch(url)
  if (!res.ok) return null
  return (await res.json()) as QRCodeResponse
}

export async function checkQQMusicLogin(identifier: string, type = 'qq'): Promise<QRStatusResponse | null> {
  const url = backendUrl(`/api/music/login/status?type=${encodeURIComponent(type)}&identifier=${encodeURIComponent(identifier)}`)
  if (!url) return null
  const res = await fetch(url)
  if (!res.ok) return null
  const data = (await res.json()) as QRStatusResponse
  if (data.data?.sessionId) {
    localStorage.setItem(SESSION_KEY, data.data.sessionId)
  }
  return data
}

export async function fetchQQMusicPlayUrl(
  mid: string,
  options: { mediaMid?: string; songType?: number } = {},
): Promise<string> {
  const session = getQQMusicSession()
  const params = new URLSearchParams({ mid })
  if (options.mediaMid) params.set('mediaMid', options.mediaMid)
  if (options.songType !== undefined) params.set('songType', String(options.songType))
  const url = backendUrl(`/api/music/play-url?${params.toString()}`)
  if (!url || !session) return ''
  const res = await fetch(url, {
    headers: { 'X-Music-Session': session },
  })
  if (res.status === 401) clearQQMusicSession()
  if (!res.ok) return ''
  const data = await res.json()
  return data?.playUrl || ''
}

export async function fetchQQMusicPlaylists(limit = 30): Promise<QQMusicPlaylistSummary[]> {
  const session = getQQMusicSession()
  const url = backendUrl(`/api/music/playlists?num=${limit}`)
  if (!url || !session) return []
  const res = await fetch(url, {
    headers: { 'X-Music-Session': session },
  })
  if (res.status === 401) clearQQMusicSession()
  if (!res.ok) return []
  const data = await res.json()
  return Array.isArray(data?.playlists) ? data.playlists : []
}

export async function fetchQQMusicPlaylistSongs(
  playlist: Pick<QQMusicPlaylistSummary, 'id' | 'type'>,
  limit = 80,
): Promise<{ playlist: QQMusicPlaylistSummary | null; songs: unknown[]; total: number; hasMore: boolean } | null> {
  const session = getQQMusicSession()
  const params = new URLSearchParams({
    id: playlist.id,
    type: playlist.type || '',
    num: String(limit),
  })
  const url = backendUrl(`/api/music/playlist-songs?${params.toString()}`)
  if (!url || !session) return null
  const res = await fetch(url, {
    headers: { 'X-Music-Session': session },
  })
  if (res.status === 401) clearQQMusicSession()
  if (!res.ok) return null
  return await res.json()
}
