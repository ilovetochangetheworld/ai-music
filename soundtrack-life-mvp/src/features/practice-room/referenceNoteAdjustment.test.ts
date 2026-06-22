import { describe, expect, it } from 'vitest'
import type { ReferenceNote } from '../../../shared/contracts'
import type { SongTimeline } from '../sing-room/types'
import { autoAdjustReferenceNotes } from './referenceNoteAdjustment'

const timeline: SongTimeline = {
  songId: 'test', title: 'Test', artist: 'Test', duration: 10, bpm: 80, demoCueSec: 0, sections: [],
  lines: [{ id: 'line-1', start: 1, end: 4, text: '一句歌词', section: 'verse', rescuable: true, harmonyEnabled: false, breathProtectionMs: 0 }],
}

describe('reference note automatic adjustment', () => {
  it('chooses smooth octave equivalents and clamps notes into the lyric window', () => {
    const notes: ReferenceNote[] = [
      { startSec: .8, endSec: 1.4, midi: 48, lineId: 'line-1', sustained: false },
      { startSec: 1.5, endSec: 4.2, midi: 73, lineId: 'line-1', sustained: true },
    ]
    const result = autoAdjustReferenceNotes(notes, timeline)

    expect(result.changedCount).toBe(2)
    expect(result.notes[0].startSec).toBe(1)
    expect(result.notes[1].endSec).toBe(4)
    expect(Math.abs(result.notes[0].midi - result.notes[1].midi)).toBeLessThan(10)
  })

  it('never invents notes for an uncovered lyric line', () => {
    const result = autoAdjustReferenceNotes([], timeline)
    expect(result).toEqual({ notes: [], changedCount: 0 })
  })

  it('leaves lines outside the requested risk set untouched', () => {
    const note: ReferenceNote = { startSec: .8, endSec: 4.2, midi: 30, lineId: 'line-1', sustained: false }
    const result = autoAdjustReferenceNotes([note], timeline, new Set(['another-line']))
    expect(result).toEqual({ notes: [note], changedCount: 0 })
  })
})
