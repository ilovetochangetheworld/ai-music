import type { PracticeSongManifest } from '../../../shared/contracts'
import type { SongTimeline } from '../sing-room/types'

export interface CustomSongRecord {
  id: string
  createdAt: string
  lyricMode: 'lrc' | 'distributed'
  reviewStatus: 'needs_timing_review'
  manifest: PracticeSongManifest
  timeline: SongTimeline
  audio: Blob
  silentTrack: Blob
}

const DB_NAME = 'ai-practice-room'
const STORE = 'customSongs'
const MAX_AUDIO_BYTES = 25 * 1024 * 1024

export async function createCustomSong(input: { title: string; artist: string; audio: File; lyrics: string }): Promise<CustomSongRecord> {
  if (!input.audio.type.startsWith('audio/')) throw new Error('请选择 MP3、M4A、WAV 等音频文件。')
  if (input.audio.size > MAX_AUDIO_BYTES) throw new Error('歌曲文件不能超过 25MB。')
  const title = input.title.trim() || input.audio.name.replace(/\.[^.]+$/, '')
  const artist = input.artist.trim() || '未知演唱者'
  const lyrics = input.lyrics.trim()
  if (!lyrics) throw new Error('请粘贴歌词或选择 LRC/TXT 文件。')
  const duration = await readAudioDuration(input.audio)
  if (!Number.isFinite(duration) || duration < 10) throw new Error('无法读取歌曲时长，或歌曲短于 10 秒。')
  const id = `upload-${crypto.randomUUID()}`
  const parsed = parseLyrics(lyrics, duration)
  const timeline: SongTimeline = {
    songId: id, title, artist, duration, bpm: 0, demoCueSec: 0,
    sections: [{ id: 'full', type: 'verse', label: '全曲', start: 0, end: duration, vocalExpected: true, harmonyEnabled: false }],
    lines: parsed.lines.map((line, index) => ({ id: `line-${index + 1}`, start: line.start, end: line.end, text: line.text, section: 'verse', rescuable: false, harmonyEnabled: false, breathProtectionMs: 300 })),
  }
  const manifest: PracticeSongManifest = {
    version: '1.0', id, title, artist, durationSec: duration, difficulty: 3,
    focus: ['rhythm', 'breath', 'expression', 'consistency'],
    assets: { accompaniment: `indexeddb://${id}/audio`, rescueLead: `indexeddb://${id}/silence`, harmony: `indexeddb://${id}/silence`, timeline: `indexeddb://${id}/timeline`, notes: `indexeddb://${id}/notes`, phrases: `indexeddb://${id}/phrases` },
    rights: { status: 'prototype', note: '用户本地导入；请确认拥有练习和使用该素材的权利。' },
  }
  const record: CustomSongRecord = { id, createdAt: new Date().toISOString(), lyricMode: parsed.mode, reviewStatus: 'needs_timing_review', manifest, timeline, audio: input.audio, silentTrack: createSilentWav(duration) }
  const db = await openDb()
  await put(db, record)
  return record
}

export async function listCustomSongs(): Promise<CustomSongRecord[]> {
  const db = await openDb()
  return await new Promise((resolve, reject) => {
    const request = db.transaction(STORE, 'readonly').objectStore(STORE).getAll()
    request.onsuccess = () => resolve((request.result as CustomSongRecord[]).sort((a, b) => b.createdAt.localeCompare(a.createdAt)))
    request.onerror = () => reject(request.error)
  })
}

export async function loadCustomSong(id: string): Promise<CustomSongRecord | null> {
  const db = await openDb()
  return await new Promise((resolve, reject) => {
    const request = db.transaction(STORE, 'readonly').objectStore(STORE).get(id)
    request.onsuccess = () => resolve(request.result as CustomSongRecord | undefined ?? null)
    request.onerror = () => reject(request.error)
  })
}

export function parseLyrics(source: string, duration: number): { mode: 'lrc' | 'distributed'; lines: Array<{ start: number; end: number; text: string }> } {
  const lrc = source.split(/\r?\n/).flatMap((raw) => {
    const text = raw.replace(/\[\d{1,3}:\d{2}(?:[.:]\d{1,3})?\]/g, '').trim()
    if (!text) return []
    return [...raw.matchAll(/\[(\d{1,3}):(\d{2})(?:[.:](\d{1,3}))?\]/g)].map((match) => {
      const fraction = match[3] ? Number(`0.${match[3].padEnd(3, '0').slice(0, 3)}`) : 0
      return { start: Number(match[1]) * 60 + Number(match[2]) + fraction, text }
    })
  }).filter((line) => line.start < duration).sort((a, b) => a.start - b.start)
  if (lrc.length) return { mode: 'lrc', lines: lrc.map((line, index) => ({ ...line, end: Math.max(line.start + .4, Math.min(duration, (lrc[index + 1]?.start ?? duration) - .08)) })) }

  const plain = source.split(/\r?\n/).map((line) => line.trim()).filter(Boolean)
  const usable = Math.max(1, duration - 4)
  const slot = usable / plain.length
  return { mode: 'distributed', lines: plain.map((text, index) => ({ start: 2 + index * slot, end: Math.min(duration, 2 + (index + 1) * slot - .08), text })) }
}

function readAudioDuration(file: Blob): Promise<number> {
  return new Promise((resolve, reject) => {
    const audio = new Audio()
    const url = URL.createObjectURL(file)
    audio.preload = 'metadata'
    audio.onloadedmetadata = () => { const value = audio.duration; URL.revokeObjectURL(url); resolve(value) }
    audio.onerror = () => { URL.revokeObjectURL(url); reject(new Error('无法解析音频文件。')) }
    audio.src = url
  })
}

function createSilentWav(duration: number): Blob {
  const sampleRate = 8000
  const samples = Math.ceil(duration * sampleRate)
  const buffer = new ArrayBuffer(44 + samples * 2)
  const view = new DataView(buffer)
  const write = (offset: number, value: string) => [...value].forEach((char, index) => view.setUint8(offset + index, char.charCodeAt(0)))
  write(0, 'RIFF'); view.setUint32(4, 36 + samples * 2, true); write(8, 'WAVE'); write(12, 'fmt ')
  view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true); view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * 2, true); view.setUint16(32, 2, true); view.setUint16(34, 16, true); write(36, 'data'); view.setUint32(40, samples * 2, true)
  return new Blob([buffer], { type: 'audio/wav' })
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 2)
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains('growth')) request.result.createObjectStore('growth', { keyPath: 'id' })
      if (!request.result.objectStoreNames.contains(STORE)) request.result.createObjectStore(STORE, { keyPath: 'id' })
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

function put(db: IDBDatabase, record: CustomSongRecord): Promise<void> {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE, 'readwrite')
    transaction.objectStore(STORE).put(record)
    transaction.oncomplete = () => resolve()
    transaction.onerror = () => reject(transaction.error)
  })
}
