import http from 'node:http'
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import { tmpdir } from 'node:os'
import path from 'node:path'

const PORT = Number(process.env.PORT || 8787)
const ANALYSIS_BASE_URL = process.env.ANALYSIS_BASE_URL || 'http://127.0.0.1:8790'
const ALLOWED_ORIGINS = new Set((process.env.ALLOWED_ORIGINS || 'http://localhost:5173,http://127.0.0.1:5173,https://ilovetochangetheworld.github.io').split(',').map((item) => item.trim()))
const ENABLE_TUNING_DEMO = process.env.ENABLE_TUNING_DEMO === 'true'
const LLM_BASE_URL = process.env.LLM_BASE_URL || ''
const LLM_API_KEY = process.env.LLM_API_KEY || ''
const LLM_MODEL = process.env.LLM_MODEL || 'gpt-4o-mini'
const MAX_RECORDING_BYTES = 25 * 1024 * 1024
const MAX_BODY_BYTES = 36 * 1024 * 1024
const SESSION_TTL_MS = 24 * 60 * 60 * 1000
const STORE_DIR = path.join(tmpdir(), 'ai-practice-room')

await mkdir(STORE_DIR, { recursive: true })

function corsHeaders(req) {
  const origin = req.headers.origin
  const allowed = origin && ALLOWED_ORIGINS.has(origin) ? origin : [...ALLOWED_ORIGINS][0]
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    Vary: 'Origin',
  }
}

