import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const input = path.join(root, 'music', '周杰伦 - 龙卷风.lrc')
const audioDir = path.join(root, 'public', 'audio', 'tornado')
const catalogDir = path.join(root, 'public', 'catalog', 'tornado')
const crossfade = 0.15
const segments = [
  { start: 107.26, end: 147.73, outputStart: 0 },
  { start: 173.86, end: 214.30, outputStart: round(147.73 - 107.26 - crossfade) },
]
const duration = round(segments[1].outputStart + segments[1].end - segments[1].start)
const timestampPattern = /\[(\d{2}):(\d{2}(?:\.\d+)?)\]/g
const rawLines = []

for (const row of fs.readFileSync(input, 'utf8').replace(/\r\n?/g, '\n').split('\n')) {
  const timestamps = [...row.matchAll(timestampPattern)]
  const lyric = row.replace(timestampPattern, '').trim()
  if (!timestamps.length || !lyric) continue
  for (const match of timestamps) rawLines.push({ start: round(Number(match[1]) * 60 + Number(match[2])), text: lyric })
}
rawLines.sort((a, b) => a.start - b.start)

const selected = rawLines.flatMap((line) => {
  const segment = segments.find((candidate) => line.start >= candidate.start && line.start < candidate.end)
  return segment ? [{ ...line, outputStart: shift(line.start, segment), segment }] : []
})

const lines = selected.map((line, index) => {
  const next = selected[index + 1]
  const section = sectionFor(line.start)
  const segmentEnd = line.segment.outputStart + line.segment.end - line.segment.start
  const end = Math.min(segmentEnd, Math.max(line.outputStart + .9, (next?.outputStart ?? segmentEnd) - .08))
  return {
    id: `tornado-line-${String(index + 1).padStart(2, '0')}`,
    start: line.outputStart,
    end: round(end),
    text: line.text,
    section: section.type,
    rescuable: true,
    harmonyEnabled: section.type === 'chorus',
    breathProtectionMs: section.type === 'chorus' ? 440 : 620,
  }
})

const sections = [
  makeSection('prechorus-2', 'prechorus', '情绪推进', 0, 12.67, true, false),
  makeSection('chorus-2', 'chorus', '第二段副歌', 12.67, 40.47, true, true),
  makeSection('chorus-final', 'chorus', '最终副歌', 40.32, 67.11, true, true),
  makeSection('outro-refrain', 'outro', '尾段回落', 67.11, duration, true, false),
]

const timeline = { songId: 'tornado', title: '龙卷风', artist: '周杰伦', duration, bpm: 72, demoCueSec: 0, sections, lines }
const runtimeManifest = {
  songId: 'tornado', title: '龙卷风', artist: '周杰伦', duration,
  assets: { accompaniment: 'accompaniment.mp3', rescueLead: 'rescue-lead.mp3', harmony: 'harmony.mp3' },
  mix: { accompanimentGain: .82, rescueGain: .64, harmonyGain: .50 },
}
const catalogManifest = {
  version: '1.0', id: 'tornado', title: '龙卷风', artist: '周杰伦', durationSec: duration, difficulty: 4,
  focus: ['rhythm', 'breath', 'expression', 'consistency'],
  assets: {
    accompaniment: 'audio/tornado/accompaniment.mp3', rescueLead: 'audio/tornado/rescue-lead.mp3', harmony: 'audio/tornado/harmony.mp3',
    timeline: 'audio/tornado/timeline.json', notes: 'catalog/tornado/notes.json', phrases: 'catalog/tornado/phrases.json',
  },
  rights: { status: 'prototype', note: 'User-provided prototype asset; commercial/public rights are not established.' },
}
const phrases = lines.map((line) => ({ id: `phrase-${line.id}`, startSec: line.start, endSec: line.end, lineIds: [line.id], breathWindows: [] }))

fs.mkdirSync(audioDir, { recursive: true })
fs.mkdirSync(catalogDir, { recursive: true })
write(path.join(audioDir, 'timeline.json'), timeline)
write(path.join(audioDir, 'manifest.json'), runtimeManifest)
write(path.join(catalogDir, 'manifest.json'), catalogManifest)
write(path.join(catalogDir, 'notes.json'), { version: '1.0', reviewStatus: 'placeholder_requires_manual_review', notes: [] })
write(path.join(catalogDir, 'phrases.json'), { version: '1.0', reviewStatus: 'derived_from_lrc_requires_manual_review', phrases })
console.log(`Wrote ${lines.length} lyric events; tornado clip duration ${duration}s.`)

function sectionFor(at) {
  if (at < 119.93) return { type: 'prechorus' }
  if (at < 200.65) return { type: 'chorus' }
  return { type: 'outro' }
}
function makeSection(id, type, label, start, end, vocalExpected, harmonyEnabled) { return { id, type, label, start, end, vocalExpected, harmonyEnabled } }
function shift(value, segment) { return round(value - segment.start + segment.outputStart) }
function round(value) { return Math.round(value * 1000) / 1000 }
function write(file, value) { fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`) }
