// ── LLM 适配器 ──
// 兼容 OpenAI Chat Completions 协议。未配置或调用失败时返回 null，
// 由各业务模块降级到本地启发式 / mock 数据（满足「mock-first / fallback」硬约束）。

const BASE_URL = import.meta.env.VITE_LLM_BASE_URL as string | undefined
const API_KEY = import.meta.env.VITE_LLM_API_KEY as string | undefined
const MODEL = (import.meta.env.VITE_LLM_MODEL as string | undefined) || 'gpt-4o-mini'

export function isLLMConfigured(): boolean {
  return Boolean(BASE_URL && API_KEY)
}

/**
 * 调用 LLM 并要求返回 JSON。失败 / 未配置 / 超时一律返回 null，绝不抛错打断流程。
 */
export async function callLLMJson<T>(
  system: string,
  user: string,
  timeoutMs = 9000,
): Promise<T | null> {
  if (!isLLMConfigured()) return null

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(`${BASE_URL!.replace(/\/$/, '')}/chat/completions`, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${API_KEY}`,
      },
      body: JSON.stringify({
        model: MODEL,
        temperature: 0.7,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
      }),
    })
    if (!res.ok) return null
    const data = await res.json()
    const content: string | undefined = data?.choices?.[0]?.message?.content
    if (!content) return null
    return JSON.parse(content) as T
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}
