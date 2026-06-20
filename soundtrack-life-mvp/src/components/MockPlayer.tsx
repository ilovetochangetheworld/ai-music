import type { Song } from '../types'

export default function MockPlayer({ song, onClose }: { song: Song; onClose: () => void }) {
  const hasAudio = Boolean(song.playUrl)
  return (
    <div className="player">
      <div className="disc" />
      <div className="pinfo">
        <div className="tt">{song.title}</div>
        <div className="ar">
          {song.artist}
          {song.bpm ? ` · ${song.bpm} BPM` : ''}
        </div>
      </div>
      {hasAudio ? (
        <audio src={song.playUrl} controls autoPlay style={{ width: 220, height: 32 }} />
      ) : (
        <>
          <div className="prog">
            {/* key 强制每次换歌重启进度动画 */}
            <div className="b" key={song.id} />
          </div>
          {song.detailUrl ? (
            <a
              className="mono"
              href={song.detailUrl}
              target="_blank"
              rel="noreferrer"
              style={{ fontSize: 11, color: 'var(--muted)' }}
            >
              打开来源页面
            </a>
          ) : (
            <span className="mono" style={{ fontSize: 11, color: 'var(--muted)' }}>模拟播放</span>
          )}
        </>
      )}
      <button className="pclose" onClick={onClose} aria-label="停止">×</button>
    </div>
  )
}
