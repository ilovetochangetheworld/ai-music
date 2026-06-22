import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { BarChart3, BookOpen, Heart, Headphones, Home, Mic2, RefreshCw, Search, Sparkles } from 'lucide-react'
import XiaoMai from '../components/XiaoMai'
import { loadCatalog, metricLabels, type CatalogSongSummary } from '../features/practice-room/catalog'

export default function PracticeHomePage() {
  const navigate = useNavigate()
  const [songs, setSongs] = useState<CatalogSongSummary[]>([])
  useEffect(() => { loadCatalog().then(setSongs).catch(() => setSongs([])) }, [])
  const recommended = songs.slice(0, 3)
  return (
    <main className="practice-mobile practice-home warm-room-page">
      <section className="home-room-hero">
        <header><div><h1>AI练歌房</h1><p>小麦陪你，唱得更好听</p></div><button onClick={() => navigate('/growth')}><BarChart3 /><span>成长档案</span></button></header>
        <div className="room-music-note one">♪</div><div className="room-music-note two">♫</div>
        <div className="xiaomai-home"><div className="companion-speech">想唱什么歌？<br />我来帮你练</div><XiaoMai state="ready" /></div>
      </section>
      <section className="home-song-panel">
        <div className="home-search"><button className="home-search-main" onClick={() => navigate('/songs')}><Search /><span>搜索已准备歌曲或歌手</span></button><button disabled aria-label="我的收藏（规划中）"><Heart /></button></div>
        <div className="section-title"><h2>为你推荐 <Sparkles /></h2><button onClick={() => navigate('/songs')}><RefreshCw />换一组</button></div>
        <div className="home-recommendations">{recommended.map((song, index) => <article key={song.id} className={song.availability !== 'ready' ? 'disabled' : ''}>
          <span className={`song-art art-${index + 1}`}><b>{String(index + 1).padStart(2, '0')}</b><MusicGlyph /></span>
          <div><h3>{song.title}</h3><p>{song.artist} · {song.focus.slice(0, 2).map((key) => metricLabels[key]).join(' · ')}</p><i>{Array.from({ length: 5 }).map((_, level) => <em className={level < song.difficulty ? 'on' : ''} key={level} />)}</i></div>
          <Heart className="song-heart" />
          <button disabled={song.availability !== 'ready'} onClick={() => navigate(`/practice/${song.id}`)}><Mic2 />{song.availability === 'ready' ? '开始练' : '准备中'}</button>
        </article>)}</div>
      </section>
      <section className="home-shortcuts"><button onClick={() => navigate('/growth')}><span><BookOpen /></span><b>小麦练歌手记</b><small>你的专属练歌记录本</small></button><button disabled><span><Sparkles /></span><b>AI修音实验室</b><small>原声永远保留</small><i>研究中</i></button></section>
      <nav className="practice-bottom-nav"><button className="active"><Home /><span>首页</span></button><button onClick={() => navigate('/songs')}><Headphones /><span>练歌</span></button><button onClick={() => navigate('/growth')}><BarChart3 /><span>成长</span></button></nav>
    </main>
  )
}

function MusicGlyph() { return <span aria-hidden="true">♪</span> }
