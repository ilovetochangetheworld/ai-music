// ── LLM 适配器 ──
// 兼容 OpenAI Chat Completions 协议。未配置或调用失败时返回 null，
// 由各业务模块降级到本地启发式 / mock 数据（满足「mock-first / fallback」硬约束）。

const BASE_URL = import.meta.env.VITE_LLM_BASE_URL as string | undefined
const API_KEY = import.meta.env.VITE_LLM_API_KEY as string | undefined
const MODEL = import.meta.env.VITE_LLM_MODEL as string | undefined
const BACKEND_BASE_URL = import.meta.env.VITE_BACKEND_BASE_URL as string | undefined

export function isLLMConfigured(): boolean {
  return Boolean(BACKEND_BASE_URL || (BASE_URL && API_KEY))
}

function chatCompletionsUrl(baseUrl: string): string {
  const clean = baseUrl.replace(/\/$/, '')
  return clean.endsWith('/chat/completions') ? clean : `${clean}/chat/completions`
}

function parseJsonContent<T>(content: string): T | null {
  const trimmed = content.trim()
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i)
  const raw = fenced?.[1]?.trim() ?? trimmed

  try {
    return JSON.parse(raw) as T
  } catch {
    const start = raw.indexOf('{')
    const end = raw.lastIndexOf('}')
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(raw.slice(start, end + 1)) as T
      } catch {
        return null
      }
    }
    return null
  }
}

async function requestChatCompletion(
  url: string,
  system: string,
  user: string,
  signal: AbortSignal,
  withJsonMode: boolean,
): Promise<string | null> {
  const res = await fetch(url, {
    method: 'POST',
    signal,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${API_KEY}`,
    },
    body: JSON.stringify({
      model: MODEL || 'gpt-4o-mini',
      temperature: 0.7,
      ...(withJsonMode ? { response_format: { type: 'json_object' } } : {}),
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
    }),
  })
  if (!res.ok) return null
  const data = await res.json()
  return data?.choices?.[0]?.message?.content ?? null
}

/**
 * 调用 LLM 并要求返回 JSON。失败 / 未配置 / 超时一律返回 null，绝不抛错打断流程。
 */
export async function callLLMJson<T>(
  system: string,
  user: string,
  timeoutMs = 30000,
): Promise<T | null> {
  if (!isLLMConfigured()) return null

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    if (BACKEND_BASE_URL) {
      const res = await fetch(`${BACKEND_BASE_URL.replace(/\/$/, '')}/api/llm/chat-json`, {
        method: 'POST',
        signal: controller.signal,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ system, user }),
      })
      if (!res.ok) return null
      return (await res.json()) as T
    }

    const url = chatCompletionsUrl(BASE_URL!)
    const jsonModeContent = await requestChatCompletion(url, system, user, controller.signal, true)
    const jsonModeParsed = jsonModeContent ? parseJsonContent<T>(jsonModeContent) : null
    if (jsonModeParsed) return jsonModeParsed

    const plainContent = await requestChatCompletion(url, system, user, controller.signal, false)
    return plainContent ? parseJsonContent<T>(plainContent) : null
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}
