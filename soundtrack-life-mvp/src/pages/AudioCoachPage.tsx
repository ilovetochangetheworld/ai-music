import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useStore } from '../store'
import { askAudioCoach } from '../lib/audioCoach'
import type { CoachAnswer, RouteStep } from '../types'

function RouteList({ steps }: { steps: RouteStep[] }) {
  return (
    <>
      {steps.map((s, i) => (
        <div className="route-step" key={i}>
          <span className="rt">{s.start}–{s.end}</span>
          <span className="rr">{s.reason}</span>
        </div>
      ))}
    </>
  )
}

export default function AudioCoachPage() {
  const nav = useNavigate()
  const { analysis } = useStore()
  const [question, setQuestion] = useState('')
  const [answer, setAnswer] = useState<CoachAnswer | null>(null)
  const [asking, setAsking] = useState(false)
  const [hotStart, setHotStart] = useState<string | null>(null)

  if (!analysis) {
    return (
      <main className="empty shell">
        <p>还没有分析过长音频。先回首页粘贴一段转写或使用示例播客。</p>
        <button className="btn btn-primary" onClick={() => nav('/')}>去分析 →</button>
      </main>
    )
  }

  async function ask(q: string) {
    const query = q.trim()
    if (!query) return
    setQuestion(query)
    setAsking(true)
    const res = await askAudioCoach(query, analysis!)
    setAnswer(res)
    setAsking(false)
    setHotStart(res.segments[0]?.start ?? null)
  }

  return (
    <main className="result shell">
      <header className="result-head">
        <span className="date mono">长音频速听 · {analysis.chapters.length} 个章节</span>
        <h1 className="display">{analysis.audioTitle}</h1>
        <p className="subtitle">{analysis.brief}</p>
      </header>

      <div className="routes">
        <div className="route-card">
          <div className="h"><span className="big mono">3'</span><span>分钟速听路线</span></div>
          <RouteList steps={analysis.threeMinuteRoute} />
        </div>
        <div className="route-card">
          <div className="h"><span className="big mono">15'</span><span>分钟精听路线</span></div>
          <RouteList steps={analysis.fifteenMinuteRoute} />
        </div>
      </div>

      <h3 className="eyebrow" style={{ margin: '36px 0 16px' }}>章节地图</h3>
      <div className="chapters">
        {analysis.chapters.map((c, i) => (
          <motion.div
            key={c.id}
            className={`chapter ${hotStart === c.start ? 'hot' : ''}`}
            initial={{ opacity: 0, x: -16 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.4, delay: i * 0.05 }}
          >
            <div className="ts">
              {c.start}<br />– {c.end}
              <span className="imp">重要度 {c.importance}</span>
            </div>
            <div>
              <h4>{c.title}</h4>
              <p>{c.summary}</p>
              <div className="kw">
                {c.keywords.map((k) => <span key={k} className="chip">{k}</span>)}
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      <div className="ask">
        <h3>只听重点 · 向这期节目提问</h3>
        <p className="ask-sub">用一句话告诉我你想听什么，我会定位到该听的时间片段。</p>
        <div className="ask-row">
          <input
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && ask(question)}
            placeholder="例如：只听关于 AI 音乐版权风险的部分"
          />
          <button className="btn btn-primary" onClick={() => ask(question)} disabled={asking}>
            {asking ? '检索中…' : '追问 →'}
          </button>
        </div>
        <div className="followups">
          {(answer?.followUpQuestions ?? analysis.questionsToAsk).map((q) => (
            <button key={q} className="ex-chip" onClick={() => ask(q)}>{q}</button>
          ))}
        </div>

        {answer && (
          <motion.div className="answer" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <p className="a-text">{answer.answer}</p>
            {answer.segments.map((s, i) => (
              <div className="seg" key={i}>
                <span className="ts">{s.start}–{s.end}</span>
                <div>
                  <div className="st">{s.title}</div>
                  <div className="sr">{s.reason}</div>
                </div>
              </div>
            ))}
          </motion.div>
        )}
      </div>

      {analysis.quotes.length > 0 && (
        <div className="quotes">
          <h3 className="eyebrow" style={{ marginBottom: 16 }}>节目金句</h3>
          {analysis.quotes.map((q, i) => <p className="q" key={i}>“{q}”</p>)}
        </div>
      )}
    </main>
  )
}
