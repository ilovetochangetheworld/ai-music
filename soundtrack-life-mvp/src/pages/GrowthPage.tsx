import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, ChevronRight, Database, Trash2, TrendingUp } from 'lucide-react'
import { buildMetricTrends, clearGrowthReports, listGrowthReports, type GrowthEntry } from '../features/practice-room/growth'
import { metricLabels } from '../features/practice-room/catalog'

export default function GrowthPage() {
  const navigate = useNavigate()
  const [entries, setEntries] = useState<GrowthEntry[]>([])
  useEffect(() => { listGrowthReports().then(setEntries).catch(() => setEntries([])) }, [])
  const trends = useMemo(() => buildMetricTrends(entries), [entries])
  async function clear() { await clearGrowthReports(); setEntries([]) }

  return <main className="practice-mobile growth-page">
    <header className="practice-top"><button onClick={() => navigate('/')}><ArrowLeft size={19} /></button><b>成长档案</b><button onClick={() => void clear()} aria-label="清空成长档案"><Trash2 size={17} /></button></header>
    <section className="growth-hero"><TrendingUp /><h1>看见稳定发生的变化</h1><p>按五项声乐指标追踪有效练习，不排名，也不拿一次分数定义你。</p></section>
    <section className="growth-metrics"><div className="section-title"><h2>五维能力趋势</h2><small>近 3 次有效表现 vs 前 3 次</small></div>{trends.map((trend) => <article key={trend.key}><div><b>{metricLabels[trend.key]}</b><small>{trend.validSessions ? `${trend.validSessions} 次有效样本 · 置信度 ${Math.round(trend.averageConfidence * 100)}%` : '等待有效样本'}</small></div><strong>{trend.latest ?? '—'}</strong><em className={trend.delta !== null && trend.delta < 0 ? 'down' : ''}>{trend.delta === null ? '趋势待积累' : `${trend.delta >= 0 ? '+' : ''}${trend.delta}`}</em></article>)}</section>
    <section className="growth-history"><div className="section-title"><h2>历次练习</h2><small>{entries.length} 次记录</small></div>{entries.length ? entries.map((entry) => <button key={entry.id} onClick={() => navigate(`/growth/${entry.id}`)}><span><b>{entry.songTitle ?? (entry.songId === 'trajectory' ? '轨迹' : entry.songId)}</b><small>{new Date(entry.createdAt).toLocaleString()}</small></span><strong>{entry.overallScore ?? '数据不足'}</strong><ChevronRight size={17} /></button>) : <div className="growth-empty"><Database /><p>完成第一次练习后，报告和趋势会保存在这里。</p></div>}</section>
  </main>
}
