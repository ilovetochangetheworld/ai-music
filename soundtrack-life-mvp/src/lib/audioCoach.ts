import type { CoachAnswer, CoachSegment, TranscriptAnalysis } from '../types'
import { callLLMJson } from './llm'

const STOPWORDS = ['的', '了', '吗', '呢', '只', '听', '想', '关于', '部分', '里', '这期', '节目', '帮我', '找', '一下', '是', '和', '与']

function tokenize(q: string): string[] {
  return STOPWORDS.reduce((s, w) => s.split(w).join(' '), q)
    .split(/\s+/)
    .flatMap((t) => (t.length > 1 ? [t, ...splitBi(t)] : []))
    .filter((t) => t.length >= 2)
}
function splitBi(t: string): string[] {
  const out: string[] = []
  for (let i = 0; i < t.length - 1; i++) out.push(t.slice(i, i + 2))
  return out
}

/** 本地启发式问答（mock 降级路径）：在 segments/chapters 上做关键词重叠检索 */
function heuristicAsk(question: string, analysis: TranscriptAnalysis): CoachAnswer {
  const tokens = tokenize(question)
  const scored = analysis.segments
    .map((seg) => {
      const hay = seg.text + ' ' + (analysis.chapters.find((c) => c.start === seg.start)?.keywords.join('') ?? '')
      const score = tokens.reduce((s, t) => s + (hay.includes(t) ? 1 : 0), 0)
      return { seg, score }
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)

  const segments: CoachSegment[] = (scored.length ? scored : analysis.segments.slice(0, 1).map((seg) => ({ seg, score: 0 })))
    .map(({ seg }) => {
      const chap = analysis.chapters.find((c) => c.start === seg.start)
      return {
        start: seg.start,
        end: seg.end,
        title: chap?.title ?? seg.text.slice(0, 16),
        reason: `这段直接谈到了你关心的「${tokens[0] ?? '主题'}」相关内容。`,
      }
    })

  const answer = scored.length
    ? `根据这期内容，最相关的有 ${segments.length} 段，集中在 ${segments.map((s) => s.start).join('、')} 附近，建议从这里开始听。`
    : '这期节目里没有特别直接对应的片段，建议先听开头的总览部分了解整体脉络。'

  return {
    answer,
    segments,
    followUpQuestions: ['这段的核心结论是什么？', '有没有反方观点？', '相关的还有哪些片段？'],
  }
}

const SYSTEM = `你是长音频导航助手。基于章节和转写稿回答用户问题，并返回最值得收听的时间片段。不要编造 transcript 中没有的信息，每个片段必须有 start/end/title/reason，回答要短。必须返回 JSON。`

export async function askAudioCoach(
  question: string,
  analysis: TranscriptAnalysis,
): Promise<CoachAnswer> {
  const user = `用户问题：${question}\n章节：${JSON.stringify(analysis.chapters)}\n转写稿：${JSON.stringify(analysis.segments)}\n\n请按约定 JSON 结构输出（answer/segments/followUpQuestions）。`
  const llm = await callLLMJson<CoachAnswer>(SYSTEM, user)
  if (llm?.segments) return llm
  return heuristicAsk(question, analysis)
}
