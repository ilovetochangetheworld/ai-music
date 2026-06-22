import { NavLink, useLocation } from 'react-router-dom'

export default function SiteHeader() {
  const { pathname } = useLocation()
  if (pathname.includes('/sing')) return null
  const inLab = pathname.startsWith('/lab')
  if (!inLab) return null
  return <header className="site-header practice-site-header"><NavLink to="/" className="brand"><span className="mark">AI练歌房</span><span className="sub">Practice with 小麦</span></NavLink><nav className="nav"><NavLink to="/songs" className="btn btn-ghost">可练歌曲</NavLink><NavLink to="/growth" className="btn btn-ghost">成长档案</NavLink>{inLab ? <NavLink to="/" className="btn btn-ghost">返回练歌房</NavLink> : <NavLink to="/lab/soundtrack" className="btn btn-ghost lab-link">Lab</NavLink>}</nav></header>
}
