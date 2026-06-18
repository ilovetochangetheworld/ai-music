import type { LyricLine, SingEvent, SingingRecap, VocalFrameSample, VocalReview } from './types'

export function buildRecap(events: SingEvent[], lines: LyricLine[], duration: number, samples: VocalFrameSample[] = [], sessionStart = 0): SingingRecap {
  const started = events.filter((event) => event.type === 'USER_STARTED').map((event) => event.at)
  const stopped = events.filter((event) => event.type === 'USER_STOPPED').map((event) => event.at)
  const intervals: Array<[number, number]> = []

  for (let index = 0; index < started.length; index += 1) {
    const start = started[index]
    const end = stopped.find((time) => time > start) ?? duration
    intervals.push([start, end])
  }

  const vocalDuration = lines.reduce((sum, line) => sum + Math.max(0, line.end - line.start), 0) || duration
  const rangeStart = lines[0]?.start ?? 0
  const rangeEnd = lines.length ? lines[lines.length - 1].end : duration
  const firstBoundary = rangeStart + (rangeEnd - rangeStart) / 2
  const sungDuration = sumIntervals(intervals)
  const firstHalf = sumIntervals(intersectIntervals(intervals, rangeStart, firstBoundary))
  const secondHalf = sumIntervals(intersectIntervals(intervals, firstBoundary, rangeEnd))
  const longest = intervals.reduce((max, [start, end]) => Math.max(max, end - start), 0)
  const rescueCount = events.filter((event) => event.type === 'RESCUE_STARTED').length
  const recoveredRescueCount = events.filter((event) => event.type === 'RESCUE_ENDED' && event.recovered).length
  const highlight = lines
    .filter((line) => intervals.some(([start, end]) => start <= line.start + 0.4 && end >= line.end - 0.4))
    .sort((a, b) => (b.end - b.start) - (a.end - a.start))[0]

  const facts = {
    participationRate: clamp(sungDuration / vocalDuration),
    rescueCount,
    recoveredRescueCount,
    longestContinuousSingingSec: longest,
    highlightLineId: highlight?.id ?? null,
    highlightStartSec: highlight ? Math.max(0, highlight.start - sessionStart) : null,
    highlightEndSec: highlight ? Math.max(0, highlight.end - sessionStart) : null,
    firstHalfParticipation: clamp(firstHalf / Math.max(firstBoundary - rangeStart, 1)),
    secondHalfParticipation: clamp(secondHalf / Math.max(rangeEnd - firstBoundary, 1)),
  }
  return { ...facts, review: buildVocalReview(facts, samples), events }
}

export function saveRecap(recap: SingingRecap): void {
  sessionStorage.setItem('sing-room-trajectory-recap', JSON.stringify(recap))
}

export function loadRecap(): SingingRecap | null {
  try {
    const value = sessionStorage.getItem('sing-room-trajectory-recap')
    return value ? JSON.parse(value) as SingingRecap : null
  } catch {
    return null
  }
}

function sumIntervals(intervals: Array<[number, number]>): number {
  return intervals.reduce((sum, [start, end]) => sum + Math.max(0, end - start), 0)
}

function intersectIntervals(intervals: Array<[number, number]>, start: number, end: number): Array<[number, number]> {
  return intervals
    .map(([from, to]) => [Math.max(from, start), Math.min(to, end)] as [number, number])
    .filter(([from, to]) => to > from)
}

function clamp(value: number): number {
  return Math.max(0, Math.min(1, value))
}

function buildVocalReview(
  facts: Pick<SingingRecap, 'participationRate' | 'recoveredRescueCount' | 'rescueCount' | 'longestContinuousSingingSec' | 'firstHalfParticipation' | 'secondHalfParticipation'>,
  samples: VocalFrameSample[],
): VocalReview {
  const active = samples.filter((sample) => sample.isSinging)
  const pitched = active.filter((sample) => sample.pitch >= 70 && sample.pitch <= 1100 && sample.clarity >= 0.55)
  const clarity = active.length ? Math.round(average(active.map((sample) => sample.clarity)) * 100) : null
  const pitchSteps: number[] = []
  for (let index = 1; index < pitched.length; index += 1) {
    const previous = pitched[index - 1]
    const current = pitched[index]
    if (current.at - previous.at <= 0.22) pitchSteps.push(Math.abs(12 * Math.log2(current.pitch / previous.pitch)))
  }
  const medianStep = median(pitchSteps)
  const pitchContinuity = medianStep === null ? null : Math.round(clamp(1 - medianStep / 2.5) * 100)
  const recovery = facts.rescueCount ? Math.round((facts.recoveredRescueCount / facts.rescueCount) * 100) : null
  const engagement = Math.round(facts.participationRate * 100)
  const openedUp = facts.secondHalfParticipation > facts.firstHalfParticipation + 0.03

  let headline = '你按自己的节奏，把这一首唱完了。'
  if (facts.recoveredRescueCount > 0) headline = `阿和接唱后，你成功把主唱接回了 ${facts.recoveredRescueCount} 次。`
  else if (openedUp) headline = '后半段你明显更敢开口，声音慢慢舒展开了。'
  else if (facts.longestContinuousSingingSec >= 12) headline = `你最长连续唱了 ${Math.round(facts.longestContinuousSingingSec)} 秒，这段很完整。`

  const detailParts = [`可唱段落里，你参与了 ${engagement}%`]
  if (clarity !== null) detailParts.push(`有效演唱帧的平均清晰度为 ${clarity}%`)
  if (pitchContinuity !== null) detailParts.push(`音高连续性为 ${pitchContinuity}%`)

  let suggestion = '再唱一次时，可以挑一句最喜欢的歌词，把句尾多留半拍。'
  if (engagement < 45) suggestion = '下一次不用追求唱满，先选两句最熟的歌词完整开口。'
  else if (clarity !== null && clarity < 65) suggestion = '建议靠近麦克风一点并戴上耳机，让人声检测更清楚。'
  else if (pitchContinuity !== null && pitchContinuity < 55) suggestion = '长音处先轻一点，保持气流均匀，会更容易唱得连贯。'
  else if (facts.recoveredRescueCount > 0) suggestion = '你已经会把歌接回来；下一次可以试着在阿和淡出前半拍开口。'

  return {
    engagement,
    clarity,
    pitchContinuity,
    recovery,
    headline,
    detail: `${detailParts.join('；')}。`,
    suggestion,
  }
}

function average(values: number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / Math.max(values.length, 1)
}

function median(values: number[]): number | null {
  if (!values.length) return null
  const sorted = [...values].sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2
}
