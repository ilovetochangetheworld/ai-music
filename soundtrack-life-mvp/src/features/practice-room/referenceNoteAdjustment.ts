import type { ReferenceNote } from '../../../shared/contracts'
import type { SongTimeline } from '../sing-room/types'

export interface ReferenceNoteAdjustmentResult {
  notes: ReferenceNote[]
  changedCount: number
}

/**
 * Builds a conservative review draft. It only changes octave-equivalent pitches
 * and trims timing to existing lyric windows; it never creates or removes notes.
 */
export function autoAdjustReferenceNotes(notes: ReferenceNote[], timeline: SongTimeline, targetLineIds?: ReadonlySet<string>): ReferenceNoteAdjustmentResult {
  const adjusted = notes.map((note) => ({ ...note }))
  const center = median(notes.map((note) => note.midi).sort((a, b) => a - b)) ?? 60
  const lines = new Map(timeline.lines.map((line) => [line.id, line]))
  const groups = new Map<string, Array<{ index: number; note: ReferenceNote }>>()

  notes.forEach((note, index) => groups.set(note.lineId, [...(groups.get(note.lineId) ?? []), { index, note }]))
  for (const [lineId, items] of groups) {
    if (targetLineIds && !targetLineIds.has(lineId)) continue
    const candidates = items.map(({ note }) => octaveCandidates(note.midi))
    let states = candidates[0].map((value) => ({ value, cost: Math.abs(value - center) * .08, path: [value] }))

    for (let position = 1; position < candidates.length; position += 1) {
      states = candidates[position].map((value) => states.map((previous) => ({
        value,
        cost: previous.cost + Math.abs(value - previous.value) ** 2 + Math.abs(value - center) * .08,
        path: [...previous.path, value],
      })).sort((a, b) => a.cost - b.cost)[0])
    }

    const best = [...states].sort((a, b) => a.cost - b.cost)[0]
    items.forEach(({ index, note }, position) => {
      const line = lines.get(note.lineId)
      adjusted[index].midi = best.path[position]
      if (line) {
        adjusted[index].startSec = Math.max(note.startSec, line.start)
        adjusted[index].endSec = Math.min(note.endSec, line.end)
      }
    })
  }

  return {
    notes: adjusted,
    changedCount: adjusted.filter((note, index) => !sameNote(note, notes[index])).length,
  }
}

function octaveCandidates(midi: number): number[] {
  const values: number[] = []
  for (let octave = -3; octave <= 3; octave += 1) {
    const value = midi + octave * 12
    if (value >= 36 && value <= 76) values.push(value)
  }
  return values.length ? values : [Math.min(76, Math.max(36, midi))]
}

function sameNote(left: ReferenceNote, right: ReferenceNote): boolean {
  return left.midi === right.midi && left.startSec === right.startSec && left.endSec === right.endSec
}

function median(values: number[]): number | null {
  return values.length ? values[Math.floor(values.length / 2)] : null
}
