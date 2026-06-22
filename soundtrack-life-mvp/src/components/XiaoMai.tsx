export type XiaoMaiState = 'ready' | 'listening' | 'waiting' | 'cheering' | 'notebook'

export default function XiaoMai({ state = 'ready', compact = false }: { state?: XiaoMaiState; compact?: boolean }) {
  return (
    <div className={`xiaomai ${state} ${compact ? 'compact' : ''}`} aria-label={`小麦：${state}`}>
      <img src={`${import.meta.env.BASE_URL}brand/xiaomai.png`} alt="戴着粉色耳机的小麦" />
      <span className="xiaomai-shadow" />
    </div>
  )
}
