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
})
