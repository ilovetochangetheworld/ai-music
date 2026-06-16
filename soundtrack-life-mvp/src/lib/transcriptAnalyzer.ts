import type { AudioChapter, RouteStep, TranscriptAnalysis, TranscriptSegment } from '../types'
import { callLLMJson } from './llm'
import podcastData from '../data/podcast-transcript.json'

export const SAMPLE_TRANSCRIPT = podcastData as {
  id: string
  title: string
  segments: TranscriptSegment[]
}

const TOPIC_LEXICON = [
  'Suno', 'Udio', '版权', '授权', '训练数据', '声音肖像', '平台', '标识',
  '创作者经济', '分账', '确权', '独立音乐人', '编曲', '门槛', '收益', 'demo', '封面',
]

function extractKeywords(text: string): string[] {
  return TOPIC_LEXICON.filter((k) => text.includes(k)).slice(0, 4)
}

function toMinutes(ts: string): number {
  const [m, s] = ts.split(':').map(Number)
  return (m || 0) + (s || 0) / 60
}

function titleFromText(text: string): string {
  const first = text.split(/[，。！？]/)[0]
  return first.length > 18 ? first.slice(0, 18) + '…' : first
}

/** 本地启发式章节化（mock 降级路径） */
function heuristicAnalyze(title: string, segments: TranscriptSegment[]): TranscriptAnalysis {
  const chapters: AudioChapter[] = segments.map((seg, i) => {
    const keywords = extractKeywords(seg.text)
    const importance = Math.min(95, 55 + keywords.length * 12 + (seg.speaker === 'guest' ? 6 : 0))
    return {
      id: `chapter_${i + 1}`,
      start: seg.start,
      end: seg.end,
      title: titleFromText(seg.text),
      summary: seg.text.length > 46 ? seg.text.slice(0, 46) + '…' : seg.text,
      keywords,
      importance,
    }
  })

  const byImportance = [...chapters].sort((a, b) => b.importance - a.importance)
  const threeMinuteRoute: RouteStep[] = byImportance.slice(0, 2).map((c) => ({
    start: c.start, end: c.end, reason: `核心观点：${c.title}`,
  }))
  const fifteenMinuteRoute: RouteStep[] = byImportance.slice(0, 4)
    .sort((a, b) => toMinutes(a.start) - toMinutes(b.start))
    .map((c) => ({ start: c.start, end: c.end, reason: `${c.keywords.join('、') || '关键讨论'}` }))

  const totalMin = Math.round(toMinutes(segments[segments.length - 1]?.end ?? '0:00'))

  return {
    id: SAMPLE_TRANSCRIPT.id,
    audioTitle: title,
    brief: `这期约 ${totalMin} 分钟的节目，主要围绕 AI 音乐如何从生成工具走向创作者经济：先聊产品门槛，再到版权与训练数据授权，最后落到平台分账与确权。`,
    chapters,
    threeMinuteRoute,
    fifteenMinuteRoute,
    quotes: [
      '最大的问题不是能不能生成，而是生成出来以后版权归谁。',
      'AI 不直接替代创作，而是帮你理解音乐、编排歌单。',
      '创作者经济的关键是分账和确权。',
    ],
    questionsToAsk: [
      '只听关于版权风险的部分',
      'AI 对独立音乐人到底是机会还是威胁？',
      '平台应该怎么给创作者分账？',
    ],
    segments,
  }
}

interface LLMAnalysis {
  brief: string
  chapters: AudioChapter[]
  threeMinuteRoute: RouteStep[]
  fifteenMinuteRoute: RouteStep[]
  quotes: string[]
  questionsToAsk: string[]
}

const SYSTEM = `你是长音频速听教练。把转写稿变成可导航章节地图，保留时间戳，给出 3 分钟速听与 15 分钟精听路线，必须返回 JSON。`

const SCHEMA_HINT = `只返回如下 JSON，不要 markdown，不要解释：
{
  "brief": "整期长音频的一段短摘要",
  "chapters": [
    {
      "id": "chapter_1",
      "start": "00:00",
      "end": "03:20",
      "title": "章节标题",
      "summary": "章节摘要",
      "keywords": ["关键词"],
      "importance": 0
    }
  ],
  "threeMinuteRoute": [
    { "start": "00:00", "end": "03:20", "reason": "为什么值得速听" }
  ],
  "fifteenMinuteRoute": [
    { "start": "00:00", "end": "03:20", "reason": "为什么值得精听" }
  ],
  "quotes": ["节目金句"],
  "questionsToAsk": ["用户可能追问的问题"]
}`

export async function analyzeTranscript(
  title: string,
  segments: TranscriptSegment[],
): Promise<TranscriptAnalysis> {
  const user = `${SCHEMA_HINT}\n\n长音频标题：${title}\n转写稿：\n${JSON.stringify(segments)}`
  const llm = await callLLMJson<LLMAnalysis>(SYSTEM, user)
  if (llm?.chapters?.length) {
    return { id: SAMPLE_TRANSCRIPT.id, audioTitle: title, segments, ...llm }
  }
  return heuristicAnalyze(title, segments)
}

/** 把粘贴的纯文本转写解析为带时间戳的 segments（每段约 30 秒递增），供自定义输入使用 */
export function parsePastedTranscript(raw: string): { title: string; segments: TranscriptSegment[] } {
  const lines = raw.split(/\n+/).map((l) => l.trim()).filter(Boolean)
  const title = lines[0]?.slice(0, 30) || '我粘贴的长音频'
  const body = lines.slice(1).length ? lines.slice(1) : lines
  let cursor = 0
  const segments: TranscriptSegment[] = body.map((text, i) => {
    const start = cursor
    cursor += Math.max(1, Math.round(text.length / 12)) // 估算时长
    const fmt = (m: number) => `${String(Math.floor(m)).padStart(2, '0')}:00`
    return {
      id: `seg_${i + 1}`,
      start: fmt(start),
      end: fmt(cursor),
      speaker: i % 2 === 0 ? 'host' : 'guest',
      text,
    }
  })
  return { title, segments }
}
