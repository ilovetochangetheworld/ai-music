import type { MoodPoint } from '../types'
import { emotionColor } from '../lib/lifeParser'

export default function MoodCurve({
  points,
  activeIndex,
  onPick,
}: {
  points: MoodPoint[]
  activeIndex?: number
  onPick?: (i: number) => void
}) {
  const W = 280
  const H = 96
  const pad = 14
  const n = points.length
  const coords = points.map((p, i) => {
    const x = n === 1 ? W / 2 : pad + (i * (W - pad * 2)) / (n - 1)
    const y = H - pad - (p.energy / 100) * (H - pad * 2)
    return { x, y }
  })
  const path = coords.map((c, i) => `${i === 0 ? 'M' : 'L'}${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(' ')
  const area = `${path} L${coords[coords.length - 1]?.x ?? W},${H} L${coords[0]?.x ?? 0},${H} Z`

  return (
    <div className="mood-curve">
      <div className="cap">今日情绪曲线</div>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" preserveAspectRatio="none">
        <defs>
          <linearGradient id="moodFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgba(231,161,59,0.30)" />
            <stop offset="100%" stopColor="rgba(231,161,59,0)" />
          </linearGradient>
        </defs>
        <path d={area} fill="url(#moodFill)" />
        <path d={path} fill="none" stroke="var(--amber)" strokeWidth="2" strokeLinejoin="round" />
        {coords.map((c, i) => (
          <circle
            key={i}
            cx={c.x}
            cy={c.y}
            r={activeIndex === i ? 6 : 4}
            fill={activeIndex === i ? emotionColor(points[i].label) : 'var(--ink-900)'}
            stroke={emotionColor(points[i].label)}
            strokeWidth="2"
            style={{ cursor: onPick ? 'pointer' : 'default' }}
            onClick={() => onPick?.(i)}
          />
        ))}
      </svg>
      <div className="mood-labels">
        {points.map((p, i) => (
          <span key={i} style={{ color: activeIndex === i ? emotionColor(p.label) : undefined }}>
            {p.label}
          </span>
        ))}
      </div>
    </div>
  )
}
