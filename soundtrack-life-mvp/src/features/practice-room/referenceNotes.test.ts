import { describe, expect, it } from 'vitest'
import { reviewedReferenceNotes } from './referenceNotes'

const note = { startSec: 1, endSec: 1.5, midi: 60, lineId: 'line-1', sustained: false }

describe('reference note review gate', () => {
  it('rejects generated candidates even when notes are present', () => {
    expect(reviewedReferenceNotes({ reviewStatus: 'auto_generated_requires_review', notes: [note] })).toEqual([])
  })

  it('accepts structurally valid reviewed notes only', () => {
    expect(reviewedReferenceNotes({ reviewStatus: 'reviewed', notes: [note, { ...note, endSec: .5 }] })).toEqual([note])
  })
})
