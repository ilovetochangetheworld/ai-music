import type { ReferenceNote } from '../../../shared/contracts'

export interface ReferenceNotesFile {
  version?: string
  reviewStatus?: string
  notes?: ReferenceNote[]
}

export function reviewedReferenceNotes(payload: ReferenceNotesFile | null): ReferenceNote[] {
  if (payload?.reviewStatus !== 'reviewed' || !Array.isArray(payload.notes)) return []
  return payload.notes.filter((note) => (
    Number.isFinite(note.startSec) && Number.isFinite(note.endSec) && Number.isFinite(note.midi)
    && note.startSec >= 0 && note.endSec > note.startSec && note.midi >= 0 && note.midi <= 127
    && typeof note.lineId === 'string'
  ))
}
