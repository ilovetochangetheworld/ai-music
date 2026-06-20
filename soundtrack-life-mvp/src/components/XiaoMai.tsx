export type XiaoMaiState = 'ready' | 'listening' | 'waiting' | 'cheering' | 'notebook'

export default function XiaoMai({ state = 'ready', compact = false }: { state?: XiaoMaiState; compact?: boolean }) {
  return (
    <div className={`xiaomai ${state} ${compact ? 'compact' : ''}`} aria-label={`小麦：${state}`}>
      <span className="xiaomai-ear left" /><span className="xiaomai-ear right" />
      <span className="xiaomai-body"><i className="xiaomai-eye left" /><i className="xiaomai-eye right" /><i className="xiaomai-glow" /></span>
      <span className="xiaomai-shadow" />
    </div>
  )
}
