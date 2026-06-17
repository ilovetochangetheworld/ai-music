import http from 'node:http'
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { URL } from 'node:url'

function loadEnv(file) {
  if (!fs.existsSync(file)) return {}
  const env = {}
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const idx = trimmed.indexOf('=')
    if (idx < 0) continue
    env[trimmed.slice(0, idx).trim()] = trimmed.slice(idx + 1).trim().replace(/^['"]|['"]$/g, '')
  }
  return env
}

const env = { ...loadEnv(path.resolve('.env')), ...process.env }
const PORT = Number(env.PORT || 8787)
const LLM_BASE_URL = env.LLM_BASE_URL || env.VITE_LLM_BASE_URL
const LLM_API_KEY = env.LLM_API_KEY || env.VITE_LLM_API_KEY
const LLM_MODEL = env.LLM_MODEL || env.VITE_LLM_MODEL || 'hy3-preview'
const QQ_MUSIC_API_BASE_URL = env.QQ_MUSIC_API_BASE_URL
const MUSIC_SESSION_TTL_MS = Number(env.MUSIC_SESSION_TTL_MS || 12 * 60 * 60 * 1000)
const SESSION_FILE = env.MUSIC_SESSION_FILE || path.resolve('data/music-sessions.json')
const QQ_MUSIC_TIMEOUT_MS = Number(env.QQ_MUSIC_TIMEOUT_MS || 8000)
const musicSessions = new Map()

function loadMusicSessions() {
  try {
    if (!fs.existsSync(SESSION_FILE)) return
    const entries = JSON.parse(fs.readFileSync(SESSION_FILE, 'utf8'))
    for (const [sessionId, session] of Object.entries(entries)) {
      if (session?.expiresAt > Date.now()) musicSessions.set(sessionId, session)
    }
  } catch {
    // ignore invalid session cache
  }
}

function persistMusicSessions() {
  try {
    fs.mkdirSync(path.dirname(SESSION_FILE), { recursive: true })
    fs.writeFileSync(SESSION_FILE, JSON.stringify(Object.fromEntries(musicSessions), null, 2))
  } catch {
    // ignore persistence errors; login still works for current process
  }
}

loadMusicSessions()

function json(res, status, data) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': env.CORS_ORIGIN || '*',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Music-Session',
  })
  res.end(JSON.stringify(data))
}

function qqmusicUrl(pathname) {
  if (!QQ_MUSIC_API_BASE_URL) throw new Error('Missing QQ_MUSIC_API_BASE_URL.')
  return `${QQ_MUSIC_API_BASE_URL.replace(/\/$/, '')}${pathname}`
}

async function qqmusicJson(pathname, init = {}) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), QQ_MUSIC_TIMEOUT_MS)
  try {
    const res = await fetch(qqmusicUrl(pathname), {
      ...init,
      signal: controller.signal,
    })
    const data = await res.json()
    if (data?.code !== undefined && data.code !== 0) throw new Error(data?.msg || 'QQMusicApi failed.')
    return data
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error(`QQMusicApi timed out after ${QQ_MUSIC_TIMEOUT_MS}ms.`)
    }
    throw err
  } finally {
    clearTimeout(timer)
  }
}

function storeMusicSession(credential) {
  const sessionId = crypto.randomUUID()
  musicSessions.set(sessionId, {
    credential,
    expiresAt: Date.now() + MUSIC_SESSION_TTL_MS,
  })
  persistMusicSessions()
  return sessionId
}

function getMusicSession(req) {
  const sessionId = req.headers['x-music-session']
  if (!sessionId || Array.isArray(sessionId)) return null
  const session = musicSessions.get(sessionId)
  if (!session) return null
  if (session.expiresAt < Date.now()) {
    musicSessions.delete(sessionId)
    persistMusicSessions()
    return null
  }
  return session
}

