import { NavLink, useLocation } from 'react-router-dom'
import { isLLMConfigured } from '../lib/llm'

export default function SiteHeader() {
  const loc = useLocation()
  const onResult = loc.pathname !== '/'
  const inSingRoom = loc.pathname.startsWith('/sing-room')
  if (loc.pathname === '/sing-room/trajectory') return null
  return (
    <header className="site-header">
      <NavLink to={inSingRoom ? '/sing-room' : '/'} className="brand">
        <span className="mark">{inSingRoom ? 'AI声友局' : 'AI音乐管家'}</span>
        <span className="sub">{inSingRoom ? 'Sing Together' : 'Playlist Butler'}</span>
      </NavLink>
      <nav className="nav">
        {!inSingRoom && <NavLink to="/sing-room" className="btn btn-ghost">AI陪我唱</NavLink>}
        <NavLink to="/playlist-butler" className="btn btn-ghost">AI帮我选</NavLink>
        {onResult && !inSingRoom && <NavLink to="/" className="btn btn-ghost">旧版入口</NavLink>}
        <span className="mode-flag">
          引擎 <b>{isLLMConfigured() ? 'LLM' : 'MOCK'}</b>
        </span>
      </nav>
    </header>
  )
}
