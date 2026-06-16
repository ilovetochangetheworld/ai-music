import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useStore } from '../store'
import { generateSoundtrack } from '../lib/lifeParser'
import { analyzeTranscript, SAMPLE_TRANSCRIPT, parsePastedTranscript } from '../lib/transcriptAnalyzer'
import QQMusicLogin from '../components/QQMusicLogin'

type Mode = 'life' | 'audio'

const LIFE_EXAMPLES = [
  '今天早上通勤很堵，上午做了一个重要汇报，下午被老板夸了，晚上想一个人散步，不想太兴奋，想慢慢放松。',
  '今天面试失败了，下午下雨，回家的路上突然觉得很累。但我不想听太惨的歌，想要一点点被接住，然后慢慢恢复。',
]

const fade = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
}

export default function HomePage() {
  const nav = useNavigate()
  const { setSoundtrack, setAnalysis } = useStore()
  const [mode, setMode] = useState<Mode>('life')
  const [lifeText, setLifeText] = useState('')
  const [audioText, setAudioText] = useState('')
  const [loading, setLoading] = useState<string | null>(null)

  async function runLife() {
    if (!lifeText.trim()) return
    setLoading('正在把今天拆成几段声音…')
    const st = await generateSoundtrack(lifeText.trim(), { languages: ['mandarin', 'cantonese'] })
    setSoundtrack(st)
    setLoading(null)
    nav('/soundtrack')
  }

  async function runAudio() {
    setLoading('正在为这段长音频画章节地图…')
    let title = SAMPLE_TRANSCRIPT.title
    let segments = SAMPLE_TRANSCRIPT.segments
    if (audioText.trim()) {
      const parsed = parsePastedTranscript(audioText.trim())
      title = parsed.title
      segments = parsed.segments
    }
    const analysis = await analyzeTranscript(title, segments)
    setAnalysis(analysis)
    setLoading(null)
    nav('/audio-coach')
  }

  return (
    <main className="home shell">
      {loading && (
        <div className="veil">
          <div className="ring" />
          <p className="msg">{loading}</p>
        </div>
      )}

      <motion.section className="hero" {...fade} transition={{ duration: 0.6 }}>
        <span className="eyebrow">AI 音频体验原型</span>
        <h1 className="display">
          把今天，<br />听成一张<em>电影原声带</em>。
        </h1>
        <p className="lead">
          人生原声机读懂你一天的轨迹与情绪，编排成可播放、可解释、可分享的私人声音体验；
          也能把一段长长的播客，变成可导航、可速听、可追问的音频地图。
        </p>
      </motion.section>

      <div className="tabs">
        <button className={`tab ${mode === 'life' ? 'active' : ''}`} onClick={() => setMode('life')}>
          <span className="idx">A</span>日轨 BGM
        </button>
        <button className={`tab ${mode === 'audio' ? 'active' : ''}`} onClick={() => setMode('audio')}>
          <span className="idx">B</span>长音频速听
        </button>
      </div>

      {mode === 'life' ? (
        <motion.div className="composer" key="life" {...fade} transition={{ duration: 0.4 }}>
          <textarea
            value={lifeText}
            onChange={(e) => setLifeText(e.target.value)}
            placeholder="今天发生了什么？把它写下来，越具体越好。比如：早上通勤很堵、下午被夸、晚上想一个人慢慢走…"
          />
          <div className="examples">
            <span className="label">试试示例</span>
            {LIFE_EXAMPLES.map((ex, i) => (
              <button key={i} className="ex-chip" onClick={() => setLifeText(ex)}>
                {i === 0 ? '松弛的一天' : '失落后慢慢恢复'}
              </button>
            ))}
          </div>
          <div className="composer-actions">
            <button className="btn btn-primary" onClick={runLife} disabled={!lifeText.trim()}>
              生成今日原声带 →
            </button>
            <span className="hint">无需联网或密钥，本地即可生成完整结果。</span>
          </div>
        </motion.div>
      ) : (
        <motion.div className="composer" key="audio" {...fade} transition={{ duration: 0.4 }}>
          <textarea
            value={audioText}
            onChange={(e) => setAudioText(e.target.value)}
            placeholder="粘贴一段播客 / 有声书的转写文本（第一行可作为标题）。留空则使用内置示例播客《AI 音乐会如何改变创作者经济》。"
          />
          <div className="examples">
            <span className="label">示例</span>
            <button className="ex-chip" onClick={() => setAudioText('')}>
              用内置 AI 音乐播客
            </button>
          </div>
          <div className="composer-actions">
            <button className="btn btn-primary" onClick={runAudio}>
              生成章节地图 →
            </button>
            <span className="hint">支持「只听版权风险部分」这样的自然语言追问。</span>
          </div>
        </motion.div>
      )}

      <section className="features">
        <div className="feature">
          <span className="n">01</span>
          <h4>情绪轨迹</h4>
          <p>把一句话拆成几段有起伏的场景，画出今天的情绪曲线。</p>
        </div>
        <div className="feature">
          <span className="n">02</span>
          <h4>分场景 BGM 与电台旁白</h4>
          <p>每段配 2-3 首歌，附上「为什么是它」，再加一段深夜电台口播。</p>
        </div>
        <div className="feature">
          <span className="n">03</span>
          <h4>长音频速听导航</h4>
          <p>自动章节、3 分钟速听、按问题跳到该听的时间片段。</p>
        </div>
      </section>

      <QQMusicLogin />
    </main>
  )
}