function json(req, res, status, body) {
  res.writeHead(status, { ...corsHeaders(req), 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' })
  res.end(JSON.stringify(body))
}

async function readJson(req) {
  const chunks = []
  let size = 0
  for await (const chunk of req) {
    size += chunk.length
    if (size > MAX_BODY_BYTES) {
      const error = new Error('Request body exceeds 36MB.')
      error.statusCode = 413
      throw error
    }
    chunks.push(chunk)
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}')
  } catch {
    const error = new Error('Invalid JSON body.')
    error.statusCode = 400
    throw error
  }
}

function sessionFile(id) {
  if (!/^[a-f0-9-]{36}$/.test(id)) throw Object.assign(new Error('Invalid session id.'), { statusCode: 400 })
  return path.join(STORE_DIR, `${id}.json`)
}

async function readSession(id) {
  try {
    return JSON.parse(await readFile(sessionFile(id), 'utf8'))
  } catch (error) {
    if (error?.code === 'ENOENT') throw Object.assign(new Error('Session not found.'), { statusCode: 404 })
    throw error
  }
}

async function saveSession(session) {
  await writeFile(sessionFile(session.id), JSON.stringify(session), { mode: 0o600 })
}

function insufficientReport(session, message) {
  const metric = (key, label) => ({ key, label, score: null, confidence: 0, evidence: message, suggestion: message, segments: [], status: 'insufficient_data' })
  return {
    version: '1.0', sessionId: session.id, songId: session.songId, status: 'insufficient_data', overallScore: null,
    metrics: [metric('pitch', '音高准确度'), metric('rhythm', '节奏贴合度'), metric('breath', '呼吸控制'), metric('expression', '情感表达'), metric('consistency', '一致性')],
    highlights: [], primarySuggestion: message,
    headline: '分析服务暂不可用，小麦不会生成推测分数。',
    dataQuality: { vocalCoverage: 0, noiseFloorDb: -60, pitchConfidence: 0, reasons: [message] },
  }
}

async function requestLLM(body) {
  if (!LLM_BASE_URL || !LLM_API_KEY) throw Object.assign(new Error('LLM is not configured.'), { statusCode: 503 })
  const endpoint = `${LLM_BASE_URL.replace(/\/$/, '')}/chat/completions`
  const response = await fetch(endpoint, {
    method: 'POST', signal: AbortSignal.timeout(30_000),
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${LLM_API_KEY}` },
    body: JSON.stringify({ model: LLM_MODEL, temperature: 0.5, response_format: { type: 'json_object' }, messages: [{ role: 'system', content: body.system }, { role: 'user', content: body.user }] }),
  })
  if (!response.ok) throw new Error(`LLM returned ${response.status}.`)
  const data = await response.json()
  const content = data?.choices?.[0]?.message?.content
  if (typeof content !== 'string') throw new Error('LLM response has no content.')
  return JSON.parse(content.replace(/^```(?:json)?\s*|\s*```$/gi, ''))
}

async function analyze(session, payload) {
  try {
    const response = await fetch(`${ANALYSIS_BASE_URL}/analyze`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session, telemetry: payload.telemetry || [], recordingBase64: payload.recordingBase64 || null }),
      signal: AbortSignal.timeout(25_000),
    })
    if (!response.ok) throw new Error(`Analyzer returned ${response.status}.`)
    session.report = await response.json()
    session.status = 'completed'
  } catch (error) {
    session.status = 'completed'
    session.report = insufficientReport(session, '分析服务暂不可用，本次录音已保留为临时会话，但不会生成推测分数。')
    session.analysisWarning = error instanceof Error ? error.message : 'Analyzer unavailable.'
  }
  session.updatedAt = Date.now()
  await saveSession(session)
}

async function createSession(req, res) {
  const payload = await readJson(req)
  if (!payload.songId || !payload.songVersion) return json(req, res, 400, { error: 'songId and songVersion are required.' })
  if (!Array.isArray(payload.telemetry)) return json(req, res, 400, { error: 'telemetry must be an array.' })
  if (payload.recordingBase64) {
    const recordingBytes = Buffer.byteLength(payload.recordingBase64, 'base64')
    if (recordingBytes > MAX_RECORDING_BYTES) return json(req, res, 413, { error: 'Recording exceeds 25MB.' })
  }
  const now = Date.now()
  const session = {
    id: randomUUID(), songId: payload.songId, songVersion: payload.songVersion,
    mode: payload.mode === 'focus' ? 'focus' : 'free', status: 'processing', createdAt: now, updatedAt: now,
    expiresAt: now + SESSION_TTL_MS, calibration: payload.calibration || null,
  }
  await saveSession(session)
  void analyze(session, payload)
  return json(req, res, 202, { sessionId: session.id, status: session.status })
}

async function cleanupExpired() {
  const { readdir } = await import('node:fs/promises')
  for (const name of await readdir(STORE_DIR)) {
    if (!name.endsWith('.json')) continue
    try {
      const item = JSON.parse(await readFile(path.join(STORE_DIR, name), 'utf8'))
      if (item.expiresAt <= Date.now()) await rm(path.join(STORE_DIR, name))
    } catch { /* a damaged temporary file is ignored and never exposed */ }
  }
}

setInterval(() => void cleanupExpired(), 60 * 60 * 1000).unref()
void cleanupExpired()

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') return json(req, res, 204, {})
  try {
    const url = new URL(req.url || '/', `http://${req.headers.host}`)
    if (req.method === 'GET' && url.pathname === '/health') return json(req, res, 200, { ok: true, service: 'practice-bff' })
    if (req.method === 'POST' && url.pathname === '/api/llm/chat-json') return json(req, res, 200, await requestLLM(await readJson(req)))
    if (req.method === 'POST' && url.pathname === '/api/practice/sessions') return await createSession(req, res)

    const reportMatch = url.pathname.match(/^\/api\/practice\/sessions\/([a-f0-9-]{36})\/report$/)
    if (req.method === 'GET' && reportMatch) {
      const session = await readSession(reportMatch[1])
      if (session.status !== 'completed') return json(req, res, 425, { status: session.status })
      return json(req, res, 200, session.report)
    }
    const tuneMatch = url.pathname.match(/^\/api\/practice\/sessions\/([a-f0-9-]{36})\/tune$/)
    if (req.method === 'POST' && tuneMatch) {
      if (!ENABLE_TUNING_DEMO) return json(req, res, 404, { error: 'Tuning demo is disabled.' })
      await readSession(tuneMatch[1])
      return json(req, res, 501, { error: 'Local GPU tuning service is not configured.' })
    }
    const sessionMatch = url.pathname.match(/^\/api\/practice\/sessions\/([a-f0-9-]{36})$/)
    if (req.method === 'GET' && sessionMatch) {
      const session = await readSession(sessionMatch[1])
      return json(req, res, 200, { sessionId: session.id, status: session.status, expiresAt: session.expiresAt, warning: session.analysisWarning })
    }
    return json(req, res, 404, { error: 'Not found.' })
  } catch (error) {
    return json(req, res, error?.statusCode || 500, { error: error instanceof Error ? error.message : 'Unknown error.' })
  }
})

server.listen(PORT, () => console.log(`Practice BFF listening on http://localhost:${PORT}`))
