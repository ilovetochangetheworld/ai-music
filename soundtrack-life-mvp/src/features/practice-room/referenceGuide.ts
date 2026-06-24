import type { ReferenceNote, ReferenceTrack } from '../../../shared/contracts'

export interface ReferenceGuideSegment {
  id: string
  startSec: number
  endSec: number
  midi: number
  noteIds: string[]
  source: 'reviewed' | 'estimated'
}

export function buildVisibleReferenceGuideSegments(track: ReferenceTrack, windowStart: number, windowEnd: number): ReferenceGuideSegment[] {
  const visibleNotes = track.notes.filter((note) => note.endSec >= windowStart && note.startSec <= windowEnd)
  const visibleTokens = track.tokens.filter((token) => token.endSec >= windowStart && token.startSec <= windowEnd && token.type !== 'punctuation')
  if (!visibleTokens.length) return visibleNotes.map((note, index) => noteSegment(note, index))

  const notesById = new Map(track.notes.map((note, index) => [note.id ?? `note-${index + 1}`, note]))
  const notesByLine = new Map<string, ReferenceNote[]>()
  for (const note of track.notes) notesByLine.set(note.lineId, [...(notesByLine.get(note.lineId) ?? []), note])

  return visibleTokens.flatMap((token) => {
    const explicitNotes = token.noteIds.map((id) => notesById.get(id)).filter((note): note is ReferenceNote => Boolean(note))
    const candidates = explicitNotes.length ? explicitNotes : notesByLine.get(token.lineId) ?? track.notes
    if (!candidates.length) return []
    const tokenMid = (token.startSec + token.endSec) / 2
    const nearest = [...candidates].sort((a, b) => Math.abs(midpoint(a) - tokenMid) - Math.abs(midpoint(b) - tokenMid))[0]
    const midi = explicitNotes.length ? average(explicitNotes.map((note) => note.midi)) : nearest.midi
    return [{
      id: `token-guide-${token.id}`,
      startSec: token.startSec,
      endSec: token.endSec,
      midi,
      noteIds: explicitNotes.map((note) => note.id).filter((id): id is string => Boolean(id)),
      source: explicitNotes.length ? 'reviewed' : 'estimated',
    }]
  })
}

function noteSegment(note: ReferenceNote, index: number): ReferenceGuideSegment {
  return { id: note.id ?? `note-guide-${index + 1}`, startSec: note.startSec, endSec: note.endSec, midi: note.midi, noteIds: note.id ? [note.id] : [], source: 'reviewed' }
}

function midpoint(note: ReferenceNote): number { return (note.startSec + note.endSec) / 2 }
function average(values: number[]): number { return values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length) }
