import { useMemo, useState } from 'react'
import MockPlayer from '../components/MockPlayer'
import QQMusicLogin from '../components/QQMusicLogin'
import { aiPlaylists, type AiPlaylist } from '../data/aiPlaylists'
import { filterPlaylist, type PlaylistFilterResult, type PlaylistTurn } from '../lib/playlistAi'
import { fetchQQMusicPlaylistSongs, fetchQQMusicPlaylists, type QQMusicPlaylistSummary } from '../lib/qqMusicLogin'
import type { Song } from '../types'

const processLines = [
  '正在理解你的听歌需求……',
  '正在分析当前歌单里的歌曲标签……',
  '正在组合更顺耳的播放顺序……',
]

export default function PlaylistButlerPage() {
  const [playlists, setPlaylists] = useState<AiPlaylist[]>(aiPlaylists)
  const [playlistId, setPlaylistId] = useState(aiPlaylists[0].id)
  const [qqPlaylists, setQqPlaylists] = useState<QQMusicPlaylistSummary[]>([])
  const [selectedQQPlaylistKey, setSelectedQQPlaylistKey] = useState('')
  const [qqLoading, setQqLoading] = useState(false)
  const [qqStatus, setQqStatus] = useState('')
  const [query, setQuery] = useState('适合晚上开车，节奏感强一点，但不要太吵')
  const [history, setHistory] = useState<PlaylistTurn[]>([])
  const [result, setResult] = useState<PlaylistFilterResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [savedName, setSavedName] = useState('')
  const [playing, setPlaying] = useState<Song | null>(null)

  const playlist = useMemo(
    () => playlists.find((item) => item.id === playlistId) ?? playlists[0],
    [playlistId, playlists],
  )

  async function submit(nextQuery = query) {
    const text = nextQuery.trim()
    if (!text || loading) return
    setLoading(true)
    setError('')
    setSavedName('')
    try {
      const next = await filterPlaylist(playlist, text, history)
      setResult(next)
      setHistory((items) => [...items, { query: text, understood: next.understood }].slice(-4))
      setQuery('')
    } catch {
      setError('这次筛选没有成功，可以换个说法再试一次。')
    } finally {
      setLoading(false)
    }
  }

  function switchPlaylist(id: string) {
    setPlaylistId(id)
    setHistory([])
    setResult(null)
    setSavedName('')
    setPlaying(null)
  }

  async function loadQQPlaylists() {
    if (qqLoading) return
    setQqLoading(true)
    setQqStatus('正在读取 QQ 音乐歌单……')
    const items = await fetchQQMusicPlaylists()
    setQqPlaylists(items)
    setSelectedQQPlaylistKey(items[0] ? `${items[0].type}:${items[0].id}` : '')
    setQqStatus(items.length ? `读取到 ${items.length} 个 QQ 音乐歌单。` : '没有读取到歌单，请确认已扫码登录。')
    setQqLoading(false)
  }

  async function importQQPlaylist() {
    const selected = qqPlaylists.find((item) => `${item.type}:${item.id}` === selectedQQPlaylistKey)
    if (!selected || qqLoading) return
    setQqLoading(true)
    setQqStatus(`正在导入「${selected.title}」……`)
    const data = await fetchQQMusicPlaylistSongs(selected, 100)
    if (!data?.songs?.length) {
      setQqStatus('这条歌单暂时没有导入到歌曲，可能是登录已失效或歌单权限受限。')
      setQqLoading(false)
      return
    }
    const imported: AiPlaylist = {
      id: `qq_${selected.id}`,
      title: selected.title,
      subtitle: `${data.total || data.songs.length} 首 · QQ 音乐真实歌单`,
      description: selected.description || '从你的 QQ 音乐账号导入的真实歌单。',
      coverUrl: selected.coverUrl,
      source: 'qqmusic',
      type: selected.type,
      songCount: data.total,
      quickPrompts: ['适合深夜开车', '节奏感强但不要太吵', '最近没听过的', '只听轻快一点的'],
      songs: data.songs as Song[],
    }
    setPlaylists((items) => [imported, ...items.filter((item) => item.id !== imported.id)])
    switchPlaylist(imported.id)
    setQqStatus(`已导入「${selected.title}」的 ${data.songs.length} 首歌曲。`)
    setQqLoading(false)
  }

  function saveGeneratedPlaylist() {
    if (!result) return
    setSavedName(result.generatedName)
  }

  return (
    <main className="result playlist-butler">
      <div className="shell">
        <section className="butler-hero">
          <div>
            <div className="eyebrow">AI MUSIC BUTLER</div>
            <h1 className="display">用一句话，叫醒你的歌单</h1>
            <p className="subtitle">在当前歌单范围内理解情绪、场景、节奏和排除条件，动态生成此刻想听的子歌单。</p>
          </div>
          <div className="butler-stats">
            <span>当前 MVP</span>
            <b>3</b>
            <span>个高辨识度歌单</span>
          </div>
        </section>

        <div className="butler-layout">
          <aside className="playlist-panel">
            <div className="panel-title">选择当前歌单</div>
            <div className="playlist-tabs">
              {playlists.map((item) => (
                <button
                  key={item.id}
                  className={item.id === playlist.id ? 'active' : ''}
                  onClick={() => switchPlaylist(item.id)}
                >
                  <span className="cover-dot" style={{ background: item.coverTone }} />
                  <span>
                    <b>{item.title}</b>
                    <small>{item.subtitle}</small>
                  </span>
                </button>
              ))}
            </div>

            <div className="playlist-card">
              <div className="playlist-cover" style={{ background: playlist.coverTone }}>
                {playlist.coverUrl ? <img src={playlist.coverUrl} alt="" /> : <span>AI</span>}
              </div>
              <h2>{playlist.title}</h2>
              <p>{playlist.description}</p>
              <div className="playlist-actions">
                <button className="btn btn-primary" onClick={() => setPlaying(playlist.songs[0])}>播放全部</button>
                <button className="btn btn-ghost">随机</button>
                <button className="btn btn-ghost" onClick={() => submit(playlist.quickPrompts[0])}>AI帮我选</button>
              </div>
            </div>

            <div className="qq-import">
              <QQMusicLogin />
              <div className="qq-import-actions">
                <button className="btn btn-ghost" onClick={loadQQPlaylists} disabled={qqLoading}>
                  {qqLoading ? '读取中' : '读取我的 QQ 歌单'}
                </button>
                {qqPlaylists.length > 0 && (
                  <>
                    <select value={selectedQQPlaylistKey} onChange={(event) => setSelectedQQPlaylistKey(event.target.value)}>
                      {qqPlaylists.map((item) => (
                        <option key={`${item.type}_${item.id}`} value={`${item.type}:${item.id}`}>
                          {item.title} {item.songCount ? `(${item.songCount})` : ''}
                        </option>
                      ))}
                    </select>
                    <button className="btn btn-primary" onClick={importQQPlaylist} disabled={qqLoading}>导入</button>
                  </>
                )}
              </div>
              {qqStatus && <p>{qqStatus}</p>}
            </div>

            <div className="source-list">
              {playlist.songs.slice(0, 8).map((song, index) => (
                <button key={song.id} onClick={() => setPlaying(song)}>
                  <span className="idx">{String(index + 1).padStart(2, '0')}</span>
                  <span className="song-main">
                    <b>{song.title}</b>
                    <small>{song.artist}</small>
                  </span>
                  <span className="song-meta">{song.bpm} BPM</span>
                </button>
              ))}
            </div>
          </aside>

          <section className="ai-panel">
            <div className="ai-card">
              <div className="panel-title">AI音乐管家</div>
              <h2>你现在想听什么？</h2>
              <div className="prompt-grid">
                {playlist.quickPrompts.map((prompt) => (
                  <button key={prompt} onClick={() => submit(prompt)}>{prompt}</button>
                ))}
              </div>
              <div className="butler-input">
                <textarea
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="例如：找一些适合夜晚开车、节奏感强但不要太吵的歌"
                />
                <button className="btn btn-primary" onClick={() => submit()} disabled={loading}>
                  {loading ? '筛选中' : '帮我找'}
                </button>
              </div>
              {history.length > 0 && (
                <div className="history-line">
                  上下文：{history.map((item) => item.query).join(' → ')}
                </div>
              )}
            </div>

            {loading && (
              <div className="thinking-card">
                {processLines.map((line, index) => (
                  <div key={line} style={{ animationDelay: `${index * 0.25}s` }}>{line}</div>
                ))}
              </div>
            )}

            {error && <div className="empty-state">{error}</div>}

            {result && !loading && (
              <div className="ai-result">
                <div className="result-summary">
                  <span className="mono">{result.relaxed ? 'RELAXED MATCH' : 'SEMANTIC MATCH'}</span>
                  <h2>{result.summary}</h2>
                  <p>{result.understood}</p>
                  <div className="scene-meta">
                    {result.chips.map((chip) => <span className="chip" key={chip}>{chip}</span>)}
                  </div>
                  <div className="result-actions compact">
                    <button className="btn btn-primary" onClick={() => setPlaying(result.songs[0])}>播放全部</button>
                    <button className="btn btn-ghost" onClick={saveGeneratedPlaylist}>保存为「{result.generatedName}」</button>
                  </div>
                  {savedName && <div className="save-toast">已保存为临时歌单「{savedName}」</div>}
                </div>

                <div className="tracks butler-tracks">
                  {result.songs.map((song, index) => (
                    <button
                      key={`${song.id}_${index}`}
                      className={`track ${playing?.id === song.id ? 'playing' : ''}`}
                      onClick={() => setPlaying(song)}
                    >
                      <span className="play">▶</span>
                      <span className="info">
                        <span className="tt">{song.title}</span>
                        <span className="ar">{song.artist} · {song.album}</span>
                      </span>
                      <span className="score">{song.score}</span>
                      <span className="reason">{song.reason}</span>
                    </button>
                  ))}
                </div>

                <div className="followups">
                  {result.suggestions.map((item) => (
                    <button className="ex-chip" key={item} onClick={() => submit(item)}>{item}</button>
                  ))}
                </div>
              </div>
            )}
          </section>
        </div>
      </div>

      {playing && <MockPlayer song={playing} onClose={() => setPlaying(null)} />}
    </main>
  )
}
