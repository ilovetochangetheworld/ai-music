import { useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Pause, Play, RefreshCw, Sparkles, WandSparkles } from 'lucide-react'
import XiaoMai from '../components/XiaoMai'
import { loadPracticeReport } from '../features/practice-room/reportStore'
import { loadSessionRecording } from '../features/sing-room/recording'

const tuningEnabled = import.meta.env.VITE_ENABLE_TUNING_DEMO === 'true'

export default function PracticeHighlightPage() {
  const { songId = 'trajectory' } = useParams()
  const navigate = useNavigate()
  const report = loadPracticeReport(songId)
  const recording = loadSessionRecording()
  const highlight = report?.highlights[0]
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const timerRef = useRef<number | null>(null)
  const [playing, setPlaying] = useState(false)

  async function toggleHighlight() {
    const audio = audioRef.current
    if (!audio || !highlight) return
    if (playing) { audio.pause(); setPlaying(false); return }
    audio.currentTime = highlight.startSec
    try {
      await audio.play(); setPlaying(true)
      if (timerRef.current) window.clearTimeout(timerRef.current)
      timerRef.current = window.setTimeout(() => { audio.pause(); setPlaying(false) }, Math.max(500, (highlight.endSec - highlight.startSec) * 1000))
    } catch { setPlaying(false) }
  }

  return <main className="practice-mobile highlight-design warm-room-page">
    <header className="warm-page-header"><button onClick={() => navigate(`/practice/${songId}/recap`)}><ArrowLeft /></button><h1>高光片段</h1><span /></header>
    <section className="highlight-room-scene"><div className="highlight-meta"><b>♪ {songId === 'trajectory' ? '轨迹 · 周杰伦' : '本次练习'}</b><small>{highlight ? `${formatTime(highlight.startSec)} – ${formatTime(highlight.endSec)}` : '等待有效高光'}</small></div><div className="companion-speech">{highlight ? '我抓到高光了' : '再多唱一点，我来帮你找高光'}</div><XiaoMai state="cheering" /></section>
    <section className="highlight-player-card"><div className="section-title"><div><h2><Sparkles />高光片段</h2><p>{highlight ? report?.headline : '需要有效录音和演唱证据才能生成高光。'}</p></div>{highlight && <span>太棒了！</span>}</div>
      <div className="highlight-wave" aria-hidden="true">{Array.from({ length: 38 }).map((_, index) => <i key={index} style={{ height: `${18 + ((index * 17) % 42)}%` }} />)}</div>
      {recording ? <><audio ref={audioRef} src={recording.url} onPause={() => setPlaying(false)} /><button className="highlight-play" disabled={!highlight} onClick={() => void toggleHighlight()}>{playing ? <Pause /> : <Play />}{playing ? '暂停高光' : '播放高光'}</button></> : <p className="highlight-empty">当前会话没有可回放录音。</p>}
      <div className="highlight-actions"><button disabled={!tuningEnabled}><WandSparkles />AI轻修对照</button><button onClick={() => navigate(`/practice/${songId}/sing`)}><RefreshCw />再唱一遍</button></div>
      <small className="tuning-note">AI 轻修公网默认关闭，原声永远保留且不会克隆你的声音。</small>
    </section>
  </main>
}

function formatTime(seconds: number): string { return `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}` }
