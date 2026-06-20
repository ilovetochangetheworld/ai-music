import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, FileAudio, FileText, ShieldCheck, WandSparkles } from 'lucide-react'
import { createCustomSong } from '../features/practice-room/customSongs'

export default function SongImportPage() {
  const navigate = useNavigate()
  const [title, setTitle] = useState('')
  const [artist, setArtist] = useState('')
  const [audio, setAudio] = useState<File | null>(null)
  const [lyrics, setLyrics] = useState('')
  const [working, setWorking] = useState(false)
  const [error, setError] = useState('')

  async function readLyrics(file: File | undefined) {
    if (!file) return
    setLyrics(await file.text())
  }
  async function convert() {
    if (!audio) { setError('请先选择歌曲音频。'); return }
    setWorking(true); setError('')
    try {
      const song = await createCustomSong({ title, artist, audio, lyrics })
      navigate(`/practice/${song.id}`)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '转换失败')
      setWorking(false)
    }
  }

  return <main className="practice-mobile import-page">
    <header className="practice-top"><button onClick={() => navigate('/songs')}><ArrowLeft size={19} /></button><b>导入练歌素材</b><span /></header>
    <section className="import-intro"><WandSparkles /><h1>歌曲 + 歌词<br />转换成练习时间轴</h1><p>所有文件只保存在当前浏览器，不上传服务器。</p></section>
    <section className="import-form"><label><span>歌曲名</span><input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="默认使用文件名" /></label><label><span>歌手</span><input value={artist} onChange={(event) => setArtist(event.target.value)} placeholder="可选" /></label><label className="file-picker"><FileAudio /><span><b>{audio?.name ?? '选择歌曲音频'}</b><small>MP3 / M4A / WAV，最大 25MB</small></span><input type="file" accept="audio/*" onChange={(event) => setAudio(event.target.files?.[0] ?? null)} /></label><label className="file-picker"><FileText /><span><b>选择歌词文件</b><small>LRC 保留时间；TXT 自动均分后待校时</small></span><input type="file" accept=".lrc,.txt,text/plain" onChange={(event) => void readLyrics(event.target.files?.[0])} /></label><label><span>歌词内容</span><textarea value={lyrics} onChange={(event) => setLyrics(event.target.value)} rows={9} placeholder={'[00:12.30]第一句歌词\n[00:16.80]第二句歌词\n\n也支持每行一句的纯文本'} /></label></section>
    <div className="import-warning"><ShieldCheck /><span>转换后可立即跟唱和进行信号类分析；在参考旋律、节拍与歌词时间未经人工校正前，不输出音准总分。</span></div>
    {error && <p className="import-error">{error}</p>}
    <button className="practice-primary" disabled={working || !audio || !lyrics.trim()} onClick={() => void convert()}><WandSparkles size={18} />{working ? '正在转换…' : '转换为练歌素材'}</button>
  </main>
}
