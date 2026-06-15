import { NavLink, useLocation } from 'react-router-dom'
import { isLLMConfigured } from '../lib/llm'

export default function SiteHeader() {
  const loc = useLocation()
  const onResult = loc.pathname !== '/'
  return (
    <header className="site-header">
      <NavLink to="/" className="brand">
        <span className="mark">人生原声机</span>
        <span className="sub">Soundtrack of Life</span>
      </NavLink>
      <nav className="nav">
        {onResult && <NavLink to="/" className="btn btn-ghost">重新开始</NavLink>}
        <span className="mode-flag">
          引擎 <b>{isLLMConfigured() ? 'LLM' : 'MOCK'}</b>
        </span>
      </nav>
    </header>
  )
}
