import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Download, Pause, Play, Plus, Save, Trash2 } from 'lucide-react'
import type { ReferenceNote } from '../../shared/contracts'
import type { SongTimeline } from '../features/sing-room/types'
import { loadPracticeManifest } from '../features/practice-room/catalog'
import { autoAdjustReferenceNotes } from '../features/practice-room/referenceNoteAdjustment'

interface CandidateFile { version: string; reviewStatus: string; generator?: string; notes: ReferenceNote[] }

export default function ReferenceReviewPage() {
  const { songId = 'trajectory' } = useParams()
  const navigate = useNavigate()
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const stopTimerRef = useRef<number | null>(null)
  const [timeline, setTimeline] = useState<SongTimeline | null>(null)
  const [notes, setNotes] = useState<ReferenceNote[]>([])
  const [audioUrl, setAudioUrl] = useState('')
  const [lineIndex, setLineIndex] = useState(0)
  const [confirmed, setConfirmed] = useState(false)
  const [beforeFold, setBeforeFold] = useState<ReferenceNote[] | null>(null)
  const [adjustmentSummary, setAdjustmentSummary] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    Promise.all([
      loadPracticeManifest(songId),
      fetch(`${import.meta.env.BASE_URL}audio/${songId}/timeline.json`).then((response) => response.json() as Promise<SongTimeline>),
      fetch(`${import.meta.env.BASE_URL}catalog/${songId}/notes.candidate.json`).then((response) => response.json() as Promise<CandidateFile>),
    ]).then(async ([manifest, nextTimeline, candidate]) => {
      if (cancelled) return
      const formalResponse = await fetch(`${import.meta.env.BASE_URL}${manifest.assets.notes}`)
      const formal = formalResponse.ok ? await formalResponse.json() as CandidateFile : null
      setTimeline(nextTimeline)
      setNotes(formal?.reviewStatus === 'reviewed' ? formal.notes ?? [] : candidate.notes ?? [])
      setAudioUrl(`${import.meta.env.BASE_URL}${manifest.assets.rescueLead}`)
    }).catch((reason) => setError(reason instanceof Error ? reason.message : '审核素材加载失败'))
    return () => { cancelled = true; if (stopTimerRef.current) window.clearTimeout(stopTimerRef.current) }
  }, [songId])

  const line = timeline?.lines[lineIndex]
  const lineNotes = useMemo(() => line ? notes.filter((note) => note.lineId === line.id) : [], [line, notes])
  const riskIndexes = useMemo(() => auditIndexes(notes, timeline), [notes, timeline])
  const riskCount = riskIndexes.size
  const missingLines = useMemo(() => timeline?.lines.filter((item) => !notes.some((note) => note.lineId === item.id)).length ?? 0, [notes, timeline])
  const lowCoverageLines = useMemo(() => timeline?.lines.filter((item) => coverage(notes.filter((note) => note.lineId === item.id), item) < .18) ?? [], [notes, timeline])
  const canFinalize = confirmed && riskCount === 0 && missingLines === 0

  function playLine() {
    if (!line || !audioRef.current) return
    if (stopTimerRef.current) window.clearTimeout(stopTimerRef.current)
    audioRef.current.currentTime = Math.max(0, line.start - .15)
    void audioRef.current.play()
    stopTimerRef.current = window.setTimeout(() => audioRef.current?.pause(), (line.end - line.start + .3) * 1000)
  }
  function updateNote(target: ReferenceNote, patch: Partial<ReferenceNote>) {
    setConfirmed(false)
    setNotes((current) => current.map((note) => note === target ? { ...note, ...patch } : note).sort((a, b) => a.startSec - b.startSec))
  }
  function removeNote(target: ReferenceNote) { setConfirmed(false); setNotes((current) => current.filter((note) => note !== target)) }
  function addNote() {
    if (!line) return
    const start = Math.min(line.end - .2, line.start + .1)
    setConfirmed(false)
    setNotes((current) => [...current, { startSec: start, endSec: Math.min(line.end, start + .3), midi: median(lineNotes.map((note) => note.midi)) ?? 60, lineId: line.id, sustained: false }].sort((a, b) => a.startSec - b.startSec))
  }
  function autoAdjust() {
    if (!timeline) return
    const riskLineIds = new Set([...riskIndexes].map((index) => notes[index]?.lineId).filter((lineId): lineId is string => Boolean(lineId)))
    const adjustment = autoAdjustReferenceNotes(notes, timeline, riskLineIds)
    if (!adjustment.changedCount) { setAdjustmentSummary('当前没有可自动修正的高风险项。'); return }
    setBeforeFold(notes)
    setConfirmed(false)
    setNotes(adjustment.notes)
    setAdjustmentSummary(`已生成建议稿：自动调整 ${adjustment.changedCount} 个音符。请逐句试听后再确认。`)
  }
  function jumpToLowCoverage() {
    if (!timeline || !lowCoverageLines.length) return
    const next = lowCoverageLines.find((item) => timeline.lines.indexOf(item) > lineIndex) ?? lowCoverageLines[0]
    setLineIndex(timeline.lines.indexOf(next))
  }
  function exportFile(reviewed: boolean) {
    const payload = { version: '1.0', reviewStatus: reviewed ? 'reviewed' : 'manual_review_in_progress', reviewerConfirmedAt: reviewed ? new Date().toISOString() : undefined, notes }
    const url = URL.createObjectURL(new Blob([`${JSON.stringify(payload, null, 2)}\n`], { type: 'application/json' }))
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = reviewed ? 'notes.json' : 'notes.review-draft.json'; anchor.click()
    window.setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  if (error) return <main className="practice-mobile practice-empty reference-review-page"><p>{error}</p></main>
  if (!timeline || !line) return <main className="practice-mobile practice-empty reference-review-page"><p>正在加载参考旋律审核台…</p></main>

  return <main className="practice-mobile reference-review-page">
    <header className="practice-top"><button onClick={() => navigate('/songs')}><ArrowLeft size={19} /></button><b>参考旋律审核</b><span /></header>
    <section className="review-summary"><div><small>歌曲</small><b>{timeline.title}</b></div><div><small>候选</small><b>{notes.length}</b></div><div><small>高风险</small><b className={riskCount ? 'danger' : ''}>{riskCount}</b></div><div><small>低覆盖行</small><b className={lowCoverageLines.length ? 'danger' : ''}>{lowCoverageLines.length}</b></div><div><small>缺失行</small><b className={missingLines ? 'danger' : ''}>{missingLines}</b></div></section>
    <section className="review-bulk"><p>自动调整会逐句选择最平滑的等价八度，并把音符裁回歌词窗口；不会补造低覆盖音符，也不会自动签字。</p><button onClick={autoAdjust}>自动调整高风险</button>{beforeFold && <button onClick={() => { setNotes(beforeFold); setBeforeFold(null); setConfirmed(false); setAdjustmentSummary('已撤销自动调整。') }}>撤销调整</button>}<button disabled={!lowCoverageLines.length} onClick={jumpToLowCoverage}>跳到下一低覆盖行</button>{adjustmentSummary && <small>{adjustmentSummary}</small>}</section>
    <audio ref={audioRef} src={audioUrl} controls preload="metadata" />
    <section className="review-line-picker"><button disabled={lineIndex === 0} onClick={() => setLineIndex((value) => value - 1)}>上一句</button><span>{lineIndex + 1}/{timeline.lines.length}</span><button disabled={lineIndex === timeline.lines.length - 1} onClick={() => setLineIndex((value) => value + 1)}>下一句</button></section>
    <section className="review-line"><small>{format(line.start)}–{format(line.end)} · {line.id} · 音符覆盖 {Math.round(coverage(lineNotes, line) * 100)}%</small><h1>{line.text}</h1><button onClick={playLine}><Play size={16} />循环试听本句</button><button onClick={() => audioRef.current?.pause()}><Pause size={16} />暂停</button></section>
    <PitchRoll line={line} notes={lineNotes} />
    <section className="review-notes"><div className="section-title"><h2>本句音符</h2><button onClick={addNote}><Plus size={15} />添加</button></div>{lineNotes.map((note) => <article className={riskIndexes.has(notes.indexOf(note)) ? 'risk' : ''} key={`${note.startSec}-${note.endSec}-${note.midi}`}><label>开始<input type="number" step="0.01" value={note.startSec} onChange={(event) => updateNote(note, { startSec: Number(event.target.value) })} /></label><label>结束<input type="number" step="0.01" value={note.endSec} onChange={(event) => updateNote(note, { endSec: Number(event.target.value) })} /></label><label>MIDI<input type="number" step="1" value={note.midi} onChange={(event) => updateNote(note, { midi: Number(event.target.value) })} /></label><div className="note-actions"><button onClick={() => updateNote(note, { midi: note.midi - 12 })}>−8度</button><button onClick={() => updateNote(note, { midi: note.midi + 12 })}>+8度</button><label><input type="checkbox" checked={note.sustained} onChange={(event) => updateNote(note, { sustained: event.target.checked })} />长音</label><button aria-label="删除音符" onClick={() => removeNote(note)}><Trash2 size={14} /></button></div></article>)}</section>
    <section className="review-export"><button onClick={() => exportFile(false)}><Download size={16} />导出校正草稿</button><label><input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} />我已逐句试听并核对音高、时值和长音</label><button className="practice-primary" disabled={!canFinalize} onClick={() => exportFile(true)}><Save size={17} />导出正式 notes.json</button>{!canFinalize && <small>正式导出要求：高风险 0、缺失歌词行 0，并完成审核确认。</small>}</section>
  </main>
}

