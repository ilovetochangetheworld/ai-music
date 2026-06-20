import type { LyricLine } from '../sing-room/types'
import type { MetricKey, MetricScore, PracticeReport, PracticeTelemetryFrame, ReferenceNote } from '../../../shared/contracts'

const labels: Record<MetricKey, string> = {
  pitch: '音高准确度', rhythm: '节奏贴合度', breath: '呼吸控制', expression: '情感表达', consistency: '一致性',
}

export function buildLocalPracticeReport(input: {
  sessionId: string
  songId: string
  frames: PracticeTelemetryFrame[]
  lines: LyricLine[]
  notes?: ReferenceNote[]
  noiseFloorDb: number
}): PracticeReport {
  const active = input.frames.filter((frame) => frame.isSinging)
  const expectedDuration = input.lines.reduce((sum, line) => sum + Math.max(0, line.end - line.start), 0)
  const vocalCoverage = Math.min(1, active.length * 0.08 / Math.max(expectedDuration, 1))
  const pitchConfidence = active.length ? average(active.map((frame) => frame.clarity)) : 0
  const reasons: string[] = []
  if (vocalCoverage < 0.2) reasons.push('有效演唱覆盖不足 20%')
  if (pitchConfidence < 0.45) reasons.push('音高检测置信度不足')
  const valid = reasons.length === 0

  const pitch = scorePitch(input.frames, input.notes ?? [], valid)
  const rhythm = scoreRhythm(input.frames, input.lines, valid)
  const breath = scoreBreath(input.frames, input.lines, valid)
  const expression = scoreExpression(input.frames, input.lines, valid)
  const consistency = scoreConsistency(input.frames, valid)
  const metrics = [pitch, rhythm, breath, expression, consistency]
  const scored = metrics.filter((metric) => metric.score !== null)
  const weights: Record<MetricKey, number> = { pitch: .3, rhythm: .25, breath: .15, expression: .15, consistency: .15 }
  const weightTotal = scored.reduce((sum, metric) => sum + weights[metric.key], 0)
  const overallScore = valid && scored.length === 5
    ? Math.round(scored.reduce((sum, metric) => sum + (metric.score ?? 0) * weights[metric.key], 0) / weightTotal)
    : null
  const highlightLine = selectHighlight(input.frames, input.lines)

  return {
    version: '1.0', sessionId: input.sessionId, songId: input.songId,
    status: overallScore === null ? 'insufficient_data' : 'complete', overallScore,
    dataQuality: { vocalCoverage, pitchConfidence, noiseFloorDb: input.noiseFloorDb, reasons },
    metrics,
    highlights: highlightLine ? [{ startSec: highlightLine.start, endSec: highlightLine.end, lineId: highlightLine.id }] : [],
    headline: overallScore === null ? '这次的数据还不够稳定，小麦先帮你保留真实录音。' : '这次演唱已经记录下来，下面每项反馈都能回到对应片段。',
    primarySuggestion: chooseSuggestion(metrics),
  }
}

function insufficient(key: MetricKey, evidence: string): MetricScore {
  return { key, label: labels[key], score: null, confidence: 0, status: 'insufficient_data', evidence, suggestion: '换安静环境并佩戴耳机后再试一次。', segments: [] }
}

function scorePitch(frames: PracticeTelemetryFrame[], notes: ReferenceNote[], valid: boolean): MetricScore {
  if (!valid || !notes.length) return insufficient('pitch', notes.length ? '本次音高数据不足。' : '参考旋律尚未完成人工校正，暂不提供音准分。')
  const errors = frames.filter((frame) => frame.isSinging && frame.pitchHz > 0).map((frame) => {
    const note = notes.find((item) => frame.at >= item.startSec && frame.at < item.endSec)
    if (!note) return null
    const midi = 69 + 12 * Math.log2(frame.pitchHz / 440)
    const raw = Math.abs((midi - note.midi) * 100)
    return Math.min(raw % 1200, 1200 - raw % 1200)
  }).filter((value): value is number => value !== null)
  if (errors.length < 8) return insufficient('pitch', '与参考音符重叠的有效帧不足。')
  const mean = average(errors)
  const score = Math.round(clamp(100 - mean / 2))
  return { key: 'pitch', label: labels.pitch, score, confidence: Math.min(1, errors.length / 80), status: 'ok', evidence: `参考音高平均偏差约 ${Math.round(mean)} 音分。`, suggestion: score < 70 ? '先轻声跟唱参考旋律，再逐步增加音量。' : '长音继续保持气流，避免句尾下滑。', segments: [] }
}

