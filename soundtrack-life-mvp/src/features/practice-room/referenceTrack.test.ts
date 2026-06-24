import { describe, expect, it } from 'vitest'
import { buildEstimatedReferenceTrack } from './referenceTrack'

const line = { id: 'line-1', start: 1, end: 3, text: '你好吗', section: 'verse' as const, rescuable: true, harmonyEnabled: false, breathProtectionMs: 0 }

describe('reference track V1 compatibility', () => {
  it('creates monotonic lyric tokens and maps notes without claiming review', () => {
    const track = buildEstimatedReferenceTrack([
      { startSec: 1.1, endSec: 1.4, midi: 60, lineId: 'line-1', sustained: false },
      { startSec: 2.4, endSec: 2.8, midi: 64, lineId: 'line-1', sustained: true },
    ], [line])
    expect(track.mappingStatus).toBe('estimated_requires_review')
    expect(track.tokens.map((token) => token.text)).toEqual(['你', '好', '吗'])
    expect(track.notes.every((note) => note.id && note.kind && note.toleranceCents)).toBe(true)
    expect(track.tokens.flatMap((token) => token.noteIds)).toHaveLength(2)
  })
})
