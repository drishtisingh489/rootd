import { ChartLine, House, ScanLine } from 'lucide-react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'

/** Persistent toolbar: exactly Home (left) · raised Camera (center) · Insights (right). */
export function BottomNav() {
  const { pathname } = useLocation()
  const homeActive = pathname === '/home' || pathname === '/history'
  const insightsActive = pathname.startsWith('/insights')
  return (
    <nav className="bottom-nav" aria-label="Main">
      <NavLink to="/home" className={`nav-item${homeActive ? ' active' : ''}`} aria-current={homeActive ? 'page' : undefined}>
        <House size={24} strokeWidth={homeActive ? 2.4 : 2} aria-hidden="true" />
        <span>Home</span>
      </NavLink>
      <NavLink to="/scan" className="nav-camera" aria-label="Camera: scan a product">
        <span className="nav-camera-btn">
          <ScanLine size={30} strokeWidth={2.2} aria-hidden="true" />
        </span>
        <span className="nav-camera-label">Camera</span>
      </NavLink>
      <NavLink
        to="/insights"
        className={`nav-item${insightsActive ? ' active' : ''}`}
        aria-current={insightsActive ? 'page' : undefined}
      >
        <ChartLine size={24} strokeWidth={insightsActive ? 2.4 : 2} aria-hidden="true" />
        <span>Insights</span>
      </NavLink>
    </nav>
  )
}

export function TabLayout() {
  return (
    <div className="tab-layout">
      <Outlet />
      <BottomNav />
    </div>
  )
}
