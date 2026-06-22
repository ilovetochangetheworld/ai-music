import type { LyricToken, ReferenceNote, ReferenceTrack } from '../../../shared/contracts'
import type { LyricLine } from '../sing-room/types'

const punctuation = /[，。！？、；：,.!?;:]/

/** Converts reviewed V1 notes into a display-only V2 token map.
 * The estimated mapping must not be used for authoritative word-level rhythm scoring.
 */
export function buildEstimatedReferenceTrack(notes: ReferenceNote[], lines: LyricLine[]): ReferenceTrack {
  const nextNotes = notes.map((note, index) => ({
    ...note,
    id: note.id ?? `note-${index + 1}`,
    tokenIds: [] as string[],
    kind: note.kind ?? 'stable' as const,
    scoreable: note.scoreable ?? true,
    toleranceCents: note.toleranceCents ?? (note.sustained ? 50 : 70),
  }))
  const tokens: LyricToken[] = []

  for (const line of lines) {
    const characters = Array.from(line.text).filter((text) => text.trim().length > 0)
    const duration = Math.max(.01, line.end - line.start)
    characters.forEach((text, index) => {
      const id = `${line.id}-token-${index + 1}`
      const startSec = line.start + duration * index / characters.length
      const endSec = line.start + duration * (index + 1) / characters.length
      const noteIds = nextNotes.filter((note) => note.lineId === line.id && midpoint(note) >= startSec && midpoint(note) < endSec).map((note) => note.id as string)
      const token: LyricToken = { id, lineId: line.id, text, startSec, endSec, type: punctuation.test(text) ? 'punctuation' : 'syllable', noteIds }
      tokens.push(token)
      for (const note of nextNotes) if (noteIds.includes(note.id as string)) note.tokenIds.push(id)
    })
  }

  return { version: '2.0', mappingStatus: 'estimated_requires_review', notes: nextNotes, tokens }
}

function midpoint(note: ReferenceNote): number { return (note.startSec + note.endSec) / 2 }
