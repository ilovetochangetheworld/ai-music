import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Activity, ArrowLeft, Heart, Music2, Pause, Play, RefreshCw, ShieldCheck, Sparkles, Target, Users, Wind } from 'lucide-react'
import type { EvidenceSegment, MetricKey, MetricScore, PracticeReport } from '../../shared/contracts'
import XiaoMai from '../components/XiaoMai'
import { loadGrowthReport } from '../features/practice-room/growth'
import { loadPracticeReport } from '../features/practice-room/reportStore'
import { loadSessionRecording } from '../features/sing-room/recording'
import { loadPracticeSong } from '../features/sing-room/session'
import type { SongTimeline } from '../features/sing-room/types'

const metricDetails: Record<MetricKey, { weight: string; method: string; boundary: string; icon: React.ReactNode }> = {
  pitch: { weight: '30%', method: '音分偏差、准确帧比例、长音漂移', boundary: '允许八度等价；必须有人工校正参考旋律', icon: <Music2 /> },
  rhythm: { weight: '25%', method: '乐句开口、结束和连续发声区间偏差', boundary: '依赖歌词与节拍窗口，不评价个人律动风格', icon: <Activity /> },
  breath: { weight: '15%', method: '乐句完成率、句中停顿、长音衰减', boundary: '仅由麦克风信号推测，不等同生理呼吸检测', icon: <Wind /> },
  expression: { weight: '15%', method: '段落动态、关键词能量与句尾层次', boundary: '评价声音层次，不推断用户真实情绪', icon: <Heart /> },
  consistency: { weight: '15%', method: '前后半段、重复段落与有效音高稳定度', boundary: '需要足够连续且可比较的演唱样本', icon: <Users /> },
}

