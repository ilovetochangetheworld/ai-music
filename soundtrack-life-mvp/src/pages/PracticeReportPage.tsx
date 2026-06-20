import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Activity, ArrowLeft, Clock3, Gauge, ShieldCheck } from 'lucide-react'
import type { MetricKey, PracticeReport } from '../../shared/contracts'
import { loadGrowthReport } from '../features/practice-room/growth'
import { loadPracticeReport } from '../features/practice-room/reportStore'

const metricDetails: Record<MetricKey, { weight: string; method: string; boundary: string }> = {
  pitch: { weight: '30%', method: '音分偏差、准确帧比例、长音漂移', boundary: '允许八度等价；必须有人工校正参考旋律' },
  rhythm: { weight: '25%', method: '乐句开口、结束和连续发声区间偏差', boundary: '依赖歌词与节拍窗口，不评价个人律动风格' },
  breath: { weight: '15%', method: '乐句完成率、句中停顿、长音衰减', boundary: '仅由麦克风信号推测，不等同生理呼吸检测' },
  expression: { weight: '15%', method: '段落动态、关键词能量与句尾层次', boundary: '评价声音层次，不推断用户真实情绪' },
  consistency: { weight: '15%', method: '前后半段、重复段落与有效音高稳定度', boundary: '需要足够连续且可比较的演唱样本' },
}

export default function PracticeReportPage() {
  const { songId = 'trajectory', sessionId } = useParams()
  const navigate = useNavigate()
  const [report, setReport] = useState<PracticeReport | null>(() => sessionId ? null : loadPracticeReport(songId))
  const [loading, setLoading] = useState(Boolean(sessionId))

  useEffect(() => {
    if (!sessionId) return
    loadGrowthReport(sessionId).then(setReport).catch(() => setReport(null)).finally(() => setLoading(false))
  }, [sessionId])

  if (loading) return <main className="practice-mobile practice-empty"><p>正在打开历史报告…</p></main>
  if (!report) return <main className="practice-mobile practice-empty"><p>这次练习只有旧版趋势摘要，没有完整表现报告。</p><button className="practice-primary" onClick={() => navigate('/growth')}>返回成长档案</button></main>

  const backPath = sessionId ? '/growth' : `/practice/${report.songId}/recap`
  return <main className="practice-mobile report-page">
    <header className="practice-top"><button onClick={() => navigate(backPath)}><ArrowLeft size={19} /></button><b>{sessionId ? '历史表现报告' : '本次表现报告'}</b><span /></header>
    <section className="report-overall"><small>本次表现 · 只代表这一遍</small><strong>{report.overallScore ?? '—'}</strong><p>{report.status === 'complete' ? '五项指标均达到有效数据门槛' : report.dataQuality.reasons.join('；') || '部分数据不足'}</p></section>
    <section className="report-quality"><div><Activity /><span><b>{Math.round(report.dataQuality.vocalCoverage * 100)}%</b><small>有效演唱覆盖</small></span></div><div><Gauge /><span><b>{Math.round(report.dataQuality.pitchConfidence * 100)}%</b><small>音高检测置信度</small></span></div><div><ShieldCheck /><span><b>{report.dataQuality.noiseFloorDb.toFixed(0)} dB</b><small>环境噪声基线</small></span></div></section>
    <section className="metric-list">{report.metrics.map((metric) => { const detail = metricDetails[metric.key]; return <article key={metric.key} className={metric.status === 'ok' ? '' : 'muted'}><div className="metric-heading"><span><b>{metric.label}</b><em>权重 {detail.weight}</em></span><strong>{metric.score ?? '—'}</strong></div><span className="metric-bar"><i style={{ width: `${metric.score ?? 0}%` }} /></span><div className="metric-confidence"><span>证据置信度</span><b>{Math.round(metric.confidence * 100)}%</b></div><dl><div><dt>测量方式</dt><dd>{detail.method}</dd></div><div><dt>本次证据</dt><dd>{metric.evidence}</dd></div><div><dt>练习建议</dt><dd>{metric.suggestion}</dd></div><div><dt>解释边界</dt><dd>{detail.boundary}</dd></div></dl>{metric.segments.length > 0 && <div className="evidence-segments"><Clock3 size={14} />{metric.segments.map((segment) => <span key={`${segment.startSec}-${segment.endSec}`}>{formatTime(segment.startSec)}–{formatTime(segment.endSec)}</span>)}</div>}</article> })}</section>
    <div className="report-disclaimer"><ShieldCheck size={16} /><span>总分仅在五项指标都有可信证据时按 30/25/15/15/15 聚合；LLM 不参与算分。</span></div>
  </main>
}

function formatTime(seconds: number): string {
  const minutes = Math.floor(seconds / 60)
  return `${minutes}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`
}
