import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Activity, ArrowLeft, Download, Mic2, Play, RefreshCw, Sparkles, TimerReset, Trash2, Waves } from 'lucide-react'
import { loadRecap } from '../features/sing-room/recap'
import { deleteSessionRecording, loadSessionRecording } from '../features/sing-room/recording'
import { loadPracticeSong } from '../features/sing-room/session'
import type { SingingRecap, SongTimeline } from '../features/sing-room/types'
import { loadPracticeReport } from '../features/practice-room/reportStore'
import XiaoMai from '../components/XiaoMai'

export default function SingRoomRecapPage() {
  const { songId = 'trajectory' } = useParams()
  const navigate = useNavigate()
  const [recap, setRecap] = useState<SingingRecap | null>(() => loadRecap())
  const [timeline, setTimeline] = useState<SongTimeline | null>(null)
  const [recording, setRecording] = useState(() => loadSessionRecording())
  const [playingHighlight, setPlayingHighlight] = useState(false)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const highlightTimerRef = useRef<number | null>(null)

  useEffect(() => {
    loadPracticeSong(songId).then(({ timeline: loaded }) => setTimeline(loaded)).catch(() => undefined)
    return () => {
      if (highlightTimerRef.current) window.clearTimeout(highlightTimerRef.current)
    }
  }, [songId])

  if (!recap) {
    return (
      <main className="sing-recap empty shell">
        <p>还没有这一局的演唱记录。</p>
        <button className="sing-primary-command" onClick={() => navigate(`/practice/${songId}`)}>开始练歌</button>
      </main>
    )
  }

  const highlight = timeline?.lines.find((line) => line.id === recap?.highlightLineId)
  const participation = Math.round(recap.participationRate * 100)
  const openedUp = recap.recoveredRescueCount > 0 || recap.secondHalfParticipation > recap.firstHalfParticipation + 0.03
  const review = recap.review
  const practiceReport = loadPracticeReport(songId)

  function removeRecording() {
    audioRef.current?.pause()
    if (highlightTimerRef.current) window.clearTimeout(highlightTimerRef.current)
    deleteSessionRecording()
    setRecording(null)
    setRecap((current) => current ? { ...current, recordingAvailable: false } : current)
  }

  async function playHighlight() {
    const audio = audioRef.current
    const start = recap?.highlightStartSec
    const end = recap?.highlightEndSec
    if (!audio || start == null || end == null || end <= start) return
    if (highlightTimerRef.current) window.clearTimeout(highlightTimerRef.current)
    audio.pause()
    audio.currentTime = Math.min(start, Math.max(0, recording?.durationSec ?? start))
    try {
      await audio.play()
      setPlayingHighlight(true)
      highlightTimerRef.current = window.setTimeout(() => {
        audio.pause()
        setPlayingHighlight(false)
      }, Math.max(500, (end - start) * 1000))
    } catch {
      setPlayingHighlight(false)
    }
  }

  return (
    <main className="sing-recap">
      <section className="recap-hero shell">
        <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }}>
          <span className="eyebrow">小麦的练歌手记</span>
          <h1>这首，<em>我认真听完了。</em></h1>
          <p>{practiceReport?.headline ?? review?.headline ?? (openedUp ? '后半段明显更敢开口，小麦接唱后你稳稳接回来了。' : '你一直按自己的节奏唱，安静也算一种完整表达。')}</p>
        </motion.div>
        <XiaoMai state="notebook" />
        <div className="recap-score" aria-label={`演唱参与度 ${participation}%`}>
          <strong>{participation}</strong><span>%</span><small>开口参与 · 非总分</small>
        </div>
      </section>

      {review && (
        <section className="recap-review shell">
          <div className="review-heading">
            <span className="section-label"><Activity size={16} /> 声音回看</span>
            <p>只根据本次麦克风检测结果生成，不评价天赋，也不替代专业声乐诊断。</p>
          </div>
          <div className="review-grid">
            <ReviewMetric label="开口参与" value={review.engagement} icon={<Mic2 />} />
            <ReviewMetric label="声音清晰" value={review.clarity} icon={<Waves />} />
            <ReviewMetric label="音高连续" value={review.pitchContinuity} icon={<Activity />} />
            <ReviewMetric label="救场接回" value={review.recovery} icon={<RefreshCw />} />
          </div>
          <div className="review-copy">
            <p>{review.detail}</p>
            <p><b>下次试试</b>{review.suggestion}</p>
          </div>
        </section>
      )}

      <section className="recap-recording shell">
        <div>
          <span className="section-label"><Waves size={16} /> 我的现场录音</span>
          <p>录音没有上传，只存在当前页面会话中。</p>
        </div>
        {recording ? (
          <div className="recording-player">
            <audio ref={audioRef} controls src={recording.url} preload="metadata" onPause={() => setPlayingHighlight(false)} onEnded={() => setPlayingHighlight(false)}>你的浏览器不支持录音回放。</audio>
            {recap.highlightStartSec != null && recap.highlightEndSec != null && (
              <button className="recording-action highlight" onClick={() => void playHighlight()}><Play size={17} />{playingHighlight ? '高光播放中' : '回放高光'}</button>
            )}
            <a className="recording-action" href={recording.url} download={`AI声友局-轨迹.${recording.mimeType.includes('mp4') ? 'm4a' : 'webm'}`}><Download size={17} />保存录音</a>
            <button className="recording-action danger" onClick={removeRecording}><Trash2 size={17} />删除</button>
          </div>
        ) : (
          <p className="recording-empty">{recap.recordingAvailable ? '页面刷新后临时录音已释放。' : '本局没有麦克风录音，评价仅展示可用数据。'}</p>
        )}
      </section>

      <section className="recap-band">
        <div className="shell recap-metrics">
          <Metric icon={<Mic2 />} value={`${recap.rescueCount}`} label="小麦接唱" suffix="次" />
          <Metric icon={<RefreshCw />} value={`${recap.recoveredRescueCount}`} label="成功接回" suffix="次" />
          <Metric icon={<TimerReset />} value={`${Math.round(recap.longestContinuousSingingSec)}`} label="最长连续演唱" suffix="秒" />
        </div>
      </section>

      <section className="recap-highlight shell">
        <span className="section-label"><Sparkles size={16} /> 今日高光</span>
        <blockquote>{highlight ? `“${highlight.text}”` : '你在副歌里重新开口的那一刻。'}</blockquote>
        <p>小麦：{recap.recoveredRescueCount ? '中间停一下没关系，重要的是你又把主唱接回来了。' : '这一首没有人催你，你还是按自己的节奏唱到了最后。'}</p>
      </section>

      <div className="recap-actions shell">
        <button className="icon-command" title="返回选歌" onClick={() => navigate('/songs')}><ArrowLeft size={19} /></button>
        <button className="recording-action" onClick={() => navigate(`/practice/${songId}/highlight`)}>查看高光</button>
        <button className="recording-action" onClick={() => navigate(`/practice/${songId}/report`)}>五维报告</button>
        <button className="sing-primary-command" onClick={() => navigate(`/practice/${songId}/sing`)}>再唱一次 <RefreshCw size={18} /></button>
      </div>
    </main>
  )
}

function Metric({ icon, value, label, suffix }: { icon: React.ReactNode; value: string; label: string; suffix: string }) {
  return <div className="recap-metric"><span>{icon}</span><strong>{value}</strong><small>{suffix}</small><p>{label}</p></div>
}

function ReviewMetric({ icon, value, label }: { icon: React.ReactNode; value: number | null; label: string }) {
  return (
    <div className="review-metric">
      <span>{icon}</span><b>{label}</b><strong>{value === null ? '—' : value}<small>{value === null ? '数据不足' : '%'}</small></strong>
      <i><em style={{ width: `${value ?? 0}%` }} /></i>
    </div>
  )
}
