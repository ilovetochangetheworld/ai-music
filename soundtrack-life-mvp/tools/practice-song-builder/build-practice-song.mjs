#!/usr/bin/env node
// 配置驱动的「AI 练歌房」练习曲契约生成器。
// 由 LRC + 段落配置生成 timeline / runtime manifest / catalog manifest / phrases /
// notes 占位，并把条目写入 catalog/index.json。仅产出确定性 JSON 契约，不碰音频、
// 不计算音准分（音准依赖人工校正的参考旋律，见 generate-reference-notes.py）。
//
// 用法：
//   node build-practice-song.mjs <song-config.json> [--repo <soundtrack-life-mvp 路径>] [--dry-run]
//
// 契约来源（务必与之保持一致）：soundtrack-life-mvp/shared/contracts.ts
//   ReferenceNote / ReferencePhrase / PracticeSongManifest
// 以及 src/features/sing-room/types.ts 的 SongTimeline / LyricLine / SongManifest。

import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'

const args = process.argv.slice(2)
const dryRun = args.includes('--dry-run')
const repoIdx = args.indexOf('--repo')
const positional = args.filter((a, i) => !a.startsWith('--') && i !== (repoIdx >= 0 ? repoIdx + 1 : -1))
const configPath = positional[0]
if (!configPath) fail('缺少歌曲配置文件。用法：node build-practice-song.mjs <song-config.json> [--repo <path>] [--dry-run]')

const config = readJson(path.resolve(configPath))
const configDir = path.dirname(path.resolve(configPath))

const repoArg = repoIdx >= 0 ? args[repoIdx + 1] : config.repoRoot
const repoRoot = path.resolve(repoArg ?? findRepoRoot())
const publicDir = path.join(repoRoot, 'public')
if (!fs.existsSync(publicDir)) fail(`未找到 public/ 目录：${publicDir}（请用 --repo 指向 soundtrack-life-mvp）`)

// ---- 校验必填字段 ----
const id = requireField('id')
const title = requireField('title')
const artist = requireField('artist')
const segments = Array.isArray(config.segments) && config.segments.length ? config.segments : null
if (!segments) fail('config.segments 必填：源音频中的练习片段 [{start,end}, ...]（单位秒，源时间轴）。')
const crossfade = num(config.crossfade, 0.15)
const bpm = num(config.bpm, 0)
const difficulty = clampInt(config.difficulty ?? 3, 1, 5)
const demoCueSec = num(config.demoCueSec, 0)
const focus = Array.isArray(config.focus) && config.focus.length ? config.focus : ['rhythm', 'breath', 'consistency']
const rightsNote = String(config.rightsNote ?? 'User-provided prototype asset; commercial/public rights are not established.')
const breathDefault = num(config.breathProtectionMs?.default, 620)
const breathChorus = num(config.breathProtectionMs?.chorus, 440)
const mix = {
  accompanimentGain: num(config.mix?.accompanimentGain, 0.82),
  rescueGain: num(config.mix?.rescueGain, 0.64),
  harmonyGain: num(config.mix?.harmonyGain, 0.5),
}

// ---- 计算输出时间轴（拼接多个源片段，含交叉淡变折算）----
let cursor = 0
const placedSegments = segments.map((seg, index) => {
  const start = num(seg.start)
  const end = num(seg.end)
  if (!(end > start)) fail(`segments[${index}] 非法：end 必须大于 start。`)
  const outputStart = round(cursor)
  cursor = round(cursor + (end - start) - (index < segments.length - 1 ? crossfade : 0))
  return { start, end, outputStart }
})
const duration = round(placedSegments[placedSegments.length - 1].outputStart +
  (placedSegments[placedSegments.length - 1].end - placedSegments[placedSegments.length - 1].start))

