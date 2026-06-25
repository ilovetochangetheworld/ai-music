import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, BarChart3, CalendarDays, ChevronDown, Database, Flame, Home, Music2, Play } from 'lucide-react'
import XiaoMai from '../components/XiaoMai'
import { listGrowthReports, type GrowthEntry } from '../features/practice-room/growth'

interface SongGroup {
  songId: string
  title: string
  entries: GrowthEntry[]
  latest: GrowthEntry
  bestScore: number | null
}

export default function GrowthPage() {
  const navigate = useNavigate()
  const [entries, setEntries] = useState<GrowthEntry[]>([])
  const [expandedSongs, setExpandedSongs] = useState<Record<string, boolean>>({})
  useEffect(() => { listGrowthReports().then(setEntries).catch(() => setEntries([])) }, [])
  const calendarDays = useMemo(() => buildCalendarDays(entries), [entries])
  const streak = useMemo(() => buildStreak(entries), [entries])
  const songGroups = useMemo(() => groupBySong(entries), [entries])
  const nextPractice = songGroups[0]?.latest

  return <main className="practice-mobile growth-page warm-room-page coaching-growth-page">
    <header className="practice-top"><button onClick={() => navigate('/')}><ArrowLeft size={19} /></button><b>成长档案</b><span /></header>
    <section className="growth-hero coaching-growth-hero"><div className="growth-xiaomai-avatar"><XiaoMai state="notebook" /></div><h1>小麦练歌手账</h1><p>{entries.length ? `已经记录 ${entries.length} 次练习，连续练习 ${streak} 天。` : '完成第一次练习后，小麦会把你的变化记在这里。'}</p></section>
    <section className="practice-calendar-card"><div className="section-title"><h2><CalendarDays />练习日历</h2><small>最近 14 天</small></div><div className="calendar-strip">{calendarDays.map((day) => <div className={day.count ? 'active' : ''} key={day.key}><b>{day.label}</b><span>{day.day}</span><small>{day.count ? `${day.count}次` : ' '}</small></div>)}</div><p><Flame />{streak ? `已连续练习 ${streak} 天，保持这个节奏就很好。` : '今天唱一遍，就从这里开始累计。'}</p></section>
    <section className="next-practice-card"><div><small>下次练什么</small><h2>{nextPractice ? `继续练《${nextPractice.songTitle ?? displaySongName(nextPractice.songId)}》` : '先完成一次完整练习'}</h2><p>{nextPractice?.report?.primarySuggestion ?? '小麦会根据上一遍演唱，给你下一次最值得练的一点。'}</p></div><button onClick={() => navigate(nextPractice ? `/practice/${nextPractice.songId}/sing` : '/songs')}><Play />{nextPractice ? '去练这首' : '选择歌曲'}</button></section>
    <section className="song-growth-groups"><div className="section-title"><h2><Music2 />按歌曲查看</h2><small>{songGroups.length} 首歌</small></div>{songGroups.length ? songGroups.map((group) => {
      const expanded = Boolean(expandedSongs[group.songId])
      const visibleEntries = expanded ? group.entries : group.entries.slice(0, 4)
      const hasOverflow = group.entries.length > 4
      return <article key={group.songId}>
        <header><span><b>{group.title}</b><small>{group.entries.length} 次练习 · 最近 {formatDate(group.latest.createdAt)}</small></span>{group.bestScore !== null && <strong>{group.bestScore}</strong>}</header>
        {(group.latest.report?.headline || group.latest.report?.primarySuggestion) && <p>{group.latest.report?.headline ?? group.latest.report?.primarySuggestion}</p>}
        <div className="song-session-list">{visibleEntries.map((entry) => <button key={entry.id} onClick={() => navigate(`/growth/${entry.id}`)}><b>{formatShortDate(entry.createdAt)}</b><span>{entry.overallScore ?? '—'}</span></button>)}</div>
        {hasOverflow && <button className="song-session-toggle" onClick={() => setExpandedSongs((current) => ({ ...current, [group.songId]: !expanded }))}>{expanded ? '收起记录' : `查看全部 ${group.entries.length} 次`}<ChevronDown className={expanded ? 'expanded' : ''} /></button>}
      </article>
    }) : <div className="growth-empty"><Database /><p>完成第一次练习后，会按歌曲整理练习记录。</p></div>}</section>
    <nav className="practice-bottom-nav"><button onClick={() => navigate('/')}><Home /><span>首页</span></button><button className="active"><BarChart3 /><span>成长</span></button></nav>
  </main>
}

function buildCalendarDays(entries: GrowthEntry[]) {
  const counts = new Map<string, number>()
  entries.forEach((entry) => {
    const key = toDateKey(new Date(entry.createdAt))
    counts.set(key, (counts.get(key) ?? 0) + 1)
  })
  return Array.from({ length: 14 }, (_, index) => {
    const date = new Date()
    date.setDate(date.getDate() - (13 - index))
    const key = toDateKey(date)
    return { key, count: counts.get(key) ?? 0, label: ['日', '一', '二', '三', '四', '五', '六'][date.getDay()], day: date.getDate() }
  })
}

function buildStreak(entries: GrowthEntry[]): number {
  const days = new Set(entries.map((entry) => toDateKey(new Date(entry.createdAt))))
  let streak = 0
  const cursor = new Date()
  while (days.has(toDateKey(cursor))) {
    streak += 1
    cursor.setDate(cursor.getDate() - 1)
  }
  return streak
}

function groupBySong(entries: GrowthEntry[]): SongGroup[] {
  const groups = new Map<string, GrowthEntry[]>()
  entries.forEach((entry) => groups.set(entry.songId, [...(groups.get(entry.songId) ?? []), entry]))
  return Array.from(groups.entries()).map(([songId, groupEntries]) => {
    const sorted = [...groupEntries].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    const scores = sorted.map((entry) => entry.overallScore).filter((score): score is number => score !== null)
    return { songId, title: sorted[0].songTitle ?? displaySongName(songId), entries: sorted, latest: sorted[0], bestScore: scores.length ? Math.max(...scores) : null }
  }).sort((a, b) => b.latest.createdAt.localeCompare(a.latest.createdAt))
}

function displaySongName(songId: string): string { return songId === 'trajectory' ? '轨迹' : songId }
function toDateKey(date: Date): string { return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}` }
function formatDate(value: string): string { return new Date(value).toLocaleDateString(undefined, { month: 'numeric', day: 'numeric' }) }
function formatShortDate(value: string): string { const date = new Date(value); return `${date.getMonth() + 1}/${date.getDate()}` }





