import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useStore } from '../store'
import { emotionColor } from '../lib/lifeParser'
import { fetchQQMusicPlayUrl } from '../lib/qqMusicLogin'
import type { Song } from '../types'
import MoodCurve from '../components/MoodCurve'
import MockPlayer from '../components/MockPlayer'

export default function SoundtrackPage() {
  const nav = useNavigate()
  const { soundtrack } = useStore()
  const [active, setActive] = useState(0)
  const [nowPlaying, setNowPlaying] = useState<Song | null>(null)
  const sceneRefs = useRef<(HTMLDivElement | null)[]>([])

  if (!soundtrack) {
    return (
      <main className="empty shell">
        <p>还没有今日原声带。先回首页输入今天发生了什么吧。</p>
        <button className="btn btn-primary" onClick={() => nav('/')}>去生成 →</button>
      </main>
    )
  }

  const st = soundtrack

  function focusScene(i: number) {
    setActive(i)
    sceneRefs.current[i]?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }

  async function playSong(song: Song) {
    if (nowPlaying?.id === song.id) {
      setNowPlaying(null)
      return
    }
    if (song.mid && !song.playUrl) {
      const playUrl = await fetchQQMusicPlayUrl(song.mid, {
        mediaMid: song.mediaMid,
        songType: song.songType,
      })
      setNowPlaying(playUrl ? { ...song, playUrl } : song)
      return
    }
    setNowPlaying(song)
  }

  return (
    <main className="result shell">
      <header className="result-head">
        <span className="date mono">{st.date} · 今日原声带</span>
        <h1 className="display">{st.title}</h1>
        <p className="subtitle">{st.subtitle}</p>
        <div className="opening narration">{st.openingNarration}</div>
      </header>

      <div className="layout">
        <aside className="col-sticky">
          <MoodCurve points={st.moodPath} activeIndex={active} onPick={focusScene} />
          <nav className="scene-nav">
            {st.scenes.map((s, i) => (
              <button key={s.id} className={active === i ? 'active' : ''} onClick={() => focusScene(i)}>
                <span className="dot" style={{ background: emotionColor(s.emotion) }} />
                <span className="t">{String(i + 1).padStart(2, '0')}</span>
                <span style={{ fontSize: 14 }}>{s.emotion}</span>
              </button>
            ))}
          </nav>
        </aside>

        <section className="scenes">
          {st.scenes.map((scene, i) => {
            const color = emotionColor(scene.emotion)
            return (
              <motion.div
                key={scene.id}
                ref={(el) => { sceneRefs.current[i] = el }}
                className="scene-card"
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-80px' }}
                transition={{ duration: 0.5 }}
                onViewportEnter={() => setActive(i)}
              >
                <span style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, background: color }} />
                <div className="scene-top">
                  <span className="time-badge">{scene.timeOfDay}</span>
                  <span className="chip" style={{ borderColor: color, color }}>{scene.emotion}</span>
                </div>
                <h3>{scene.label}</h3>
                <div className="scene-meta">
                  <div className="energy-bar">
                    能量 {scene.energy}
                    <span className="track"><span className="fill" style={{ width: `${scene.energy}%`, background: color }} /></span>
                  </div>
                  {scene.recommendedTags.slice(0, 4).map((t) => (
                    <span key={t} className="chip">{t}</span>
                  ))}
                </div>
                <p className="intent">音乐意图 · {scene.musicIntent}</p>

                <div className="dj">
                  <span className="ico">AI DJ</span>
                  <p>{scene.djNarration}</p>
                </div>

                <div className="tracks">
                  {scene.recommendedSongs.map((song) => {
                    const playing = nowPlaying?.id === song.id
                    return (
                      <div
                        key={song.id}
                        className={`track ${playing ? 'playing' : ''}`}
                        onClick={() => playSong(song)}
                      >
                        <button className="play" aria-label="播放">{playing ? '❚❚' : '▶'}</button>
                        <div className="info">
                          <div className="tt">{song.title}</div>
                          <div className="ar">
                            {song.artist} · <span className="bpm">{song.source === 'qqmusic' ? 'QQ 音乐' : song.language}</span>
                          </div>
                        </div>
                        <div className="reason">{song.reasonSeeds[0]}</div>
                      </div>
                    )
                  })}
                </div>
              </motion.div>
            )
          })}
        </section>
      </div>

      <div className="closing">
        <p>{st.closingNarration}</p>
        <div className="result-actions">
          <button className="btn btn-primary" onClick={() => nav(`/share/${st.id}`)}>生成分享卡片 →</button>
          <button className="btn" onClick={() => nav('/')}>重新生成</button>
        </div>
      </div>

      {nowPlaying && <MockPlayer song={nowPlaying} onClose={() => setNowPlaying(null)} />}
    </main>
  )
}