// ---- 解析 LRC（源时间轴）→ 折算到输出时间轴 ----
const lrcPath = path.resolve(configDir, requireField('lrc'))
if (!fs.existsSync(lrcPath)) fail(`未找到歌词文件：${lrcPath}`)
const lrcEncoding = String(config.encoding ?? 'utf-8')
const minLineSec = num(config.minLineSec, 0.9)
const lyricFilters = (Array.isArray(config.lyricFilter) ? config.lyricFilter : []).map((p) => new RegExp(p))
let lrcText
try {
  lrcText = new TextDecoder(lrcEncoding, { fatal: false }).decode(fs.readFileSync(lrcPath))
} catch (e) {
  fail(`不支持的歌词编码 "${lrcEncoding}"：${e.message}（可用 utf-8 / gb18030 / gbk 等）`)
}
const rawLines = parseLrc(lrcText)
const selected = rawLines.flatMap((line) => {
  const seg = placedSegments.find((s) => line.start >= s.start && line.start < s.end)
  return seg ? [{ ...line, outputStart: round(line.start - seg.start + seg.outputStart), seg }] : []
})
if (!selected.length) fail('没有任何歌词落在 segments 指定的片段内，请检查 LRC 时间戳与 segments 是否匹配。')

// ---- 段落（输出时间轴）----
const sections = buildSections(config.sections, duration)

const lines = selected.map((line, index) => {
  const next = selected[index + 1]
  const segEnd = round(line.seg.outputStart + (line.seg.end - line.seg.start))
  const end = round(Math.min(segEnd, Math.max(line.outputStart + minLineSec, (next?.outputStart ?? segEnd) - 0.08)))
  const section = sectionTypeAt(sections, line.outputStart)
  const inHarmonySection = sections.some((s) => s.harmonyEnabled && line.outputStart >= s.start && line.outputStart < s.end)
  return {
    id: `${id}-line-${String(index + 1).padStart(2, '0')}`,
    start: line.outputStart,
    end,
    text: line.text,
    section,
    rescuable: true,
    harmonyEnabled: inHarmonySection,
    breathProtectionMs: section === 'chorus' ? breathChorus : breathDefault,
  }
})

// ---- 组装各产物（与契约严格一致）----
const timeline = { songId: id, title, artist, duration, bpm, demoCueSec, sections, lines }
const runtimeManifest = {
  songId: id, title, artist, duration,
  assets: { accompaniment: 'accompaniment.mp3', rescueLead: 'rescue-lead.mp3', harmony: 'harmony.mp3' },
  mix,
}
const catalogManifest = {
  version: '1.0', id, title, artist, durationSec: duration, difficulty, focus,
  assets: {
    accompaniment: `audio/${id}/accompaniment.mp3`,
    rescueLead: `audio/${id}/rescue-lead.mp3`,
    harmony: `audio/${id}/harmony.mp3`,
    timeline: `audio/${id}/timeline.json`,
    notes: `catalog/${id}/notes.json`,
    phrases: `catalog/${id}/phrases.json`,
  },
  rights: { status: 'prototype', note: rightsNote },
}
const phrases = lines.map((line) => ({
  id: `phrase-${line.id}`, startSec: line.start, endSec: line.end, lineIds: [line.id], breathWindows: [],
}))

if (dryRun) {
  console.log(JSON.stringify({ duration, lineCount: lines.length, sections, sampleLines: lines.slice(0, 5), catalogManifest }, null, 2))
  process.exit(0)
}

// ---- 写盘 ----
const audioDir = path.join(publicDir, 'audio', id)
const catalogDir = path.join(publicDir, 'catalog', id)
fs.mkdirSync(audioDir, { recursive: true })
fs.mkdirSync(catalogDir, { recursive: true })

writeJson(path.join(audioDir, 'timeline.json'), timeline)
writeJson(path.join(audioDir, 'manifest.json'), runtimeManifest)
writeJson(path.join(catalogDir, 'manifest.json'), catalogManifest)
writeJson(path.join(catalogDir, 'phrases.json'), { version: '1.0', reviewStatus: 'derived_from_lrc_requires_manual_review', phrases })

// 不变量：notes 必须人工校正后才提供音准分。不要覆盖已校正的 notes。
const notesPath = path.join(catalogDir, 'notes.json')
if (!fs.existsSync(notesPath)) {
  writeJson(notesPath, { version: '1.0', reviewStatus: 'placeholder_requires_manual_review', notes: [] })
} else {
  const existing = readJson(notesPath)
  if (existing.reviewStatus === 'reviewed') console.warn(`保留已校正的 notes.json（reviewStatus=reviewed）：${notesPath}`)
}

