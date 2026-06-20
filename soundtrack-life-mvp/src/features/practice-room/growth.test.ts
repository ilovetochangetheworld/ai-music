import { describe, expect, it } from 'vitest'
import { buildMetricTrends, type GrowthEntry } from './growth'

describe('growth metric trends', () => {
  it('compares the latest three valid scores with the previous three', () => {
    const entries = Array.from({ length: 6 }, (_, index): GrowthEntry => ({
      id: String(index), songId: 'song', createdAt: new Date(2026, 0, 6 - index).toISOString(), overallScore: 70,
      metrics: [{ key: 'pitch', score: 80 - index * 2, confidence: .8 }],
    }))
    const pitch = buildMetricTrends(entries).find((item) => item.key === 'pitch')
    expect(pitch?.latest).toBe(80)
    expect(pitch?.delta).toBe(6)
    expect(pitch?.validSessions).toBe(6)
  })

  it('ignores insufficient scores', () => {
    const entries: GrowthEntry[] = [{ id: '1', songId: 'song', createdAt: new Date().toISOString(), overallScore: null, metrics: [{ key: 'pitch', score: null, confidence: 0 }] }]
    expect(buildMetricTrends(entries)[0].validSessions).toBe(0)
  })
})
