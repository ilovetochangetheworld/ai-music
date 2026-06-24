import { describe, expect, it } from 'vitest'
import { buildLocalPracticeReport } from './scoring'

describe('practice scoring quality gates', () => {
  it('does not emit a total score when singing coverage is insufficient', () => {
    const report = buildLocalPracticeReport({ sessionId: 'empty', songId: 'trajectory', frames: [], lines: [], notes: [], noiseFloorDb: -58 })
    expect(report.status).toBe('insufficient_data')
    expect(report.overallScore).toBeNull()
    expect(report.metrics.every((metric) => metric.score === null)).toBe(true)
  })

  it('does not invent pitch accuracy without reviewed reference notes', () => {
    const lines = [
      { id: 'l1', start: 0, end: 3, text: '第一句', section: 'verse' as const, rescuable: true, harmonyEnabled: false, breathProtectionMs: 250 },
      { id: 'l2', start: 3, end: 6, text: '第二句', section: 'chorus' as const, rescuable: true, harmonyEnabled: true, breathProtectionMs: 250 },
      { id: 'l3', start: 6, end: 9, text: '第三句', section: 'chorus' as const, rescuable: true, harmonyEnabled: true, breathProtectionMs: 250 },
    ]
    const frames = Array.from({ length: 113 }, (_, index) => ({
      at: index * 0.08, db: -24 + index % 8, pitchHz: 440, clarity: 0.9, vadProbability: 0.9, isSinging: true,
    }))
    const report = buildLocalPracticeReport({ sessionId: 'no-reference', songId: 'trajectory', frames, lines, notes: [], noiseFloorDb: -58 })
    expect(report.metrics.find((metric) => metric.key === 'pitch')?.score).toBeNull()
    expect(report.overallScore).toBeNull()
  })

  it('applies only valid latency calibration to timeline-based metrics', () => {
    const lines = [
      { id: 'l1', start: 0, end: 2, text: '第一句', section: 'verse' as const, rescuable: true, harmonyEnabled: false, breathProtectionMs: 250 },
      { id: 'l2', start: 3, end: 5, text: '第二句', section: 'chorus' as const, rescuable: true, harmonyEnabled: true, breathProtectionMs: 250 },
      { id: 'l3', start: 6, end: 8, text: '第三句', section: 'chorus' as const, rescuable: true, harmonyEnabled: true, breathProtectionMs: 250 },
    ]
    const frames = [0.1, 3.1, 6.1].flatMap((start) => Array.from({ length: 20 }, (_, index) => ({
      at: start + index * .08, db: -22, pitchHz: 440, clarity: .9, vadProbability: .9, isSinging: true,
    })))
    const calibration = {
      version: '1.0' as const, method: 'user_tap' as const, offsetMs: 100, jitterMs: 8, sampleCount: 6,
      confidence: 'high' as const, status: 'valid' as const, sampleRateHz: 48000,
      createdAt: '2026-06-22T00:00:00.000Z', expiresAt: '2026-07-22T00:00:00.000Z',
    }
    const report = buildLocalPracticeReport({ sessionId: 'latency', songId: 'trajectory', frames, lines, notes: [], noiseFloorDb: -58, latencyCalibration: calibration })
    expect(report.dataQuality.latencyCorrectionMs).toBe(100)
    expect(report.metrics.find((metric) => metric.key === 'rhythm')?.evidence).toContain('0ms')
  })
})
