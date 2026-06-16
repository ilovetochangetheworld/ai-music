import fs from 'node:fs'
import path from 'node:path'

function loadEnv(file) {
  if (!fs.existsSync(file)) return {}
  const env = {}
  const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/)
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const idx = trimmed.indexOf('=')
    if (idx < 0) continue
    const key = trimmed.slice(0, idx).trim()
    const value = trimmed.slice(idx + 1).trim().replace(/^['"]|['"]$/g, '')
    env[key] = value
  }
  return env
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

async function request({ url, apiKey, model, withJsonMode }) {
  const body = {
    model,
    temperature: 0.4,
    ...(withJsonMode ? { response_format: { type: 'json_object' } } : {}),
    messages: [
      {
        role: 'system',
        content: '你只返回 JSON，不要 markdown，不要解释。',
      },
      {
        role: 'user',
        content:
          '请返回 {"ok":true,"title":"测试原声带","scenes":[{"emotion":"平静","energy":40}]}',
      },
    ],
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  })

  const text = await res.text()
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${text.slice(0, 240)}`)
  }

  const data = JSON.parse(text)
  const content = data?.choices?.[0]?.message?.content
  if (!content) throw new Error('No choices[0].message.content in response.')
  return parseJsonContent(content)
}

const env = { ...loadEnv(path.resolve('.env')), ...process.env }
const baseUrl = env.VITE_LLM_BASE_URL
const apiKey = env.VITE_LLM_API_KEY
const model = env.VITE_LLM_MODEL || 'hy3-preview'

if (!baseUrl || !apiKey) {
  console.error('Missing VITE_LLM_BASE_URL or VITE_LLM_API_KEY in .env.')
  process.exit(1)
}

const url = chatCompletionsUrl(baseUrl)
console.log(`Testing model "${model}" at ${url}`)

try {
  const result = await request({ url, apiKey, model, withJsonMode: true })
  console.log('JSON mode: ok')
  console.log(JSON.stringify(result, null, 2))
} catch (err) {
  console.log(`JSON mode failed, retrying plain mode: ${err.message}`)
  const result = await request({ url, apiKey, model, withJsonMode: false })
  console.log('Plain mode: ok')
  console.log(JSON.stringify(result, null, 2))
}

