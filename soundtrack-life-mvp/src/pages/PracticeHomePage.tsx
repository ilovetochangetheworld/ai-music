import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRight, BarChart3, Mic2, Sparkles } from 'lucide-react'
import XiaoMai from '../components/XiaoMai'
import { loadCatalog, metricLabels, type CatalogSongSummary } from '../features/practice-room/catalog'

export default function PracticeHomePage() {
  const navigate = useNavigate()
  const [songs, setSongs] = useState<CatalogSongSummary[]>([])
  useEffect(() => { loadCatalog().then(setSongs).catch(() => setSongs([])) }, [])
  const ready = songs.find((song) => song.availability === 'ready')
  return (
    <main className="practice-mobile practice-home">
      <header className="practice-top"><b>AI 练歌房</b><button onClick={() => navigate('/growth')}><BarChart3 size={18} />成长档案</button></header>
      <section className="practice-companion-hero">
        <XiaoMai state="ready" />
        <span>小麦</span><h1>今天想怎么练？</h1><p>我会认真听完，再把真正有用的地方告诉你。</p>
      </section>
      <div className="practice-goals"><button>轻松唱</button><button className="active">认真练</button><button>挑战一下</button></div>
      <section className="practice-card featured">
        <div><span className="practice-kicker"><Sparkles size={14} /> 小麦推荐</span><h2>{ready?.title ?? '轨迹'}</h2><p>{ready?.artist ?? '周杰伦'} · 适合练习长句、音高和稳定性</p><div className="focus-tags">{ready?.focus.map((key) => <i key={key}>{metricLabels[key]}</i>)}</div></div>
        <button disabled={!ready} onClick={() => ready && navigate(`/practice/${ready.id}`)}><Mic2 size={19} />开始练 <ArrowRight size={17} /></button>
      </section>
      <button className="practice-wide-link" onClick={() => navigate('/songs')}>查看全部可练歌曲 <ArrowRight size={18} /></button>
      <section className="practice-note"><b>专业分析，陪伴表达</b><p>唱中不打断，唱后从音高、节奏、呼吸、表达和一致性给出证据。</p></section>
    </main>
  )
}
