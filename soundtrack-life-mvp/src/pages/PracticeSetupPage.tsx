import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Check, Headphones, Mic2 } from 'lucide-react'
import XiaoMai from '../components/XiaoMai'
import { loadPracticeManifest } from '../features/practice-room/catalog'
import { DEFAULT_ROOM_SETTINGS, type SingRoomSettings } from '../features/sing-room/types'
import { saveSettings } from '../features/sing-room/session'
import type { PracticeSongManifest } from '../../shared/contracts'

const modes = [
  { id: 'free', label: '自由唱', copy: '完整唱完，唱后分析' },
  { id: 'pitch', label: '练音高', copy: '唱后聚焦音高证据' },
  { id: 'rhythm', label: '练节奏', copy: '唱后聚焦开口和时值' },
  { id: 'breath', label: '练呼吸', copy: '唱后聚焦长句完成度' },
] as const

export default function PracticeSetupPage() {
  const { songId = 'trajectory' } = useParams()
  const navigate = useNavigate()
  const [song, setSong] = useState<PracticeSongManifest | null>(null)
  const [settings, setSettings] = useState<SingRoomSettings>(DEFAULT_ROOM_SETTINGS)
  const isImported = songId.startsWith('upload-')

  useEffect(() => {
    loadPracticeManifest(songId).then(setSong).catch(() => navigate('/songs'))
    if (isImported) setSettings((current) => ({ ...current, practiceMode: 'free', autoRescue: false }))
  }, [isImported, navigate, songId])

  function start() {
    saveSettings(settings)
    navigate(`/practice/${songId}/sing`)
  }

  return <main className="practice-mobile">
    <header className="practice-top"><button onClick={() => navigate('/songs')}><ArrowLeft size={19} /></button><b>本次练习</b><span /></header>
    <section className="setup-song"><XiaoMai state="ready" compact /><div><small>小麦建议先完整唱一遍</small><h1>{song?.title ?? '加载中'}</h1><p>{song?.artist} · 难度 {song?.difficulty}/5</p></div></section>
    {isImported && <div className="practice-consent"><Headphones size={17} /><span>这是本地原曲跟唱素材，尚未进行人声分轨和参考旋律校正；接唱、和声与音高专项暂不可用。</span></div>}
    <section className="practice-section"><h2>选择练习方式</h2><div className="mode-grid">{modes.map((mode) => <button key={mode.id} disabled={isImported && mode.id === 'pitch'} className={settings.practiceMode === mode.id ? 'active' : ''} onClick={() => setSettings((current) => ({ ...current, practiceMode: mode.id }))}><b>{mode.label}</b><small>{isImported && mode.id === 'pitch' ? '等待参考旋律校正' : mode.copy}</small>{settings.practiceMode === mode.id && <Check size={16} />}</button>)}</div></section>
    <section className="practice-section"><h2>小麦怎么陪</h2>
      <label className="practice-switch"><span><b>安静倾听</b><small>默认不主动接唱、不打断</small></span><input type="checkbox" checked={!settings.autoRescue} onChange={() => setSettings((current) => ({ ...current, autoRescue: false }))} /></label>
      <label className="practice-switch"><span><b>保留本次录音</b><small>仅在当前设备，可随时删除</small></span><input type="checkbox" checked={settings.retainRecording} onChange={(event) => setSettings((current) => ({ ...current, retainRecording: event.target.checked }))} /></label>
    </section>
    <div className="practice-consent"><Headphones size={17} /><span>建议佩戴耳机。点击开始后会申请麦克风并进行环境校准。</span></div>
    <button className="practice-primary" onClick={start} disabled={!song}><Mic2 size={19} />开始练歌</button>
  </main>
}
