import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, BarChart3, Download, Music2, RefreshCw, Sparkles, Trash2, WandSparkles } from 'lucide-react'
import XiaoMai from '../components/XiaoMai'
import { loadPracticeReport } from '../features/practice-room/reportStore'
import { loadRecap } from '../features/sing-room/recap'
import { deleteSessionRecording, loadSessionRecording } from '../features/sing-room/recording'
import { loadPracticeSong } from '../features/sing-room/session'
import type { SongTimeline } from '../features/sing-room/types'

export default function SingRoomRecapPage() {
  const { songId = 'trajectory' } = useParams()
  const navigate = useNavigate()
  const recap = useMemo(() => loadRecap(), [])
  const report = useMemo(() => loadPracticeReport(songId), [songId])
  const [timeline, setTimeline] = useState<SongTimeline | null>(null)
  const [recording, setRecording] = useState(() => loadSessionRecording())

  useEffect(() => { loadPracticeSong(songId).then(({ timeline: next }) => setTimeline(next)).catch(() => undefined) }, [songId])
  if (!recap) return <main className="practice-mobile practice-empty warm-room-page"><p>还没有这一局的演唱记录。</p><button className="practice-primary" onClick={() => navigate(`/practice/${songId}`)}>开始练歌</button></main>

  const validMetrics = report?.metrics.filter((metric) => metric.score !== null) ?? []
  const strongest = [...validMetrics].sort((a, b) => (b.score ?? 0) - (a.score ?? 0))[0]
  const weakest = [...validMetrics].sort((a, b) => (a.score ?? 0) - (b.score ?? 0))[0]
  const highlightLine = timeline?.lines.find((line) => line.id === recap.highlightLineId)
  const duration = Math.max(1, Math.round(recording?.durationSec ?? recap.longestContinuousSingingSec))

  function removeRecording() { deleteSessionRecording(); setRecording(null) }

  return <main className="practice-mobile recap-design warm-room-page">
    <section className="recap-room-scene">
      <button className="recap-home-back" onClick={() => navigate('/')} title="返回首页"><ArrowLeft /></button>
      <header><div><h1>本次结算</h1></div></header>
      <div className="companion-speech recap-speech">唱完啦，{recap.participationRate >= .75 ? '很稳' : '这一遍我记下了'}</div>
      <XiaoMai state="cheering" />
    </section>
    <section className="recap-result-card">
      <div className="recap-complete"><span><Music2 /></span><div><b>已完成演唱</b><small>{Math.floor(duration / 60)}分{duration % 60}秒 · 开口覆盖 {Math.round(recap.participationRate * 100)}%</small></div></div>
      <article className="recap-insight highlight"><Sparkles /><div><small>本次高光</small><h2>{strongest ? `${strongest.label}是这一遍最亮的地方` : (highlightLine?.text ? `“${highlightLine.text}”` : '你按自己的节奏唱到了最后')}</h2><p>{strongest?.evidence ?? report?.headline ?? '完成本身，就是这次练习最值得记住的证据。'}</p></div></article>
      <article className="recap-insight improve"><span>↑</span><div><small>下次试试</small><h2>{weakest?.status === 'ok' ? weakest.suggestion : '保持舒服的气息，再完整唱一遍'}</h2><p>{weakest?.status === 'ok' ? weakest.evidence : '数据不足时，小麦不会勉强给分；多唱一些有效乐句会更容易看见变化。'}</p></div></article>
      {recording && <div className="recap-recording-inline"><audio controls src={recording.url} /><a href={recording.url} download={`AI练歌房-${timeline?.title ?? songId}.webm`}><Download />保存</a><button onClick={removeRecording}><Trash2 />删除</button></div>}
      <div className="recap-design-actions"><button onClick={() => navigate(`/practice/${songId}/report`)}><BarChart3 />成长报告</button><button className="secondary" disabled><WandSparkles />AI修音</button></div>
      <p className="recap-tip">💡 每次练一练，进步看得见～</p>
    </section>
    <button className="recap-retry" onClick={() => navigate(`/practice/${songId}/sing`)}><RefreshCw />再唱一遍</button>
  </main>
}
