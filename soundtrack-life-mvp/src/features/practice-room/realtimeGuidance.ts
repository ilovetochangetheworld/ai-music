import type { LyricToken, ReferenceNote, ReferenceTrack } from '../../../shared/contracts'

export type PitchGuidanceState = 'idle' | 'unreliable' | 'transition' | 'accurate' | 'close' | 'high' | 'low'
export type TimingGuidanceState = 'idle' | 'unavailable' | 'on_time' | 'early' | 'late'

export interface GuidanceFrame {
  songTime: number
  pitchHz: number
  clarity: number
  isSinging: boolean
}

export interface GuidanceResult {
  pitchState: PitchGuidanceState
  pitchLabel: string
  timingState: TimingGuidanceState
  timingLabel: string
  centsError: number | null
  normalizedMidi: number | null
  targetNoteId: string | null
  confidence: number
}

export class RealtimeGuidanceTracker {
  private previousSinging = false
  private deviationSince: number | null = null
  private deviationDirection: 'high' | 'low' | null = null
  private octaveVotes = new Map<number, number>()
  private octaveOffset: number | null = null

  constructor(private latencyCompensationSec = .12) {}

  setLatencyCompensation(seconds: number) {
    this.latencyCompensationSec = clamp(seconds, 0, .6)
  }

  update(frame: GuidanceFrame, track: ReferenceTrack): GuidanceResult {
    const referenceTime = Math.max(0, frame.songTime - this.latencyCompensationSec)
    const target = findTargetNote(track.notes, referenceTime)
    const timing = this.detectTiming(frame, track.tokens, track.mappingStatus, referenceTime)

    if (!frame.isSinging) return this.result('idle', '等你开口', timing, null, null, target, frame.clarity)
    if (frame.clarity < .65 || frame.pitchHz < 65 || frame.pitchHz > 1200) return this.result('unreliable', '声音识别中', timing, null, null, target, frame.clarity)
    if (!target) return this.result('idle', '当前没有参考音', timing, null, null, null, frame.clarity)
    if (target.kind === 'transition' || referenceTime - target.startSec < .12) return this.result('transition', '起音中', timing, null, null, target, frame.clarity)

    const userMidi = hzToMidi(frame.pitchHz)
    const octaveCandidate = clamp(Math.round((userMidi - target.midi) / 12), -2, 2)
    this.octaveVotes.set(octaveCandidate, (this.octaveVotes.get(octaveCandidate) ?? 0) + 1)
    if (this.octaveOffset === null && totalVotes(this.octaveVotes) >= 5) this.octaveOffset = mode(this.octaveVotes)
    const normalizedMidi = userMidi - (this.octaveOffset ?? octaveCandidate) * 12
    const centsError = (normalizedMidi - target.midi) * 100
    const tolerance = target.toleranceCents ?? 70
    const absolute = Math.abs(centsError)

    if (absolute <= 30) { this.resetDeviation(); return this.result('accurate', '音准贴合', timing, centsError, normalizedMidi, target, frame.clarity) }
    if (absolute <= tolerance) { this.resetDeviation(); return this.result('close', centsError > 0 ? '稍高一点' : '稍低一点', timing, centsError, normalizedMidi, target, frame.clarity) }

    const direction = centsError > 0 ? 'high' : 'low'
    if (this.deviationDirection !== direction) { this.deviationDirection = direction; this.deviationSince = frame.songTime }
    const stable = this.deviationSince !== null && frame.songTime - this.deviationSince >= .15
    return this.result(stable ? direction : 'close', stable ? (direction === 'high' ? '高了 ↓' : '低了 ↑') : (direction === 'high' ? '稍高一点' : '稍低一点'), timing, centsError, normalizedMidi, target, frame.clarity)
  }

  private detectTiming(frame: GuidanceFrame, tokens: LyricToken[], mappingStatus: ReferenceTrack['mappingStatus'], referenceTime: number): Pick<GuidanceResult, 'timingState' | 'timingLabel'> {
    const onset = frame.isSinging && !this.previousSinging
    this.previousSinging = frame.isSinging
    if (mappingStatus !== 'reviewed') return { timingState: 'unavailable', timingLabel: '逐字节奏待审核' }
    if (!onset) return { timingState: 'idle', timingLabel: '' }
    const token = [...tokens].filter((item) => item.type !== 'punctuation' && Math.abs(item.startSec - referenceTime) <= .5).sort((a, b) => Math.abs(a.startSec - referenceTime) - Math.abs(b.startSec - referenceTime))[0]
    if (!token) return { timingState: 'idle', timingLabel: '' }
    const offset = referenceTime - token.startSec
    if (Math.abs(offset) <= .08) return { timingState: 'on_time', timingLabel: '节奏对齐' }
    return offset < 0 ? { timingState: 'early', timingLabel: '开口偏快' } : { timingState: 'late', timingLabel: '开口偏慢' }
  }

  private result(pitchState: PitchGuidanceState, pitchLabel: string, timing: Pick<GuidanceResult, 'timingState' | 'timingLabel'>, centsError: number | null, normalizedMidi: number | null, target: ReferenceNote | null, confidence: number): GuidanceResult {
    return { pitchState, pitchLabel, ...timing, centsError, normalizedMidi, targetNoteId: target?.id ?? null, confidence }
  }

  private resetDeviation() { this.deviationSince = null; this.deviationDirection = null }
}

function findTargetNote(notes: ReferenceNote[], at: number): ReferenceNote | null { return notes.find((note) => note.scoreable !== false && at >= note.startSec && at < note.endSec) ?? null }
function hzToMidi(hz: number): number { return 69 + 12 * Math.log2(hz / 440) }
function totalVotes(votes: Map<number, number>): number { return [...votes.values()].reduce((sum, value) => sum + value, 0) }
function mode(votes: Map<number, number>): number { return [...votes.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 0 }
function clamp(value: number, low: number, high: number): number { return Math.max(low, Math.min(high, value)) }
