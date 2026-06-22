import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Activity, ArrowLeft, Clock3, Gauge, Heart, Music2, Play, RefreshCw, ShieldCheck, Sparkles, Users, Wind } from 'lucide-react'
import type { MetricKey, PracticeReport } from '../../shared/contracts'
import XiaoMai from '../components/XiaoMai'
import { loadGrowthReport } from '../features/practice-room/growth'
import { loadPracticeReport } from '../features/practice-room/reportStore'
import { loadSessionRecording } from '../features/sing-room/recording'

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
  const [report, setReport] = useState<PracticeReport | null>(() => sessionId ? null : loadPracticeReport(songId))
  const [loading, setLoading] = useState(Boolean(sessionId))
  const recording = sessionId ? null : loadSessionRecording()

  useEffect(() => { if (sessionId) loadGrowthReport(sessionId).then(setReport).catch(() => setReport(null)).finally(() => setLoading(false)) }, [sessionId])
  if (loading) return <main className="practice-mobile practice-empty warm-room-page"><p>正在打开历史报告…</p></main>
  if (!report) return <main className="practice-mobile practice-empty warm-room-page"><p>这次练习只有旧版趋势摘要，没有完整表现报告。</p><button className="practice-primary" onClick={() => navigate('/growth')}>返回成长档案</button></main>

  const backPath = sessionId ? '/growth' : `/practice/${report.songId}/recap`
  return <main className="practice-mobile report-page report-design warm-room-page">
    <header className="warm-page-header"><button onClick={() => navigate(backPath)}><ArrowLeft /></button><h1>{sessionId ? '历史表现' : '成长报告'}</h1><span /></header>
    <section className="report-companion-scene"><div className="companion-speech">{report.status === 'complete' ? '今天进步很明显' : '这一遍先记下来'}</div><XiaoMai state="notebook" /></section>
    <section className="report-sheet">
      <div className="report-xiaomai-summary"><Sparkles /><div><h2>小麦总结</h2><p>{report.headline}</p></div></div>
      <div className="report-score-heading"><h2>本次表现</h2>{report.overallScore !== null ? <strong>{report.overallScore}<small>总分</small></strong> : <strong className="insufficient">—<small>数据不足</small></strong>}</div>
      <section className="report-metric-bars">{report.metrics.map((metric) => <article key={metric.key} className={`metric-${metric.key} ${metric.status !== 'ok' ? 'muted' : ''}`}>
        <span>{metricDetails[metric.key].icon}</span><b>{metric.label}</b><i><em style={{ width: `${metric.score ?? 0}%` }} /></i><strong>{metric.score ?? '—'}</strong>
        <details><summary>查看专业证据</summary><dl><div><dt>权重</dt><dd>{metricDetails[metric.key].weight}</dd></div><div><dt>测量方式</dt><dd>{metricDetails[metric.key].method}</dd></div><div><dt>本次证据</dt><dd>{metric.evidence}</dd></div><div><dt>练习建议</dt><dd>{metric.suggestion}</dd></div><div><dt>解释边界</dt><dd>{metricDetails[metric.key].boundary}</dd></div></dl>{metric.segments.length > 0 && <p className="metric-times"><Clock3 />{metric.segments.map((segment) => <span key={`${segment.startSec}-${segment.endSec}`}>{formatTime(segment.startSec)}–{formatTime(segment.endSec)}</span>)}</p>}</details>
      </article>)}</section>
      <div className="report-advice"><span>💡</span><div><h2>小麦建议</h2><p>{report.primarySuggestion}</p></div></div>
      <div className="report-quality"><div><Activity /><span><b>{Math.round(report.dataQuality.vocalCoverage * 100)}%</b><small>有效覆盖</small></span></div><div><Gauge /><span><b>{Math.round(report.dataQuality.pitchConfidence * 100)}%</b><small>音高置信度</small></span></div><div><ShieldCheck /><span><b>{report.dataQuality.noiseFloorDb.toFixed(0)} dB</b><small>环境底噪</small></span></div></div>
      <div className="report-actions">{recording && <audio controls src={recording.url} />}{!sessionId && <button onClick={() => navigate(`/practice/${report.songId}/highlight`)}><Play />查看证据片段</button>}<button onClick={() => navigate(`/practice/${report.songId}/sing`)}><RefreshCw />再来一遍</button></div>
      <p className="report-disclaimer"><ShieldCheck />总分只在五项指标都有可信证据时聚合；LLM 不参与算分。</p>
    </section>
  </main>
}

function formatTime(seconds: number): string { return `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}` }