function credentialCookie(credential) {
  const pairs = {
    musicid: credential.musicid,
    musickey: credential.musickey,
    openid: credential.openid,
    refresh_token: credential.refresh_token,
    access_token: credential.access_token,
    expired_at: credential.expired_at,
    unionid: credential.unionid,
    str_musicid: credential.str_musicid || credential.musicid,
    refresh_key: credential.refresh_key,
  }
  return Object.entries(pairs)
    .filter(([, value]) => value !== undefined && value !== null && value !== '')
    .map(([key, value]) => `${key}=${encodeURIComponent(String(value))}`)
    .join('; ')
}

function getCredentialUin(credential) {
  return Number(credential?.musicid || credential?.uin || credential?.str_musicid || 0)
}

function getCredentialEuin(credential) {
  return credential?.encryptUin || credential?.euin || credential?.str_musicid || String(getCredentialUin(credential) || '')
}

function withCredential(session) {
  if (!session?.credential) throw new Error('QQ Music login required.')
  return {
    headers: {
      Cookie: credentialCookie(session.credential),
    },
  }
}

function pickList(...values) {
  for (const value of values) {
    if (Array.isArray(value)) return value
  }
  return []
}

function normalizeQQPlaylist(raw, type = 'created') {
  const id = raw?.id || raw?.tid || raw?.dissid
  const title = cleanText(raw?.title || raw?.name || raw?.dirName || raw?.dissname)
  if (!id || !title) return null
  const songCount = raw?.songnum || raw?.songNum || raw?.song_cnt || 0
  return {
    id: String(id),
    dirid: raw?.dirid || raw?.dirId || 0,
    title,
    subtitle: `${songCount} 首 · QQ 音乐${type === 'favorite' ? '收藏歌单' : type === 'liked' ? '我喜欢' : '创建歌单'}`,
    description: cleanText(raw?.desc || raw?.description || `${title} 中的 QQ 音乐歌曲，可用于 AI 语义筛选。`),
    coverUrl: raw?.picurl || raw?.picUrl || raw?.cover || raw?.logo || raw?.bigpicUrl || raw?.albumPicUrl,
    songCount,
    source: 'qqmusic',
    type,
  }
}

