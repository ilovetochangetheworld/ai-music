import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Gauge, Headphones, Mic2, RotateCcw, ShieldCheck } from 'lucide-react'
import XiaoMai from '../components/XiaoMai'
import { loadPracticeManifest } from '../features/practice-room/catalog'
import { DEFAULT_ROOM_SETTINGS, type SingRoomSettings } from '../features/sing-room/types'
import { saveSettings } from '../features/sing-room/session'
import type { PracticeSongManifest } from '../../shared/contracts'
import { latencyCalibrationSkippedThisSession, loadLatencyCalibration } from '../features/practice-room/latencyCalibration'

export default function PracticeSetupPage() {
  const { songId = 'trajectory' } = useParams()
  const navigate = useNavigate()
  const [song, setSong] = useState<PracticeSongManifest | null>(null)
  const [settings, setSettings] = useState<SingRoomSettings>(DEFAULT_ROOM_SETTINGS)
  const [latencyCalibration] = useState(loadLatencyCalibration)
  const isImported = songId.startsWith('upload-')

  useEffect(() => {
    loadPracticeManifest(songId).then(setSong).catch(() => navigate('/songs'))
  }, [navigate, songId])

  function start() {
    saveSettings({ ...settings, practiceMode: 'free', autoRescue: false })
    if (!latencyCalibration && !latencyCalibrationSkippedThisSession()) {
      navigate(`/practice/${songId}/latency-calibration?next=sing`)
      return
    }
    navigate(`/practice/${songId}/sing`)
  }

  return <main className="practice-mobile warm-room-page setup-design">
    <header className="warm-page-header"><button onClick={() => navigate('/songs')}><ArrowLeft /></button><h1>准备开唱</h1><span /></header>
    <section className="setup-companion"><div className="companion-speech">完整唱一遍，剩下的交给我</div><XiaoMai state="ready" /></section>
    <section className="setup-song-card"><small>本次歌曲</small><h1>{song?.title ?? '加载中'}</h1><p>{song?.artist} · 难度 {song?.difficulty}/5</p><span>唱中不打断 · 唱后五维分析</span></section>
    {isImported && <div className="setup-notice"><ShieldCheck /><span>这是本地原曲跟唱素材，尚未完成人声分轨和参考旋律校正；数据不足时不会生成音高分数。</span></div>}
    <section className="setup-options"><label><span><b>保留本次录音</b><small>仅保存在当前设备，可随时删除</small></span><input type="checkbox" checked={settings.retainRecording} onChange={(event) => setSettings((current) => ({ ...current, retainRecording: event.target.checked }))} /></label></section>
    <section className="setup-latency"><Gauge /><span><b>{latencyCalibration ? latencyCalibration.status === 'valid' ? `节奏已校准 · ${latencyCalibration.offsetMs}ms` : '校准可信度较低' : '首次开唱需要延迟校准'}</b><small>{latencyCalibration ? `有效样本 ${latencyCalibration.sampleCount}/6 · ${latencyCalibration.confidence === 'high' ? '高' : latencyCalibration.confidence === 'medium' ? '中' : '低'}置信度` : '跟拍 6 下，仅保存在本机，也可以跳过'}</small></span><button onClick={() => navigate(`/practice/${songId}/latency-calibration`)}>{latencyCalibration ? <><RotateCcw />重测</> : '去校准'}</button></section>
    <div className="setup-headphone"><Headphones /><span><b>建议佩戴耳机</b><small>开始后将申请麦克风权限，并用 3 秒校准环境底噪。</small></span></div>
    <button className="practice-primary setup-start" onClick={start} disabled={!song}><Mic2 />开始练歌</button>
    <p className="setup-privacy"><ShieldCheck />小麦默认安静倾听，不会在演唱中实时纠错。</p>
  </main>
}