function PitchRoll({ line, notes }: { line: SongTimeline['lines'][number]; notes: ReferenceNote[] }) {
  const low = Math.min(48, ...notes.map((note) => note.midi)); const high = Math.max(72, ...notes.map((note) => note.midi)); const span = Math.max(1, high - low)
  return <svg className="pitch-roll" viewBox="0 0 100 72" preserveAspectRatio="none" aria-label="本句钢琴卷帘">{notes.map((note) => <rect key={`${note.startSec}-${note.midi}`} x={((note.startSec - line.start) / (line.end - line.start)) * 100} y={68 - ((note.midi - low) / span) * 64} width={Math.max(1, ((note.endSec - note.startSec) / (line.end - line.start)) * 100)} height="4" rx="1" />)}</svg>
}
function auditIndexes(notes: ReferenceNote[], timeline: SongTimeline | null): Set<number> {
  if (!timeline || !notes.length) return new Set([0])
  const values = notes.map((note) => note.midi).sort((a, b) => a - b); const center = median(values) ?? 60; const lines = new Map(timeline.lines.map((line) => [line.id, line])); const risks = new Set<number>()
  for (const [index, note] of notes.entries()) { const line = lines.get(note.lineId); if (!line || note.startSec < line.start - .08 || note.endSec > line.end + .08 || note.endSec <= note.startSec || Math.abs(note.midi - center) >= 12) risks.add(index); const previous = notes[index - 1]; if (previous?.lineId === note.lineId && Math.abs(previous.midi - note.midi) >= 10) risks.add(index) }
  return risks
}
function median(values: number[]): number | null { return values.length ? values[Math.floor(values.length / 2)] : null }
function coverage(notes: ReferenceNote[], line: SongTimeline['lines'][number]): number { return notes.reduce((sum, note) => sum + Math.max(0, note.endSec - note.startSec), 0) / Math.max(.01, line.end - line.start) }
function format(seconds: number): string { return `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}` }
