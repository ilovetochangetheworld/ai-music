import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, CheckCircle2, ChevronRight, CircleAlert, FileMusic, Settings2, Upload } from 'lucide-react'
import { loadCatalog, loadPracticeManifest, type CatalogSongSummary } from '../features/practice-room/catalog'

interface ManagedSong extends CatalogSongSummary {
  reviewStatus: string
  noteCount: number
}

export default function SongManagementPage() {
  const navigate = useNavigate()
  const [songs, setSongs] = useState<ManagedSong[]>([])

  useEffect(() => {
    loadCatalog().then(async (catalog) => {
      const managed = await Promise.all(catalog.map(async (song): Promise<ManagedSong> => {
        if (song.availability !== 'ready' || song.id.startsWith('upload-')) return { ...song, reviewStatus: song.id.startsWith('upload-') ? 'local_draft' : 'not_ready', noteCount: 0 }
        try {
          const manifest = await loadPracticeManifest(song.id)
          const response = await fetch(`${import.meta.env.BASE_URL}${manifest.assets.notes}`)
          const notes = response.ok ? await response.json() as { reviewStatus?: string; notes?: unknown[] } : null
          return { ...song, reviewStatus: notes?.reviewStatus ?? 'missing', noteCount: notes?.notes?.length ?? 0 }
        } catch { return { ...song, reviewStatus: 'missing', noteCount: 0 } }
      }))
      setSongs(managed)
    }).catch(() => setSongs([]))
  }, [])

  const reviewed = songs.filter((song) => song.reviewStatus === 'reviewed').length
  return <main className="practice-mobile song-management-page">
    <header className="practice-top"><button onClick={() => navigate('/songs')}><ArrowLeft size={19} /></button><b>歌曲管理</b><button onClick={() => navigate('/songs/import')} aria-label="导入歌曲"><Upload size={17} /></button></header>
    <section className="management-summary"><Settings2 /><div><h1>{songs.length} 首歌曲</h1><p>{reviewed} 首参考旋律已审核，可进入音准评分</p></div></section>
    <section className="management-list">{songs.map((song) => {
      const ready = song.availability === 'ready'; const isCustom = song.id.startsWith('upload-'); const isReviewed = song.reviewStatus === 'reviewed'
      return <article key={song.id}><span className="management-cover"><FileMusic /></span><div className="management-info"><b>{song.title}</b><small>{song.artist} · 难度 {song.difficulty}/5</small><span className={isReviewed ? 'reviewed' : 'pending'}>{isReviewed ? <CheckCircle2 /> : <CircleAlert />}{statusText(song)}</span></div><div className="management-actions">{ready && <button onClick={() => navigate(`/practice/${song.id}`)}>练习<ChevronRight /></button>}{ready && !isCustom && <button onClick={() => navigate(`/lab/reference-review/${song.id}`)}>{isReviewed ? '复核旋律' : '审核旋律'}<ChevronRight /></button>}</div></article>
    })}</section>
    <button className="import-entry" onClick={() => navigate('/songs/import')}><Upload /><span><b>导入歌曲 + 歌词</b><small>先生成本地练习草稿，再进入预处理与审核</small></span></button>
  </main>
}

function statusText(song: ManagedSong): string {
  if (song.reviewStatus === 'reviewed') return `参考旋律已审核 · ${song.noteCount} 个音符`
  if (song.reviewStatus === 'local_draft') return '本地跟唱草稿 · 尚未分轨和生成参考旋律'
  if (song.reviewStatus === 'not_ready') return '歌曲资源准备中'
  return `参考旋律待审核 · ${song.noteCount} 个音符`
}