export default function PracticeReportPage() {
  const { songId = 'trajectory', sessionId } = useParams()
  const navigate = useNavigate()
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const timerRef = useRef<number | null>(null)
  const [report, setReport] = useState<PracticeReport | null>(() => sessionId ? null : loadPracticeReport(songId))
  const [timeline, setTimeline] = useState<SongTimeline | null>(null)
  const [playingEvidence, setPlayingEvidence] = useState(false)
  const [loading, setLoading] = useState(Boolean(sessionId))
  const recording = sessionId ? null : loadSessionRecording()

  useEffect(() => { if (sessionId) loadGrowthReport(sessionId).then(setReport).catch(() => setReport(null)).finally(() => setLoading(false)) }, [sessionId])
  useEffect(() => { if (report?.songId) loadPracticeSong(report.songId).then(({ timeline: next }) => setTimeline(next)).catch(() => setTimeline(null)) }, [report?.songId])
  useEffect(() => () => { if (timerRef.current) window.clearTimeout(timerRef.current) }, [])
  if (loading) return <main className="practice-mobile practice-empty warm-room-page"><p>正在打开历史报告…</p></main>
  if (!report) return <main className="practice-mobile practice-empty warm-room-page"><p>这次练习只有旧版趋势摘要，没有完整表现报告。</p><button className="practice-primary" onClick={() => navigate('/growth')}>返回成长档案</button></main>

  const validMetrics = report.metrics.filter((metric) => metric.score !== null)
  const highlightMetric = [...validMetrics].sort((a, b) => (b.score ?? 0) - (a.score ?? 0))[0] ?? report.metrics[0]
  const focusMetric = [...validMetrics].sort((a, b) => (a.score ?? 0) - (b.score ?? 0))[0] ?? report.metrics.find((metric) => metric.status !== 'ok') ?? report.metrics[0]
  const evidenceSegment = pickEvidenceSegment(report, highlightMetric, focusMetric)
  const evidenceLine = evidenceSegment?.lineId ? timeline?.lines.find((line) => line.id === evidenceSegment.lineId) : null
  const backPath = sessionId ? '/growth' : '/'
  const songTitle = timeline?.title ?? (report.songId === 'trajectory' ? '轨迹' : report.songId)
  const hasPlayableHighlight = Boolean(recording && evidenceSegment)
  const summaryHeadline = validMetrics.length > 0 ? report.headline : '小麦已记录这次演唱'
  const summaryBody = validMetrics.length > 0
    ? `这份报告只针对《${songTitle}》本次演唱，重点帮你找到下一遍最值得练的一处。`
    : `这份报告只针对《${songTitle}》本次演唱，下一遍唱得更完整时，小麦会给出更具体的练习建议。`
  const highlightEvidence = metricEvidenceText(highlightMetric)
  const focusEvidence = metricEvidenceText(focusMetric)

  async function playEvidence() {
    const audio = audioRef.current
    if (!audio || !evidenceSegment) return
    if (playingEvidence) { audio.pause(); setPlayingEvidence(false); return }
    audio.currentTime = evidenceSegment.startSec
    try {
      await audio.play()
      setPlayingEvidence(true)
      if (timerRef.current) window.clearTimeout(timerRef.current)
      timerRef.current = window.setTimeout(() => { audio.pause(); setPlayingEvidence(false) }, Math.max(800, (evidenceSegment.endSec - evidenceSegment.startSec) * 1000))
    } catch { setPlayingEvidence(false) }
  }

  return <main className="practice-mobile report-page report-design warm-room-page">
    <header className="warm-page-header"><button onClick={() => navigate(backPath)}><ArrowLeft /></button><h1>{sessionId ? '历史反馈' : '本次反馈'}</h1><span /></header>
    <section className="report-companion-scene"><div className="companion-speech">这是《{songTitle}》这一遍的反馈</div><XiaoMai state="notebook" /></section>
    <section className="report-sheet coaching-report-sheet">
      <div className="report-xiaomai-summary"><Sparkles /><div><small>小麦总结</small><h2>{summaryHeadline}</h2><p>{summaryBody}</p></div></div>
      <article className="coaching-card highlight"><span><Sparkles /></span><div><small>本次亮点</small><h2>{validMetrics.length > 0 && highlightMetric ? `${friendlyMetricLabel(highlightMetric)}表现最好` : '这一遍已经完成'}</h2>{highlightEvidence && <p>{highlightEvidence}</p>}</div></article>
      <article className="coaching-card practice-focus"><span><Target /></span><div><small>下次重点练习</small><h2>{focusMetric?.suggestion ?? report.primarySuggestion}</h2>{focusEvidence && <p>{focusEvidence}</p>}</div></article>
      <section className={`evidence-card highlight-clip-card ${hasPlayableHighlight ? '' : 'muted'}`}><div><small>高光片段</small><h2>{hasPlayableHighlight ? evidenceLine?.text ? `“${evidenceLine.text}”` : `${formatTime(evidenceSegment!.startSec)}–${formatTime(evidenceSegment!.endSec)}` : '请打开录音记录高光'}</h2></div>{hasPlayableHighlight ? <><audio ref={audioRef} src={recording!.url} onPause={() => setPlayingEvidence(false)} /><button onClick={() => void playEvidence()}>{playingEvidence ? <Pause /> : <Play />}{playingEvidence ? '暂停片段' : '播放片段'}</button></> : <button disabled><Play />请打开录音记录高光</button>}</section>
      <details className="professional-evidence"><summary><ShieldCheck />专业依据</summary><section className="report-metric-bars compact feedback-metrics">{report.metrics.map((metric) => <article key={metric.key} className={`metric-${metric.key} ${metric.status !== 'ok' ? 'muted' : ''}`}><span>{metricDetails[metric.key].icon}</span><b>{metric.label}</b><i><em style={{ width: `${metric.score ?? 0}%` }} /></i><strong>{metric.score ?? '—'}</strong><p>{metric.suggestion}</p></article>)}</section></details>
      <div className="report-actions"><button onClick={() => navigate(`/practice/${report.songId}/sing`)}><RefreshCw />再练一遍</button></div>
    </section>
  </main>
}

function metricEvidenceText(metric?: MetricScore): string | null {
  if (!metric || metric.score === null || metric.status !== 'ok') return null
  if (metric.evidence.includes('数据不足')) return null
  return metric.evidence
}

function pickEvidenceSegment(report: PracticeReport, highlightMetric?: MetricScore, focusMetric?: MetricScore): EvidenceSegment | undefined {
  return report.highlights[0] ?? highlightMetric?.segments[0] ?? focusMetric?.segments[0] ?? report.metrics.find((metric) => metric.segments.length > 0)?.segments[0]
}

function friendlyMetricLabel(metric: MetricScore): string {
  const labels: Record<MetricKey, string> = {
    pitch: '旋律贴合',
    rhythm: '进拍稳定',
    breath: '句子支撑',
    expression: '声音层次',
    consistency: '整首保持',
  }
  return labels[metric.key]
}

function formatTime(seconds: number): string { return `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}` }


