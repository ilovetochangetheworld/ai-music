import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useStore } from '../store'
import { emotionColor } from '../lib/lifeParser'

export default function SharePage() {
  const { id } = useParams()
  const nav = useNavigate()
  const { getSoundtrack } = useStore()
  const [copied, setCopied] = useState(false)
  const st = id ? getSoundtrack(id) : null

  if (!st) {
    return (
      <main className="empty shell">
        <p>这张分享卡已经过期或不存在。</p>
        <button className="btn btn-primary" onClick={() => nav('/')}>回首页 →</button>
      </main>
    )
  }

  const topSongs = st.scenes.flatMap((s) => s.recommendedSongs).slice(0, 3)
  const maxE = Math.max(...st.moodPath.map((m) => m.energy), 1)

  function copy() {
    navigator.clipboard?.writeText(st!.shareCopy).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <main className="share-wrap shell">
      <motion.div
        className="poster"
        initial={{ opacity: 0, y: 30, rotateX: 8 }}
        animate={{ opacity: 1, y: 0, rotateX: 0 }}
        transition={{ duration: 0.7, ease: 'easeOut' }}
      >
        <span className="p-eyebrow">My Soundtrack · {st.date}</span>
        <div className="p-title display">{st.title}</div>
        <div className="p-sub">{st.subtitle}</div>

        <div className="p-mood">
          {st.moodPath.map((m, i) => (
            <div
              key={i}
              className="bar"
              style={{ height: `${(m.energy / maxE) * 100}%`, background: emotionColor(m.label) }}
              title={`${m.label} · ${m.energy}`}
            />
          ))}
        </div>

        <div className="p-songs">
          {topSongs.map((s) => (
            <div className="row" key={s.id}>
              <span>{s.title}</span>
              <span className="ar">{s.artist}</span>
            </div>
          ))}
        </div>

        <div className="p-copy">{st.shareCopy}</div>
        <div className="p-foot">人生原声机 · SOUNDTRACK OF LIFE</div>
      </motion.div>

      <div className="result-actions">
        <button className="btn btn-primary" onClick={copy}>{copied ? '已复制 ✓' : '复制分享文案'}</button>
        <button className="btn" onClick={() => nav('/soundtrack')}>返回结果</button>
      </div>
      <p className="hint">提示：直接对这张卡片截图即可分享到社交平台。</p>
    </main>
  )
}
