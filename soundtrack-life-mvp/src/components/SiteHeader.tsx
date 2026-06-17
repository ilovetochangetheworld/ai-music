import { NavLink, useLocation } from 'react-router-dom'
import { isLLMConfigured } from '../lib/llm'

export default function SiteHeader() {
  const loc = useLocation()
  const onResult = loc.pathname !== '/'
  return (
    <header className="site-header">
      <NavLink to="/" className="brand">
        <span className="mark">AI音乐管家</span>
        <span className="sub">Playlist Butler</span>
      </NavLink>
      <nav className="nav">
        <NavLink to="/playlist-butler" className="btn btn-ghost">AI帮我选</NavLink>
        {onResult && <NavLink to="/" className="btn btn-ghost">旧版入口</NavLink>}
        <span className="mode-flag">
          引擎 <b>{isLLMConfigured() ? 'LLM' : 'MOCK'}</b>
        </span>
      </nav>
    </header>
  )
}
