import { describe, expect, it } from 'vitest'
import { buildVisibleReferenceGuideSegments } from './referenceGuide'
import type { ReferenceTrack } from '../../../shared/contracts'

const track: ReferenceTrack = {
  version: '2.0',
  mappingStatus: 'estimated_requires_review',
  notes: [
    { id: 'n1', startSec: 1, endSec: 1.25, midi: 60, lineId: 'line-1', tokenIds: ['t1'], sustained: false },
    { id: 'n2', startSec: 2.4, endSec: 2.8, midi: 64, lineId: 'line-1', tokenIds: ['t4'], sustained: true },
  ],
  tokens: [
    { id: 't1', lineId: 'line-1', text: '那', startSec: 1, endSec: 1.5, type: 'syllable', noteIds: ['n1'] },
    { id: 't2', lineId: 'line-1', text: '在', startSec: 1.5, endSec: 2, type: 'syllable', noteIds: [] },
    { id: 't3', lineId: 'line-1', text: '终', startSec: 2, endSec: 2.5, type: 'syllable', noteIds: [] },
    { id: 't4', lineId: 'line-1', text: '点', startSec: 2.5, endSec: 3, type: 'syllable', noteIds: ['n2'] },
  ],
}

describe('reference guide display segments', () => {
  it('fills lyric tokens with estimated guide bars when reviewed notes are sparse', () => {
    const segments = buildVisibleReferenceGuideSegments(track, .5, 3.5)
    expect(segments).toHaveLength(4)
    expect(segments.map((segment) => segment.source)).toEqual(['reviewed', 'estimated', 'estimated', 'reviewed'])
    expect(segments.map((segment) => segment.startSec)).toEqual([1, 1.5, 2, 2.5])
  })
})
