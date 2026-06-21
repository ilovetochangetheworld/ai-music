#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'

const [notesPath, timelinePath] = process.argv.slice(2)
if (!notesPath || !timelinePath) {
  console.error('Usage: node audit-reference-notes.mjs <notes.candidate.json> <timeline.json>')
  process.exit(2)
}

const payload = JSON.parse(fs.readFileSync(path.resolve(notesPath), 'utf8'))
const timeline = JSON.parse(fs.readFileSync(path.resolve(timelinePath), 'utf8'))
const notes = Array.isArray(payload.notes) ? payload.notes : []
const lines = new Map((timeline.lines ?? []).map((line) => [line.id, line]))
const sortedMidi = notes.map((note) => note.midi).filter(Number.isFinite).sort((a, b) => a - b)
const medianMidi = median(sortedMidi)
const findings = []

for (const [index, note] of notes.entries()) {
  const line = lines.get(note.lineId)
  if (!line) findings.push(finding(index, note, 'unknown_line', 'high'))
  else if (note.startSec < line.start - .08 || note.endSec > line.end + .08) findings.push(finding(index, note, 'outside_line_window', 'high'))
  if (!Number.isFinite(note.midi) || note.midi < 0 || note.midi > 127) findings.push(finding(index, note, 'invalid_midi', 'high'))
  if (note.endSec - note.startSec < .14) findings.push(finding(index, note, 'short_fragment', 'medium'))
  if (medianMidi !== null && Math.abs(note.midi - medianMidi) >= 12) findings.push(finding(index, note, 'global_octave_outlier', 'high'))
  const previous = notes[index - 1]
  if (previous?.lineId === note.lineId && Math.abs(previous.midi - note.midi) >= 10) findings.push(finding(index, note, 'local_octave_jump', 'high'))
}

const lineCoverage = [...lines.values()].map((line) => {
  const lineNotes = notes.filter((note) => note.lineId === line.id)
  const voiced = lineNotes.reduce((sum, note) => sum + Math.max(0, note.endSec - note.startSec), 0)
  return { lineId: line.id, lyric: line.text, notes: lineNotes.length, coverage: round(voiced / Math.max(.01, line.end - line.start)) }
})
const missingLines = lineCoverage.filter((line) => line.notes === 0)
const lowCoverageLines = lineCoverage.filter((line) => line.coverage < .18)
const highFindings = findings.filter((item) => item.severity === 'high')
const report = {
  source: notesPath,
  reviewStatus: payload.reviewStatus,
  summary: {
    notes: notes.length,
    midiRange: sortedMidi.length ? [sortedMidi[0], sortedMidi[sortedMidi.length - 1]] : [],
    medianMidi,
    highFindings: highFindings.length,
    mediumFindings: findings.length - highFindings.length,
    missingLines: missingLines.length,
    lowCoverageLines: lowCoverageLines.length,
    promotable: payload.reviewStatus === 'reviewed' && highFindings.length === 0 && missingLines.length === 0,
  },
  findings,
  lineCoverage,
}
console.log(JSON.stringify(report, null, 2))
if (highFindings.length || missingLines.length) process.exitCode = 1

function finding(index, note, code, severity) { return { index, lineId: note.lineId, startSec: note.startSec, endSec: note.endSec, midi: note.midi, code, severity } }
function median(values) { return values.length ? values[Math.floor(values.length / 2)] : null }
function round(value) { return Math.round(value * 1000) / 1000 }
