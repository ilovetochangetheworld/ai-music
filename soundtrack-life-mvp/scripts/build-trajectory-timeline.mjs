import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const input = path.join(root, 'music', '周杰伦 - 轨迹.lrc')
const outputDir = path.join(root, 'public', 'audio', 'trajectory')
const sourceDuration = 326.9291
const clipStart = 187.49
const clipEnd = 267.53
const duration = round(clipEnd - clipStart)

const source = fs.readFileSync(input)
const text = new TextDecoder('gb18030').decode(source).replace(/\r\n?/g, '\n')
const timestampPattern = /\[(\d{2}):(\d{2}(?:\.\d+)?)\]/g
const rawLines = []

for (const row of text.split('\n')) {
  const timestamps = [...row.matchAll(timestampPattern)]
  const lyric = row.replace(timestampPattern, '').trim()
  if (!timestamps.length || !lyric) continue
  if (/^(周杰伦\s*-\s*轨迹|作词|作曲)/.test(lyric)) continue

  for (const match of timestamps) {
    const at = Number(match[1]) * 60 + Number(match[2])
    if (!Number.isFinite(at) || at < 0 || at >= sourceDuration) continue
    rawLines.push({ start: round(at), text: lyric })
  }
}

rawLines.sort((a, b) => a.start - b.start)

const sourceSections = [
  section('intro', 'intro', '前奏', 0, 19.23, false, false),
  section('verse-1', 'verse', '第一段主歌', 19.23, 70.54, true, false),
  section('prechorus-1', 'prechorus', '第一次情绪推进', 70.54, 95.67, true, false),
  section('chorus-1', 'chorus', '第一段副歌', 95.67, 146, true, true),
  section('interlude', 'interlude', '间奏', 146, 161.83, false, false),
  section('verse-2', 'verse', '第二段主歌', 161.83, 187.49, true, false),
  section('prechorus-2', 'prechorus', '第二次情绪推进', 187.49, 212.79, true, false),
  section('chorus-2', 'chorus', '第二段副歌', 212.79, 241.28, true, true),
  section('chorus-final', 'chorus', '最终副歌', 241.28, 303.5, true, true),
  section('outro', 'outro', '尾奏', 303.5, sourceDuration, false, false),
]

const sections = sourceSections
    .filter((item) => item.end > clipStart && item.start < clipEnd)
    .map((item) => ({
      ...item,
      start: shift(Math.max(item.start, clipStart)),
      end: shift(Math.min(item.end, clipEnd)),
    }))

const sourceLines = rawLines.map((line, index) => {
  const currentSection = [...sourceSections].reverse().find((candidate) => line.start >= candidate.start) ?? sourceSections[0]
  const nextStart = rawLines[index + 1]?.start ?? currentSection.end
  const end = Math.min(currentSection.end, Math.max(line.start + 1.2, nextStart - 0.08))
  return {
    id: `trajectory-line-${String(index + 1).padStart(2, '0')}`,
    start: round(line.start),
    end: round(end),
    text: line.text,
    section: currentSection.type,
    rescuable: currentSection.vocalExpected,
    harmonyEnabled: currentSection.harmonyEnabled,
    breathProtectionMs: currentSection.type === 'chorus' ? 520 : 680,
  }
})

const lines = sourceLines
  .filter((line) => line.start >= clipStart && line.start < clipEnd)
  .map((line) => ({
    ...line,
    start: shift(line.start),
    end: shift(Math.min(line.end, clipEnd)),
  }))

const timeline = {
  songId: 'trajectory',
  title: '轨迹',
  artist: '周杰伦',
  duration,
  bpm: 74,
  demoCueSec: 0,
  sections,
  lines,
}

const manifest = {
  songId: 'trajectory',
  title: '轨迹',
  artist: '周杰伦',
  duration,
  assets: {
    accompaniment: 'accompaniment.mp3',
    rescueLead: 'rescue-lead.mp3',
    harmony: 'harmony.mp3',
  },
  mix: {
    accompanimentGain: 0.82,
    rescueGain: 0.66,
    harmonyGain: 0.55,
  },
}

fs.mkdirSync(outputDir, { recursive: true })
fs.writeFileSync(path.join(outputDir, 'timeline.json'), `${JSON.stringify(timeline, null, 2)}\n`)
fs.writeFileSync(path.join(outputDir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`)
console.log(`Wrote ${lines.length} lyric events to ${path.relative(root, outputDir)}`)

function section(id, type, label, start, end, vocalExpected, harmonyEnabled) {
  return { id, type, label, start, end, vocalExpected, harmonyEnabled }
}

function round(value) {
  return Math.round(value * 1000) / 1000
}

function shift(value) {
  return round(value - clipStart)
}
