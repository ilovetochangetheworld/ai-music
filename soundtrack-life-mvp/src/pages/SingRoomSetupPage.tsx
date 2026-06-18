import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Check, Headphones, Mic2, Radio, Sparkles, Users } from 'lucide-react'
import { DEFAULT_ROOM_SETTINGS, type InteractionLevel, type SingRoomSettings } from '../features/sing-room/types'
import { saveSettings } from '../features/sing-room/session'

const levels: Array<{ id: InteractionLevel; label: string; copy: string }> = [
  { id: 'quiet', label: '安静', copy: '只在忘词时接住你' },
  { id: 'balanced', label: '适中', copy: '副歌陪唱，关键处回应' },
  { id: 'lively', label: '热闹', copy: '更多和声、掌声与捧场' },
]

export default function SingRoomSetupPage() {
  const navigate = useNavigate()
  const [settings, setSettings] = useState<SingRoomSettings>(DEFAULT_ROOM_SETTINGS)

  function enterRoom() {
    saveSettings(settings)
    navigate('/sing-room/trajectory')
  }

  return (
    <main className="sing-setup">
      <section className="sing-setup-intro shell">
        <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }}>
          <span className="eyebrow">AI 声友局 · 热闹朋友局</span>
          <h1>一个人开麦，<br /><em>也有人接住。</em></h1>
          <p>没人打分。唱不上去的地方阿和会接，唱回来以后，主唱还是你。</p>
        </motion.div>

        <div className="song-signal" aria-label="本次演唱歌曲">
          <div className="song-vinyl" aria-hidden="true"><span /></div>
          <div>
            <span className="mono">今晚第一首</span>
            <h2>轨迹</h2>
            <p>周杰伦 · 80 秒路演精剪 · AI 接唱版</p>
          </div>
        </div>
      </section>

      <section className="sing-config-band">
        <div className="shell sing-config-grid">
          <div className="config-column">
            <div className="config-heading"><Users size={18} /><span>今天谁陪你</span></div>
            <div className="friend-list">
              <Friend name="小麦" role="主持人" color="coral" copy="暖场和控制节奏" />
              <Friend name="阿和" role="合唱搭子" color="teal" copy="副歌和声、忘词补位" />
              <Friend name="大声" role="听众" color="amber" copy="只为真正的高光欢呼" />
            </div>
          </div>

          <div className="config-column">
            <div className="config-heading"><Radio size={18} /><span>互动强度</span></div>
            <div className="level-control" role="radiogroup" aria-label="互动强度">
              {levels.map((level) => (
                <button
                  key={level.id}
                  className={settings.interactionLevel === level.id ? 'active' : ''}
                  onClick={() => setSettings((current) => ({ ...current, interactionLevel: level.id }))}
                  role="radio"
                  aria-checked={settings.interactionLevel === level.id}
                >
                  <b>{level.label}</b><span>{level.copy}</span>
                </button>
              ))}
            </div>

            <label className="config-toggle">
              <span><Sparkles size={17} /><b>自动救场</b><small>连续停唱后，阿和从当前句接入</small></span>
              <input
                type="checkbox"
                checked={settings.autoRescue}
                onChange={(event) => setSettings((current) => ({ ...current, autoRescue: event.target.checked }))}
              />
            </label>

            <label className="config-toggle">
              <span><Mic2 size={17} /><b>路演模式</b><small>从第二轮主歌开始，快速进入救场段</small></span>
              <input
                type="checkbox"
                checked={settings.demoMode}
                onChange={(event) => setSettings((current) => ({ ...current, demoMode: event.target.checked }))}
              />
            </label>
          </div>
        </div>
      </section>

      <div className="sing-setup-action shell">
        <div><Headphones size={19} /><span>建议佩戴耳机；演唱录音仅保留在当前浏览器，可随时删除</span></div>
        <button className="sing-primary-command" onClick={enterRoom}>进入包厢 <Check size={18} /></button>
      </div>
    </main>
  )
}

function Friend({ name, role, copy, color }: { name: string; role: string; copy: string; color: string }) {
  return (
    <div className="friend-row">
      <span className={`friend-avatar ${color}`}>{name.slice(-1)}</span>
      <span><b>{name}</b><small>{role}</small></span>
      <p>{copy}</p>
      <Check size={17} />
    </div>
  )
}
