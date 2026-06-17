import { useEffect, useMemo, useState } from 'react'
import MockPlayer from '../components/MockPlayer'
import QQMusicLogin from '../components/QQMusicLogin'
import type { AiPlaylist } from '../data/aiPlaylists'
import {
  converseWithPlaylist,
  type PlaylistChatResult,
  type PlaylistFilterResult,
  type PlaylistTurn,
} from '../lib/playlistAi'
import {
  fetchQQMusicPlaylistSongs,
  fetchQQMusicPlayUrl,
  fetchQQMusicPlaylists,
  getQQMusicSession,
  QQ_MUSIC_SESSION_EVENT,
  type QQMusicPlaylistSummary,
} from '../lib/qqMusicLogin'
import type { Song } from '../types'

const processLines = [
  '正在理解你的听歌需求……',
  '正在分析当前歌单里的歌曲标签……',
  '正在组合更顺耳的播放顺序……',
]

export default function PlaylistButlerPage() {
  const [playlists, setPlaylists] = useState<AiPlaylist[]>([])
  const [playlistId, setPlaylistId] = useState('')
  const [hasQQSession, setHasQQSession] = useState(() => Boolean(getQQMusicSession()))
  const [qqPlaylists, setQqPlaylists] = useState<QQMusicPlaylistSummary[]>([])
  const [selectedQQPlaylistKey, setSelectedQQPlaylistKey] = useState('')
  const [qqLoading, setQqLoading] = useState(false)
  const [qqStatus, setQqStatus] = useState('')
  const [query, setQuery] = useState('适合晚上开车，节奏感强一点，但不要太吵')
  const [history, setHistory] = useState<PlaylistTurn[]>([])
  const [result, setResult] = useState<PlaylistFilterResult | null>(null)
  const [chatAnswer, setChatAnswer] = useState<PlaylistChatResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [savedName, setSavedName] = useState('')
  const [playing, setPlaying] = useState<Song | null>(null)
  const [playStatus, setPlayStatus] = useState('')

  const playlist = useMemo(
    () => playlists.find((item) => item.id === playlistId) ?? null,
    [playlistId, playlists],
  )

  useEffect(() => {
    function syncSession() {
      setHasQQSession(Boolean(getQQMusicSession()))
    }
    syncSession()
    window.addEventListener(QQ_MUSIC_SESSION_EVENT, syncSession)
    return () => window.removeEventListener(QQ_MUSIC_SESSION_EVENT, syncSession)
  }, [])

  async function submit(nextQuery = query) {
    const text = nextQuery.trim()
    if (!text || loading) return
    if (!playlist) {
      setError('请先扫码登录 QQ 音乐，并导入一个真实歌单。')
      return
    }
    setLoading(true)
    setError('')
    setSavedName('')
    try {
      const next = await converseWithPlaylist(playlist, text, history)
      if (next.kind === 'filter') {
        setResult(next.result)
        setChatAnswer(null)
        setHistory((items) => [...items, { query: text, understood: next.result.understood }].slice(-5))
      } else {
        setChatAnswer(next.result)
        setHistory((items) => [...items, { query: text, understood: next.result.answer }].slice(-5))
      }
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
    setChatAnswer(null)
    setSavedName('')
    setPlaying(null)
    setPlayStatus('')
  }

  async function loadQQPlaylists() {
    if (qqLoading) return
    setHasQQSession(Boolean(getQQMusicSession()))
    setQqLoading(true)
    setQqStatus('正在读取 QQ 音乐歌单……')
    const items = await fetchQQMusicPlaylists()
    setHasQQSession(Boolean(getQQMusicSession()))
    setQqPlaylists(items)
    setSelectedQQPlaylistKey(items[0] ? `${items[0].type}:${items[0].id}` : '')
    setQqStatus(items.length ? `读取到 ${items.length} 个 QQ 音乐歌单。` : '没有读取到歌单。如果刚扫码成功，请稍等几秒再试；也可能是登录会话已失效。')
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
      quickPrompts: ['瓦解是什么类型的歌？', '适合深夜开车', '节奏感强但不要太吵', '播放这种风格但轻快一点'],
      songs: data.songs as Song[],
    }
    setPlaylists((items) => [imported, ...items.filter((item) => item.id !== imported.id)])
    setPlaylistId(imported.id)
    setHistory([])
    setResult(null)
    setChatAnswer(null)
    setSavedName('')
    setPlaying(null)
    setQqStatus(`已导入「${selected.title}」的 ${data.songs.length} 首歌曲。`)
    setQqLoading(false)
  }

  async function playSong(song?: Song) {
    if (!song) return
    setPlayStatus('')
    if (song.source !== 'qqmusic') {
      setPlaying(song)
      return
    }
    if (!getQQMusicSession()) {
      setPlayStatus('请先扫码登录 QQ 音乐，再播放真实歌曲。')
      return
    }
    setPlayStatus(`正在获取「${song.title}」播放链接……`)
    const playUrl = song.playUrl || (song.mid ? await fetchQQMusicPlayUrl(song.mid, {
      mediaMid: song.mediaMid,
      songType: song.songType,
    }) : '')
    if (!playUrl) {
      setPlayStatus('暂时没有拿到播放链接，可能是登录失效、版权限制或该歌曲只支持客户端播放。')
      setPlaying({ ...song, playUrl: '' })
      return
    }
    setPlaying({ ...song, playUrl })
    setPlayStatus('')
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
            <p className="subtitle">先聊清楚你想听的感觉，再从真实 QQ 音乐歌单里筛选、排序和播放。</p>
          </div>
          <div className="butler-stats">
            <span>真实账号</span>
            <b>QQ</b>
            <span>扫码后读取你的歌单</span>
          </div>
        </section>

        <div className="butler-layout">
          <aside className="playlist-panel">
            <div className="panel-title">选择当前歌单</div>
            <div className="playlist-tabs">
              {playlists.length > 0 ? playlists.map((item) => (
                <button
                  key={item.id}
                  className={item.id === playlist?.id ? 'active' : ''}
                  onClick={() => switchPlaylist(item.id)}
                >
                  <span
                    className="cover-dot"
                    style={item.coverUrl ? { backgroundImage: `url(${item.coverUrl})` } : { background: item.coverTone }}
                  />
                  <span>
                    <b>{item.title}</b>
                    <small>{item.subtitle}</small>
                  </span>
                </button>
              )) : (
                <div className="empty-state compact">
                  {hasQQSession ? 'QQ 音乐已登录。请读取并导入一个歌单。' : '还没有真实歌单。请先扫码登录 QQ 音乐。'}
                </div>
              )}
            </div>

            {playlist ? (
              <div className="playlist-card">
                <div className="playlist-cover" style={{ background: playlist.coverTone }}>
                  {playlist.coverUrl ? <img src={playlist.coverUrl} alt="" /> : <span>QQ</span>}
                </div>
                <h2>{playlist.title}</h2>
                <p>{playlist.description}</p>
                <div className="playlist-actions">
                  <button className="btn btn-primary" onClick={() => playSong(playlist.songs[0])}>播放全部</button>
                  <button className="btn btn-ghost" onClick={() => playSong(playlist.songs[Math.floor(Math.random() * playlist.songs.length)])}>随机</button>
                  <button className="btn btn-ghost" onClick={() => submit(playlist.quickPrompts[0])}>AI帮我选</button>
                </div>
              </div>
            ) : (
              <div className="playlist-card login-required-card">
                <div className="playlist-cover"><span>QQ</span></div>
                <h2>{hasQQSession ? '导入一个 QQ 音乐歌单' : '请先登录 QQ 音乐'}</h2>
                <p>
                  {hasQQSession
                    ? '已检测到 QQ 音乐登录会话。点击“读取我的 QQ 歌单”，选择歌单并导入后，就可以开始对话筛选和真实播放。'
                    : 'AI 音乐管家现在只处理你的真实 QQ 音乐歌单。扫码登录后，读取并导入歌单即可开始筛选和播放。'}
                </p>
              </div>
            )}

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
              {playlist?.songs.slice(0, 8).map((song, index) => (
                <button key={song.id} onClick={() => playSong(song)}>
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
              {playlist ? <div className="prompt-grid">
                {playlist.quickPrompts.map((prompt) => (
                  <button key={prompt} onClick={() => submit(prompt)}>{prompt}</button>
                ))}
              </div> : <p className="login-hint">登录并导入 QQ 音乐歌单后，就可以用自然语言筛选当前歌单。</p>}
              <div className="butler-input">
                <textarea
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="可以问：瓦解是什么类型的歌？也可以说：找一些适合夜晚开车、节奏感强但不要太吵的歌"
                />
                <button className="btn btn-primary" onClick={() => submit()} disabled={loading || !playlist}>
                  {loading ? '处理中' : '发送给管家'}
                </button>
              </div>
              {playStatus && <div className="history-line">{playStatus}</div>}
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

            {chatAnswer && !loading && (
              <div className="chat-card">
                <div className="speaker">MUSIC BUTLER</div>
                <p>{chatAnswer.answer}</p>
                {chatAnswer.referencedSongIds.length > 0 && (
                  <div className="referenced">
                    {chatAnswer.referencedSongIds
                      .map((id) => playlist?.songs.find((song) => song.id === id))
                      .filter(Boolean)
                      .map((song) => (
                        <button key={song!.id} onClick={() => playSong(song!)}>
                          <span>
                            <b>{song!.title}</b>
                            <small>{song!.artist} · {song!.album || 'QQ 音乐'}</small>
                          </span>
                          <span>播放</span>
                        </button>
                      ))}
                  </div>
                )}
                <div className="followups">
                  {chatAnswer.suggestions.map((item) => (
                    <button className="ex-chip" key={item} onClick={() => submit(item)}>{item}</button>
                  ))}
                </div>
              </div>
            )}

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
                    <button className="btn btn-primary" onClick={() => playSong(result.songs[0])}>播放全部</button>
                    <button className="btn btn-ghost" onClick={saveGeneratedPlaylist}>保存为「{result.generatedName}」</button>
                  </div>
                  {savedName && <div className="save-toast">已保存为临时歌单「{savedName}」</div>}
                </div>

                <div className="tracks butler-tracks">
                  {result.songs.map((song, index) => (
                    <button
                      key={`${song.id}_${index}`}
                      className={`track ${playing?.id === song.id ? 'playing' : ''}`}
                      onClick={() => playSong(song)}
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
