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
  const res = await fetch(qqmusicUrl(pathname), init)
  const data = await res.json()
  if (data?.code !== undefined && data.code !== 0) throw new Error(data?.msg || 'QQMusicApi failed.')
  return data
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
  if (Array.isArray(data?.data?.song)) return data.data.song
  if (Array.isArray(data?.data?.list)) return data.data.list
  return []
}

function normalizeQQSong(raw) {
  const item = raw?.song || raw
  const mid = item.mid || item.songmid || item.song_mid
  return {
    id: item.id || item.songid || mid,
    mid,
    mediaMid: item.file?.media_mid || item.media_mid || item.mediaMid,
    songType: item.type ?? item.songtype ?? item.songType,
    title: cleanText(item.title || item.name || item.songname),
    artist: cleanText(normalizeSinger(item.singer || item.singers)),
    album: cleanText(item.album?.title || item.album?.name || item.albumname),
    coverUrl: item.album?.pmid
      ? `https://y.gtimg.cn/music/photo_new/T002R300x300M000${item.album.pmid}.jpg`
      : item.cover_url || item.picurl,
    playUrl: item.playUrl || item.url,
    detailUrl: mid ? `https://y.qq.com/n/ryqq/songDetail/${mid}` : undefined,
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