function normalizePlayUrl(url) {
  if (!url) return ''
  const text = String(url)
  if (/^https?:\/\//i.test(text)) return text
  return `https://ws.stream.qqmusic.qq.com/${text}`
}

async function readJson(req) {
  const chunks = []
  for await (const chunk of req) chunks.push(chunk)
  const raw = Buffer.concat(chunks).toString('utf8')
  return raw ? JSON.parse(raw) : {}
}

function compactPlaylistSongs(songs = []) {
  return songs.slice(0, 300).map((song) => ({
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
    version: song.version,
    semanticDescription: song.semanticDescription,
    playCount: song.playCount,
    lastPlayedAt: song.lastPlayedAt,
  }))
}

async function filterPlaylistWithLLM({ playlist, query, history = [] }) {
  const songs = compactPlaylistSongs(playlist?.songs)
  if (!playlist?.title || !query || !songs.length) throw new Error('Missing playlist, query, or songs.')

  const system = `你是 QQ 音乐里的 AI音乐管家，负责在“当前歌单范围内”根据用户自然语言需求筛选歌曲。
只能选择输入列表里存在的歌曲 id，不能推荐歌单外歌曲，不能虚构歌曲信息。
你需要理解语言、歌手、年代、情绪、场景、节奏、能量、版本、排除条件、数量、参考歌曲和多轮调整。
如果条件过严，可以适度放宽模糊条件，但必须在 relaxed 标记说明。
返回严格 JSON，不要 Markdown。结构：
{
  "understood": "一句话说明你理解到的需求",
  "summary": "一句话说明筛选结果",
  "chips": ["条件标签"],
  "generatedName": "适合保存的新歌单名称",
  "suggestions": ["再轻快一点", "换一批"],
  "relaxed": false,
  "results": [
    { "id": "歌曲id", "score": 0-100, "reason": "简短匹配理由" }
  ]
}`

  const user = JSON.stringify({
    playlist: {
      id: playlist.id,
      title: playlist.title,
      subtitle: playlist.subtitle,
      description: playlist.description,
    },
    history,
    query,
    songs,
  })

  const data = await requestLLM({ system, user, withJsonMode: true })
  const allowed = new Set(songs.map((song) => song.id))
  const limit = Math.max(3, Math.min(30, Number(String(query).match(/(\d+)\s*首/)?.[1] || 12)))
  return {
    understood: data?.understood || `我理解你想从「${playlist.title}」中筛选：${query}`,
    summary: data?.summary || `已从当前歌单中筛出 ${Math.min(limit, songs.length)} 首歌。`,
    chips: Array.isArray(data?.chips) ? data.chips.slice(0, 6) : [],
    generatedName: data?.generatedName || 'AI 为我选的歌',
    suggestions: Array.isArray(data?.suggestions) ? data.suggestions.slice(0, 4) : ['再轻快一点', '换一批'],
    relaxed: Boolean(data?.relaxed),
    results: Array.isArray(data?.results)
      ? data.results
        .filter((item) => allowed.has(item?.id))
        .slice(0, limit)
        .map((item, index) => ({
          id: item.id,
          score: Number(item.score ?? 100 - index * 4),
          reason: String(item.reason || '符合这次筛选条件。').slice(0, 80),
        }))
      : [],
  }
}

function chatCompletionsUrl(baseUrl) {
  const clean = baseUrl.replace(/\/$/, '')
  return clean.endsWith('/chat/completions') ? clean : `${clean}/chat/completions`
}

function parseJsonContent(content) {
  const trimmed = content.trim()
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i)
  const raw = fenced?.[1]?.trim() ?? trimmed
  try {
    return JSON.parse(raw)
  } catch {
    const start = raw.indexOf('{')
    const end = raw.lastIndexOf('}')
    if (start >= 0 && end > start) return JSON.parse(raw.slice(start, end + 1))
    throw new Error('Model response is not parseable JSON.')
  }
}

