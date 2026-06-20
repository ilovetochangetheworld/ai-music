import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, FlaskConical, RefreshCw } from 'lucide-react'
import { loadPracticeReport } from '../features/practice-room/reportStore'
import { loadSessionRecording } from '../features/sing-room/recording'

const tuningEnabled = import.meta.env.VITE_ENABLE_TUNING_DEMO === 'true'
export default function PracticeHighlightPage() {
  const { songId = 'trajectory' } = useParams(); const navigate = useNavigate(); const report = loadPracticeReport(songId); const recording = loadSessionRecording(); const highlight = report?.highlights[0]
  return <main className="practice-mobile"><header className="practice-top"><button onClick={() => navigate(`/practice/${songId}/recap`)}><ArrowLeft size={19} /></button><b>今日高光</b><span /></header><section className="highlight-card"><small>{highlight ? `${highlight.startSec.toFixed(1)}s–${highlight.endSec.toFixed(1)}s` : '等待有效高光'}</small><h1>小麦为你记下这一段</h1>{recording ? <audio controls src={recording.url} /> : <p>当前会话没有可回放录音。</p>}</section><section className="tuning-card"><FlaskConical /><h2>AI 轻修实验</h2><p>{tuningEnabled ? '本地 GPU 服务已启用时，可生成 8–12 秒 A/B 对照。' : '公网默认关闭。原声永远保留，修音不会克隆或覆盖你的声音。'}</p><button disabled={!tuningEnabled}>生成 AI 轻修版</button></section><button className="practice-primary" onClick={() => navigate(`/practice/${songId}/sing`)}><RefreshCw size={18} />再唱一次</button></main>
}
