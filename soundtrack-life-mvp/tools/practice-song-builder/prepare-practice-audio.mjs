#!/usr/bin/env node
// 配置驱动的练习曲音频资产生成器。把源素材处理成运行时所需的三条 mp3：
//   accompaniment.mp3（伴奏）/ rescue-lead.mp3（救场人声）/ harmony.mp3（和声）
// 写入 <repo>/public/audio/<id>/。
//
// 支持三种输入（在 config.audio 中声明，对应「经过转换」的不同程度）：
//   1) mix:    完整混音 mp3 → 调 demucs 分轨出 vocals / no_vocals
//   2) stems:  已分轨的 vocals + accompaniment（preclipped=false 时按 segments 裁剪拼接）
//   3) preclipped=true: stems 已是练习片段成品，仅做增益与编码
//
// 依赖：ffmpeg、（需分轨时）python+demucs、（生成和声时）rubberband + 仓库内
//       scripts/generate-trajectory-harmony.py。可用环境变量 PYTHON 指定解释器。
//
// 用法：node prepare-practice-audio.mjs <song-config.json> --repo <soundtrack-life-mvp 路径>

import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { spawnSync } from 'node:child_process'

const args = process.argv.slice(2)
const repoIdx = args.indexOf('--repo')
const positional = args.filter((a, i) => !a.startsWith('--') && i !== (repoIdx >= 0 ? repoIdx + 1 : -1))
const configPath = positional[0]
if (!configPath) fail('用法：node prepare-practice-audio.mjs <song-config.json> --repo <path>')
const config = readJson(path.resolve(configPath))
const configDir = path.dirname(path.resolve(configPath))
const repoRoot = path.resolve(repoIdx >= 0 ? args[repoIdx + 1] : (config.repoRoot ?? '.'))

const id = need(config.id, 'id')
const segments = config.segments
if (!Array.isArray(segments) || !segments.length) fail('config.segments 必填（源时间轴片段）。')
const crossfade = numOr(config.crossfade, 0.15)
const audio = config.audio ?? {}
const encodeVolume = {
  accompaniment: numOr(audio.encodeVolume?.accompaniment, 1.0),
  rescueLead: numOr(audio.encodeVolume?.rescueLead, 0.56),
  harmony: numOr(audio.encodeVolume?.harmony, 0.5),
}

requireBin('ffmpeg')

const publicAudio = path.join(repoRoot, 'public', 'audio', id)
fs.mkdirSync(publicAudio, { recursive: true })
const work = fs.mkdtempSync(path.join(os.tmpdir(), `practice-${id}-`))

// ---- 1. 取得 vocals / accompaniment 两条干声 ----
let vocalPath
let accompPath
if (audio.stems?.vocals && audio.stems?.accompaniment) {
  vocalPath = resolveIn(audio.stems.vocals)
  accompPath = resolveIn(audio.stems.accompaniment)
  console.log('使用已分轨素材。')
} else if (audio.mix) {
  const mix = resolveIn(audio.mix)
  const python = process.env.PYTHON || 'python3'
  const model = audio.demucsModel || 'htdemucs_ft'
  console.log(`未提供分轨，调用 demucs(${model}) 分离：${mix}`)
  run(python, ['-m', 'demucs', '--two-stems', 'vocals', '--float32', '-n', model, '-o', path.join(work, 'separated'), mix])
  const base = path.basename(mix).replace(/\.[^.]+$/, '')
  const stemDir = path.join(work, 'separated', model, base)
  vocalPath = path.join(stemDir, 'vocals.wav')
  accompPath = path.join(stemDir, 'no_vocals.wav')
} else {
  fail('config.audio 需提供 mix（完整混音）或 stems.vocals + stems.accompaniment。')
}

// ---- 2. 裁剪拼接到练习片段（除非已 preclipped）----
const preclipped = Boolean(audio.preclipped)
const filter = preclipped ? null : buildMontageFilter(segments, crossfade)

encodeTrack(accompPath, path.join(publicAudio, 'accompaniment.mp3'), encodeVolume.accompaniment, filter)
encodeTrack(vocalPath, path.join(publicAudio, 'rescue-lead.mp3'), encodeVolume.rescueLead, filter)