upsertCatalogIndex(path.join(publicDir, 'catalog', 'index.json'), {
  id, title, artist, difficulty, focus, manifestUrl: `catalog/${id}/manifest.json`, availability: 'ready',
})

console.log(`已生成练习曲 [${id}] ${title} - ${artist}`)
console.log(`  歌词行 ${lines.length} 条，时长 ${duration}s，段落 ${sections.length} 个`)
console.log('  契约：timeline / manifest(runtime+catalog) / phrases / notes(占位) 已写入；index.json 已登记。')
console.log('  下一步：1) 准备音频资产（prepare-practice-audio.mjs）2) 生成并人工校正 notes（generate-reference-notes.py）3) npm run catalog:validate')

// ---------------- helpers ----------------
function parseLrc(text) {
  const pattern = /\[(\d{1,2}):(\d{2}(?:\.\d+)?)\]/g
  const out = []
  for (const row of text.replace(/\r\n?/g, '\n').split('\n')) {
    const stamps = [...row.matchAll(pattern)]
    const lyric = row.replace(pattern, '').trim()
    if (!stamps.length || !lyric) continue
    if (lyricFilters.some((re) => re.test(lyric))) continue // 跳过词曲/演唱者等元信息行
    for (const m of stamps) out.push({ start: round(Number(m[1]) * 60 + Number(m[2])), text: lyric })
  }
  return out.sort((a, b) => a.start - b.start)
}

function buildSections(input, total) {
  if (Array.isArray(input) && input.length) {
    return input.map((s, i) => {
      const type = String(s.type ?? 'verse')
      return {
        id: String(s.id ?? `${type}-${i + 1}`),
        type,
        label: String(s.label ?? type),
        start: round(num(s.startSec, 0)),
        end: round(num(s.endSec, total)),
        vocalExpected: s.vocalExpected !== false,
        harmonyEnabled: Boolean(s.harmonyEnabled),
      }
    })
  }
  // 未提供段落：默认整段为一个 verse（不开启和声），保证运行时可用。
  return [{ id: 'verse-1', type: 'verse', label: '主歌', start: 0, end: total, vocalExpected: true, harmonyEnabled: false }]
}

function sectionTypeAt(sections, at) {
  const hit = sections.find((s) => at >= s.start && at < s.end)
  return hit ? hit.type : (sections[0]?.type ?? 'verse')
}

function upsertCatalogIndex(indexPath, entry) {
  let index = { version: '1.0', songs: [] }
  if (fs.existsSync(indexPath)) index = readJson(indexPath)
  if (!Array.isArray(index.songs)) index.songs = []
  const i = index.songs.findIndex((s) => s.id === entry.id)
  if (i >= 0) index.songs[i] = { ...index.songs[i], ...entry }
  else index.songs.push(entry)
  writeJson(indexPath, index)
}

function findRepoRoot() {
  let dir = process.cwd()
  for (let depth = 0; depth < 6; depth += 1) {
    if (fs.existsSync(path.join(dir, 'public', 'catalog', 'index.json'))) return dir
    const parent = path.dirname(dir)
    if (parent === dir) break
    dir = parent
  }
  return process.cwd()
}

function requireField(key) {
  const value = config[key]
  if (value === undefined || value === null || value === '') fail(`配置缺少必填字段：${key}`)
  return value
}
function readJson(file) { try { return JSON.parse(fs.readFileSync(file, 'utf8')) } catch (e) { fail(`读取 JSON 失败 ${file}：${e.message}`) } }
function writeJson(file, value) { fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`) }
function num(value, fallback = 0) { const n = Number(value); return Number.isFinite(n) ? n : fallback }
function clampInt(value, lo, hi) { return Math.max(lo, Math.min(hi, Math.round(Number(value) || lo))) }
function round(value) { return Math.round(value * 1000) / 1000 }
function fail(message) { console.error(`ERROR ${message}`); process.exit(1) }