async function requestLLM({ system, user, withJsonMode }) {
  if (!LLM_BASE_URL || !LLM_API_KEY) throw new Error('Missing LLM_BASE_URL or LLM_API_KEY.')
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), Number(env.LLM_TIMEOUT_MS || 30000))
  try {
    const res = await fetch(chatCompletionsUrl(LLM_BASE_URL), {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${LLM_API_KEY}`,
      },
      body: JSON.stringify({
        model: LLM_MODEL,
        temperature: 0.7,
        ...(withJsonMode ? { response_format: { type: 'json_object' } } : {}),
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
      }),
    })
    const text = await res.text()
    if (!res.ok) throw new Error(`LLM HTTP ${res.status}: ${text.slice(0, 240)}`)
    const data = JSON.parse(text)
    const content = data?.choices?.[0]?.message?.content
    if (!content) throw new Error('No model content returned.')
    return parseJsonContent(content)
  } finally {
    clearTimeout(timer)
  }
}

function normalizeSinger(input) {
  if (typeof input === 'string') return input
  if (Array.isArray(input)) return input.map((s) => s?.name || s?.title).filter(Boolean).join(' / ')
  return input?.name || input?.title || ''
}

function cleanText(input) {
  return String(input || '').replace(/<[^>]+>/g, '').trim()
}

function pickSongList(data) {
  if (Array.isArray(data?.song)) return data.song
  if (Array.isArray(data?.songs)) return data.songs
  if (Array.isArray(data?.list)) return data.list
  if (Array.isArray(data?.songlist)) return data.songlist
  if (Array.isArray(data?.data?.songlist)) return data.data.songlist
  if (Array.isArray(data?.data?.song)) return data.data.song
  if (Array.isArray(data?.data?.list)) return data.data.list
  return []
}

function inferLanguage(raw, title, artist) {
  const text = `${title} ${artist}`
  if (/^[\w\s&.'’/-]+$/.test(text) && /[a-z]/i.test(text)) return 'english'
  if (raw?.language === 'english') return 'english'
  if (raw?.language === 'instrumental') return 'instrumental'
  return 'mandarin'
}

function releaseYearFromSong(raw) {
  const date = raw?.time_public || raw?.publish_date || raw?.publishDate || raw?.album?.time_public
  const year = Number(String(date || '').slice(0, 4))
  return Number.isFinite(year) && year > 1900 ? year : undefined
}

function normalizeQQSong(raw) {
  const item = raw?.song || raw
  const mid = item.mid || item.songmid || item.song_mid
  const title = cleanText(item.title || item.name || item.songname)
  const artist = cleanText(normalizeSinger(item.singer || item.singers))
  const album = cleanText(item.album?.title || item.album?.name || item.albumname)
  const bpm = Number(item.bpm || 0)
  const releaseYear = releaseYearFromSong(item)
  const language = inferLanguage(item, title, artist)
  const energy = bpm >= 125 ? 82 : bpm >= 105 ? 68 : bpm > 0 && bpm <= 80 ? 36 : 55
  const tags = [
    language === 'english' ? '英文' : '华语',
    bpm >= 115 ? '快歌' : bpm > 0 && bpm <= 82 ? '慢歌' : '节奏稳定',
    releaseYear ? `${releaseYear}年` : '',
  ].filter(Boolean)
  return {
    id: item.id || item.songid || mid,
    mid,
    mediaMid: item.file?.media_mid || item.media_mid || item.mediaMid,
    songType: item.type ?? item.songtype ?? item.songType,
    title,
    artist,
    album,
    coverUrl: item.album?.pmid
      ? `https://y.gtimg.cn/music/photo_new/T002R300x300M000${item.album.pmid}.jpg`
      : item.cover_url || item.picurl,
    playUrl: item.playUrl || item.url,
    detailUrl: mid ? `https://y.qq.com/n/ryqq/songDetail/${mid}` : undefined,
    source: 'qqmusic',
    language,
    releaseYear,
    genre: item.genre ? [String(item.genre)] : [],
    version: item.ov === 0 ? 'cover' : 'studio',
    semanticDescription: `${title} - ${artist}${album ? `，收录于《${album}》` : ''}${bpm ? `，BPM ${bpm}` : ''}。`,
    playCount: 0,
    lastPlayedAt: '',
    mood: bpm >= 115 ? ['energetic'] : bpm > 0 && bpm <= 82 ? ['soft'] : ['calm'],
    scene: bpm >= 115 ? ['commute', 'run'] : ['night', 'commute'],
    energy,
    bpm,
    tags,
    reasonSeeds: [
      `${title} 来自 QQ 音乐歌单，${bpm ? `节奏约 ${bpm} BPM` : '适合根据歌名与歌手语义匹配'}。`,
    ],
  }
}

async function searchQQMusic(keyword, num) {
  if (!QQ_MUSIC_API_BASE_URL) return []
  const url = new URL(qqmusicUrl('/search/search_by_type'))
  url.searchParams.set('keyword', keyword)
  url.searchParams.set('search_type', '0')
  url.searchParams.set('num', String(num || 5))
  const data = await qqmusicJson(`${url.pathname}${url.search}`)
  return pickSongList(data?.data ?? data)
    .map(normalizeQQSong)
    .filter((song) => song.title && song.artist)
}

async function getQQPlaylists(session, num = 30) {
  const credential = session?.credential
  const uin = getCredentialUin(credential)
  const euin = getCredentialEuin(credential)
  if (!uin) throw new Error('QQ Music login required.')

  const created = await qqmusicJson(`/user/${encodeURIComponent(String(uin))}/created_songlists`, withCredential(session))
  const createdPayload = created?.data ?? created
  const createdPlaylists = pickList(createdPayload?.playlists, createdPayload?.v_playlist)
    .map((item) => normalizeQQPlaylist(item, 'created'))
    .filter(Boolean)

  let favoritePlaylists = []
  if (euin) {
    try {
      const fav = await qqmusicJson(`/user/${encodeURIComponent(String(euin))}/fav/songlists?page=1&num=${encodeURIComponent(String(num))}`, withCredential(session))
      const favPayload = fav?.data ?? fav
      favoritePlaylists = pickList(favPayload?.playlists, favPayload?.v_list)
        .map((item) => normalizeQQPlaylist(item, 'favorite'))
        .filter(Boolean)
    } catch {
      favoritePlaylists = []
    }
  }

  const liked = {
    id: 'fav_songs',
    title: '我喜欢的音乐',
    subtitle: 'QQ 音乐收藏歌曲 · 可导入 AI 筛选',
    description: '从 QQ 音乐“我喜欢”歌曲中临时生成当前歌单。',
    coverUrl: '',
    songCount: 0,
    source: 'qqmusic',
    type: 'liked',
  }

  return [liked, ...createdPlaylists, ...favoritePlaylists].slice(0, num + 1)
}

async function getQQPlaylistSongs(session, { id, type, num = 80, page = 1 }) {
  const credential = session?.credential
  const euin = getCredentialEuin(credential)
  if (!id) throw new Error('Missing playlist id.')

  const path = id === 'fav_songs' || type === 'liked'
    ? `/user/${encodeURIComponent(String(euin))}/fav/songs?page=${encodeURIComponent(String(page))}&num=${encodeURIComponent(String(num))}`
    : `/songlist/${encodeURIComponent(String(id))}/detail?page=${encodeURIComponent(String(page))}&num=${encodeURIComponent(String(num))}`

  const data = await qqmusicJson(path, withCredential(session))
  const payload = data?.data ?? data
  const songs = pickSongList(payload).map(normalizeQQSong).filter((song) => song.title && song.artist)
  const info = payload?.info || payload?.dirinfo || {}
  return {
    playlist: normalizeQQPlaylist({
      ...info,
      id: id === 'fav_songs' ? 'fav_songs' : (info.id || id),
      title: id === 'fav_songs' ? '我喜欢的音乐' : (info.title || info.name),
      songnum: payload?.total || payload?.total_song_num || songs.length,
    }, id === 'fav_songs' ? 'liked' : 'created'),
    songs,
    total: payload?.total || payload?.total_song_num || songs.length,
    hasMore: Boolean(payload?.hasmore),
  }
}

async function getSongPlayUrl(mid, session, options = {}) {
  if (!mid || !session?.credential) return ''
  const fileTypes = [13, 30, 15, 11, 12]
  for (const fileType of fileTypes) {
    const params = new URLSearchParams({ file_type: String(fileType) })
    if (options.songType) params.set('song_type', String(options.songType))
    if (options.mediaMid) params.set('media_mid', options.mediaMid)
    const data = await qqmusicJson(`/song/${encodeURIComponent(mid)}/url?${params.toString()}`, {
      headers: {
        Cookie: credentialCookie(session.credential),
      },
    })
    const payload = data?.data ?? data
    const url = typeof payload === 'string'
      ? payload
      : payload?.url
        || payload?.midurlinfo?.find?.((item) => item?.purl)?.purl
        || (payload?.urls && typeof payload.urls === 'object'
          ? payload.urls[mid] || Object.values(payload.urls)[0]
          : '')
    if (url) return normalizePlayUrl(url)
  }
  return ''
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') return json(res, 204, {})

  try {
    const url = new URL(req.url || '/', `http://${req.headers.host}`)
    if (req.method === 'POST' && url.pathname === '/api/llm/chat-json') {
      const body = await readJson(req)
      try {
        return json(res, 200, await requestLLM({ ...body, withJsonMode: true }))
      } catch {
        return json(res, 200, await requestLLM({ ...body, withJsonMode: false }))
      }
    }

    if (req.method === 'POST' && url.pathname === '/api/playlist/filter') {
      const body = await readJson(req)
      try {
        return json(res, 200, await filterPlaylistWithLLM(body))
      } catch {
        const fallback = await requestLLM({
          system: '你是音乐歌单筛选助手。请只返回 JSON，字段包含 understood, summary, chips, generatedName, suggestions, relaxed, results。results 只能使用用户提供的歌曲 id。',
          user: JSON.stringify(body),
          withJsonMode: false,
        })
        return json(res, 200, fallback)
      }
    }

    if (req.method === 'GET' && url.pathname === '/api/music/search') {
      const keyword = url.searchParams.get('keyword') || ''
      const num = Number(url.searchParams.get('num') || 5)
      if (!keyword.trim()) return json(res, 400, { error: 'Missing keyword.' })
      return json(res, 200, { songs: await searchQQMusic(keyword.trim(), num) })
    }

    if (req.method === 'GET' && url.pathname === '/api/music/login/qrcode') {
      const loginType = url.searchParams.get('type') || 'qq'
      return json(res, 200, await qqmusicJson(`/login/qrcode/${encodeURIComponent(loginType)}`))
    }

    if (req.method === 'GET' && url.pathname === '/api/music/login/status') {
      const loginType = url.searchParams.get('type') || 'qq'
      const identifier = url.searchParams.get('identifier') || ''
      if (!identifier) return json(res, 400, { error: 'Missing identifier.' })
      const data = await qqmusicJson(`/login/qrcode/${encodeURIComponent(loginType)}/status?identifier=${encodeURIComponent(identifier)}`)
      const status = data?.data
      if (status?.credential?.musicid && status?.credential?.musickey) {
        const sessionId = storeMusicSession(status.credential)
        return json(res, 200, {
          ...data,
          data: {
            ...status,
            credential: undefined,
            sessionId,
            expiresAt: Date.now() + MUSIC_SESSION_TTL_MS,
          },
        })
      }
      return json(res, 200, data)
    }

    if (req.method === 'GET' && url.pathname === '/api/music/session/status') {
      const session = getMusicSession(req)
      return json(res, 200, { ok: Boolean(session), expiresAt: session?.expiresAt ?? 0 })
    }

    if (req.method === 'GET' && url.pathname === '/api/music/playlists') {
      const session = getMusicSession(req)
      const num = Number(url.searchParams.get('num') || 30)
      if (!session) return json(res, 401, { error: 'QQ Music login required.' })
      return json(res, 200, { playlists: await getQQPlaylists(session, num) })
    }

    if (req.method === 'GET' && url.pathname === '/api/music/playlist-songs') {
      const session = getMusicSession(req)
      const id = url.searchParams.get('id') || ''
      const type = url.searchParams.get('type') || ''
      const num = Number(url.searchParams.get('num') || 80)
      const page = Number(url.searchParams.get('page') || 1)
      if (!session) return json(res, 401, { error: 'QQ Music login required.' })
      return json(res, 200, await getQQPlaylistSongs(session, { id, type, num, page }))
    }

    if (req.method === 'GET' && url.pathname === '/api/music/play-url') {
      const mid = url.searchParams.get('mid') || ''
      const mediaMid = url.searchParams.get('mediaMid') || ''
      const songType = Number(url.searchParams.get('songType') || 0)
      const session = getMusicSession(req)
      if (!session) return json(res, 401, { error: 'QQ Music login required.' })
      return json(res, 200, { playUrl: await getSongPlayUrl(mid, session, { mediaMid, songType }) })
    }

    return json(res, 404, { error: 'Not found.' })
  } catch (err) {
    return json(res, 500, { error: err instanceof Error ? err.message : 'Unknown error.' })
  }
})

server.listen(PORT, () => {
  console.log(`Local proxy listening on http://localhost:${PORT}`)
})