// ---- 3. 和声 ----
const harmonyOut = path.join(publicAudio, 'harmony.mp3')
if (audio.harmony?.regions) {
  const python = process.env.PYTHON || 'python3'
  const harmonyScript = path.join(repoRoot, 'scripts', 'generate-trajectory-harmony.py')
  if (!fs.existsSync(harmonyScript)) fail(`未找到和声脚本：${harmonyScript}`)
  requireBin('rubberband')
  const vocalPcm = path.join(work, 'vocals-pcm16.wav')
  run('ffmpeg', ['-y', '-hide_banner', '-loglevel', 'warning', '-i', vocalPath, '-c:a', 'pcm_s16le', vocalPcm])
  const harmonyWav = path.join(work, 'harmony.wav')
  run(python, [harmonyScript, vocalPcm, harmonyWav, '--work-dir', path.join(work, 'harmony-analysis'), '--regions', String(audio.harmony.regions)])
  encodeTrack(harmonyWav, harmonyOut, encodeVolume.harmony, preclipped ? null : filter)
} else {
  console.warn('未提供 harmony.regions：以低增益人声作为占位和声（建议后续补真实和声区间）。')
  encodeTrack(vocalPath, harmonyOut, Math.min(encodeVolume.harmony, encodeVolume.rescueLead * 0.8), filter)
}

fs.rmSync(work, { recursive: true, force: true })
console.log(`音频资产已写入 ${publicAudio}（accompaniment / rescue-lead / harmony）。`)

// ---------------- helpers ----------------
// 为任意片段数构建 ffmpeg filter_complex：逐段 atrim，再链式 acrossfade，最后淡入淡出+增益。
function buildMontageFilter(segs, cf) {
  const duration = computeDuration(segs, cf)
  const parts = []
  segs.forEach((s, i) => {
    parts.push(`[0:a]atrim=start=${numOr(s.start)}:end=${numOr(s.end)},asetpts=PTS-STARTPTS[seg${i}]`)
  })
  let last = 'seg0'
  for (let i = 1; i < segs.length; i += 1) {
    const out = i === segs.length - 1 ? 'xfaded' : `xf${i}`
    parts.push(`[${last}][seg${i}]acrossfade=d=${cf}:c1=tri:c2=tri[${out}]`)
    last = out
  }
  const body = segs.length === 1 ? 'seg0' : last
  const fadeOut = Math.max(0, round(duration - 1))
  parts.push(`[${body}]afade=t=in:st=0:d=0.08,afade=t=out:st=${fadeOut}:d=1,volume=__VOL__,apad,atrim=0:${duration}[out]`)
  return parts.join(';')
}

function computeDuration(segs, cf) {
  let cursor = 0
  segs.forEach((s, i) => { cursor += (numOr(s.end) - numOr(s.start)) - (i < segs.length - 1 ? cf : 0) })
  return round(cursor)
}

function encodeTrack(input, output, volume, filter) {
  const common = ['-y', '-hide_banner', '-loglevel', 'warning', '-i', input]
  if (filter) {
    run('ffmpeg', [...common, '-filter_complex', filter.replace('__VOL__', String(volume)), '-map', '[out]', '-ar', '44100', '-c:a', 'libmp3lame', '-b:a', '128k', output])
  } else {
    run('ffmpeg', [...common, '-af', `volume=${volume}`, '-ar', '44100', '-c:a', 'libmp3lame', '-b:a', '128k', output])
  }
  console.log(`  → ${path.basename(output)}`)
}

function resolveIn(p) {
  const abs = path.resolve(configDir, p)
  if (!fs.existsSync(abs)) fail(`未找到素材文件：${abs}`)
  return abs
}
function run(cmd, argv) {
  const r = spawnSync(cmd, argv, { stdio: 'inherit' })
  if (r.status !== 0) fail(`命令失败：${cmd} ${argv.join(' ')}`)
}
function requireBin(bin) {
  const r = spawnSync(bin, ['-version'], { stdio: 'ignore' })
  if (r.error) fail(`缺少依赖：${bin}，请先安装。`)
}
function readJson(file) { try { return JSON.parse(fs.readFileSync(file, 'utf8')) } catch (e) { fail(`读取 JSON 失败 ${file}：${e.message}`) } }
function need(v, k) { if (v === undefined || v === null || v === '') fail(`配置缺少必填字段：${k}`); return v }
function numOr(v, fallback = 0) { const n = Number(v); return Number.isFinite(n) ? n : fallback }
function round(v) { return Math.round(v * 1000) / 1000 }
function fail(m) { console.error(`ERROR ${m}`); process.exit(1) }
