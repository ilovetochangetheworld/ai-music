import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, LockKeyhole, Music2, Upload } from 'lucide-react'
import { loadCatalog, metricLabels, type CatalogSongSummary } from '../features/practice-room/catalog'

export default function SongCatalogPage() {
  const navigate = useNavigate()
  const [songs, setSongs] = useState<CatalogSongSummary[]>([])
  useEffect(() => { loadCatalog().then(setSongs).catch(() => setSongs([])) }, [])
  return <main className="practice-mobile warm-room-page song-catalog-page"><header className="practice-top"><button onClick={() => navigate('/')} aria-label="返回首页"><ArrowLeft size={19} /></button><b>可练歌曲</b><span /></header><button className="import-entry" onClick={() => navigate('/songs/import')}><Upload /><span><b>导入歌曲 + 歌词</b><small>本地转换为练习时间轴</small></span></button><section className="catalog-list">{songs.map((song) => <button key={song.id} className="catalog-song" disabled={song.availability !== 'ready'} onClick={() => navigate(`/practice/${song.id}`)}><span className="catalog-cover"><Music2 /></span><span><b>{song.title}</b>{song.availability === 'ready' && <><small>{song.artist} · 难度 {song.difficulty}/5</small><em>{song.focus.map((key) => metricLabels[key]).join(' · ')}</em></>}</span>{song.availability === 'ready' ? <i>开始</i> : <i><LockKeyhole size={14} />准备中</i>}</button>)}</section></main>
}
