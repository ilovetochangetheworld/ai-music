import { describe, expect, it } from 'vitest'
import type { ReferenceTrack } from '../../../shared/contracts'
import { RealtimeGuidanceTracker } from './realtimeGuidance'

const track: ReferenceTrack = {
  version: '2.0', mappingStatus: 'reviewed',
  notes: [{ id: 'n1', startSec: 1, endSec: 2, midi: 60, lineId: 'l1', tokenIds: ['t1'], kind: 'stable', scoreable: true, toleranceCents: 70, sustained: true }],
  tokens: [{ id: 't1', lineId: 'l1', text: '你', startSec: 1, endSec: 2, type: 'syllable', noteIds: ['n1'] }],
}

describe('real-time singing guidance', () => {
  it('requires a stable deviation before showing high feedback', () => {
    const tracker = new RealtimeGuidanceTracker(0)
    const first = tracker.update({ songTime: 1.3, pitchHz: midiToHz(61), clarity: .9, isSinging: true }, track)
    const stable = tracker.update({ songTime: 1.48, pitchHz: midiToHz(61), clarity: .9, isSinging: true }, track)
    expect(first.pitchState).toBe('close')
    expect(stable.pitchState).toBe('high')
  })

  it('suppresses feedback when pitch confidence is low', () => {
    const result = new RealtimeGuidanceTracker(0).update({ songTime: 1.4, pitchHz: midiToHz(60), clarity: .4, isSinging: true }, track)
    expect(result.pitchState).toBe('unreliable')
    expect(result.centsError).toBeNull()
  })

  it('does not claim word timing for estimated mappings', () => {
    const result = new RealtimeGuidanceTracker(0).update({ songTime: 1, pitchHz: midiToHz(60), clarity: .9, isSinging: true }, { ...track, mappingStatus: 'estimated_requires_review' })
    expect(result.timingState).toBe('unavailable')
  })
})

function midiToHz(midi: number): number { return 440 * 2 ** ((midi - 69) / 12) }
