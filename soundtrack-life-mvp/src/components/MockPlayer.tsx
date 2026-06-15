import type { Song } from '../types'

export default function MockPlayer({ song, onClose }: { song: Song; onClose: () => void }) {
  return (
    <div className="player">
      <div className="disc" />
      <div className="pinfo">
        <div className="tt">{song.title}</div>
        <div className="ar">{song.artist} · {song.bpm} BPM</div>
      </div>
      <div className="prog">
        {/* key 强制每次换歌重启进度动画 */}
        <div className="b" key={song.id} />
      </div>
      <span className="mono" style={{ fontSize: 11, color: 'var(--muted)' }}>模拟播放</span>
      <button className="pclose" onClick={onClose} aria-label="停止">×</button>
    </div>
  )
}