function scoreRhythm(frames: PracticeTelemetryFrame[], lines: LyricLine[], valid: boolean): MetricScore {
  if (!valid) return insufficient('rhythm', '有效演唱区间不足。')
  const offsets = lines.map((line) => {
    const first = frames.find((frame) => frame.isSinging && frame.at >= line.start - .5 && frame.at <= line.end)
    return first ? Math.abs(first.at - line.start) : null
  }).filter((value): value is number => value !== null)
  if (offsets.length < 2) return insufficient('rhythm', '可比对的乐句开口不足。')
  const mean = average(offsets)
  const score = Math.round(clamp(100 - mean * 55))
  return { key: 'rhythm', label: labels.rhythm, score, confidence: Math.min(1, offsets.length / 8), status: 'ok', evidence: `乐句开口平均偏差约 ${Math.round(mean * 1000)}ms。`, suggestion: score < 70 ? '下一次先听清前一拍，再进入第一字。' : '开口位置稳定，可以继续关注句尾时值。', segments: [] }
}

function scoreBreath(frames: PracticeTelemetryFrame[], lines: LyricLine[], valid: boolean): MetricScore {
  if (!valid) return insufficient('breath', '呼吸控制只能在完整乐句中推测。')
  const completed = lines.filter((line) => {
    const inside = frames.filter((frame) => frame.at >= line.start && frame.at <= line.end)
    return inside.filter((frame) => frame.isSinging).length / Math.max(inside.length, 1) >= .68
  })
  const ratio = completed.length / Math.max(lines.length, 1)
  const score = Math.round(clamp(ratio * 100))
  return { key: 'breath', label: labels.breath, score, confidence: Math.min(.8, lines.length / 10), status: 'ok', evidence: `${completed.length}/${lines.length} 个乐句保持了较完整的连续发声。`, suggestion: score < 70 ? '长句开始前留一次完整吸气，先确保句尾不断。' : '乐句完成度不错，下一次关注长音音量衰减。', segments: [] }
}

function scoreExpression(frames: PracticeTelemetryFrame[], lines: LyricLine[], valid: boolean): MetricScore {
  if (!valid) return insufficient('expression', '动态数据不足，无法可靠评价表达。')
  const lineLevels = lines.map((line) => average(frames.filter((frame) => frame.isSinging && frame.at >= line.start && frame.at <= line.end).map((frame) => frame.db))).filter(Number.isFinite)
  if (lineLevels.length < 3) return insufficient('expression', '可比较的乐句动态不足。')
  const range = Math.max(...lineLevels) - Math.min(...lineLevels)
  const score = Math.round(clamp(55 + range * 4))
  return { key: 'expression', label: labels.expression, score, confidence: .55, status: 'ok', evidence: `乐句动态范围约 ${range.toFixed(1)}dB，仅评价声音层次，不推断真实情绪。`, suggestion: score < 70 ? '副歌关键词可以比主歌更突出一点。' : '主副歌已有层次，继续保留自然表达。', segments: [] }
}

function scoreConsistency(frames: PracticeTelemetryFrame[], valid: boolean): MetricScore {
  const pitched = frames.filter((frame) => frame.isSinging && frame.clarity >= .55 && frame.pitchHz > 0)
  if (!valid || pitched.length < 10) return insufficient('consistency', '连续有效音高帧不足。')
  const steps = pitched.slice(1).map((frame, index) => Math.abs(12 * Math.log2(frame.pitchHz / pitched[index].pitchHz))).filter((value) => value < 5)
  const variance = average(steps)
  const score = Math.round(clamp(100 - variance * 20))
  return { key: 'consistency', label: labels.consistency, score, confidence: Math.min(.85, steps.length / 100), status: 'ok', evidence: `相邻有效音高的中位变化约 ${variance.toFixed(2)} 半音。`, suggestion: score < 70 ? '先降低音量，把每句起音和句尾唱稳。' : '整体连续性不错，后半段继续保持。', segments: [] }
}

function selectHighlight(frames: PracticeTelemetryFrame[], lines: LyricLine[]): LyricLine | null {
  return [...lines].map((line) => ({ line, coverage: frames.filter((frame) => frame.isSinging && frame.at >= line.start && frame.at <= line.end).length })).sort((a, b) => b.coverage - a.coverage)[0]?.line ?? null
}

function chooseSuggestion(metrics: MetricScore[]): string {
  const weakest = metrics.filter((metric) => metric.score !== null).sort((a, b) => (a.score ?? 0) - (b.score ?? 0))[0]
  return weakest?.suggestion ?? '先完整唱完两句最熟悉的歌词，小麦会继续记录。'
}

function average(values: number[]): number { return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : Number.NaN }
function clamp(value: number): number { return Math.max(0, Math.min(100, value)) }
