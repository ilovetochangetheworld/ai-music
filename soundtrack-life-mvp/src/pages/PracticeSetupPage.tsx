import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Gauge, Mic2, RotateCcw, ShieldCheck } from 'lucide-react'
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
    <section className="setup-song-card"><small>本次歌曲</small><h1>{song?.title ?? '加载中'}</h1><p>{song?.artist} · 难度 {song?.difficulty}/5</p></section>
    {isImported && <div className="setup-notice"><ShieldCheck /><span>这是本地原曲跟唱素材，尚未完成人声分轨和参考旋律校正；数据不足时不会生成音高分数。</span></div>}
    <section className="setup-options"><label><span><b>保留本次录音</b><small>仅保存在当前设备，勾选后小麦可智能抓取高光时刻</small></span><input type="checkbox" checked={settings.retainRecording} onChange={(event) => setSettings((current) => ({ ...current, retainRecording: event.target.checked }))} /></label></section>
    <section className="setup-latency"><Gauge /><span><b>{latencyCalibration ? latencyCalibration.status === 'valid' ? '节奏已对齐' : '再校准一次会更准' : '让小麦听准节奏'}</b><small>{latencyCalibration ? latencyCalibration.status === 'valid' ? '小麦会按这台设备的延迟给出反馈。' : '这次拍手识别较少，重新跟拍 6 下，小麦就能更好对齐节奏。' : '跟拍 6 下，减少手机和耳机带来的延迟影响。'}</small></span><button onClick={() => navigate(`/practice/${songId}/latency-calibration`)}>{latencyCalibration ? <><RotateCcw />重测</> : '去校准'}</button></section>

    <button className="practice-primary setup-start" onClick={start} disabled={!song}><Mic2 />开始练歌</button>
    <p className="setup-privacy">🎵 先唱完这首歌，再看专属练习建议</p>
    <p className="setup-headphone-note">建议佩戴耳机</p>
  </main>
}





