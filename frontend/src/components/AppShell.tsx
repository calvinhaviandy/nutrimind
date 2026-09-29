import { useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { BookOpen, CalendarDays, ChevronDown, ChartNoAxesCombined, CircleHelp, Camera, LayoutDashboard, LogOut, Sparkles } from 'lucide-react'
import Brand from './Brand'
import { useAuth } from '../lib/auth'
import { api } from '../lib/api'

const navigation = [
  { to: '/app', label: 'Ringkasan', short: 'Hari ini', icon: LayoutDashboard, end: true },
  { to: '/app/scan', label: 'Pindai makanan', short: 'Pindai', icon: Camera },
  { to: '/app/journal', label: 'Catatan makan', short: 'Catatan', icon: BookOpen },
  { to: '/app/plan', label: 'Rencana makan', short: 'Rencana', icon: CalendarDays },
  { to: '/app/insights', label: 'Laporan', short: 'Laporan', icon: ChartNoAxesCombined },
]

const pageTitles: Record<string, string> = {
  '/app': 'Ringkasan hari ini',
  '/app/scan': 'Pindai makanan',
  '/app/journal': 'Catatan makan',
  '/app/plan': 'Rencana makan',
  '/app/plan/new': 'Buat rencana makan',
  '/app/insights': 'Laporan nutrisi',
}

export default function AppShell() {
  const { session, setSession } = useAuth()
  const [menuOpen, setMenuOpen] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()
  const userName = session?.authenticated ? session.user.name : 'Teman sehat'

  useEffect(() => {
    document.title = `${pageTitles[location.pathname] || 'Ruangmu'} — NutriMind`
  }, [location.pathname])

  async function logout() {
    try { await api('/api/auth/logout', { method: 'POST' }) } catch { /* session is cleared in the UI either way */ }
    setSession({ authenticated: false, user: null })
    navigate('/', { replace: true })
  }

  return (
    <div className="app-layout">
      <aside className="app-sidebar">
        <Brand to="/app" />
        <div className="sidebar-caption">RUANGMU</div>
        <nav className="sidebar-nav" aria-label="Navigasi aplikasi">
          {navigation.map(({ to, label, icon: Icon, end }) => (
            <NavLink key={to} className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`} to={to} end={end}>
              <Icon size={19} strokeWidth={2} /><span>{label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-action">
          <span className="sidebar-action-icon"><Sparkles size={19} /></span>
          <strong>Bingung mau makan apa?</strong>
          <p>Susun ide menu harian sesuai kebutuhanmu.</p>
          <NavLink to="/app/plan/new">Buat rencana <span aria-hidden="true">↗</span></NavLink>
        </div>
        <div className="sidebar-footer">
          <span><CircleHelp size={16} /> Butuh bantuan?</span>
          <small>NutriMind membantu Anda memahami pola makan, bukan menggantikan saran tenaga kesehatan.</small>
        </div>
      </aside>

      <div className="app-workspace">
        <header className="app-topbar">
          <div className="app-topbar-title">
            <div className="app-mobile-brand"><Brand to="/app" /></div>
            <div className="app-breadcrumb"><span>NutriMind</span><span className="breadcrumb-divider">/</span><strong>{pageTitles[location.pathname] || 'Ruangmu'}</strong></div>
          </div>
          <div className="app-topbar-actions">
            <span className="app-topbar-date"><CalendarDays size={16} /> {new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date())}</span>
            <div className="user-menu-wrap">
              <button type="button" className="user-menu-trigger" onClick={() => setMenuOpen(!menuOpen)} aria-expanded={menuOpen} aria-label="Menu akun">
                <span className="user-avatar">{userName.trim().charAt(0).toUpperCase()}</span>
                <span className="user-menu-name">{userName.split(' ')[0]}</span>
                <ChevronDown size={15} />
              </button>
              {menuOpen && <div className="user-dropdown"><div><strong>{userName}</strong><span>{session?.authenticated ? session.user.email : ''}</span></div><button type="button" onClick={logout}><LogOut size={16} /> Keluar</button></div>}
            </div>
          </div>
        </header>
        <main className="app-main"><Outlet /></main>
      </div>

      <nav className="app-bottom-nav" aria-label="Navigasi aplikasi seluler">
        {navigation.map(({ to, short, icon: Icon, end }) => (
          <NavLink key={to} className={({ isActive }) => `bottom-nav-link${isActive ? ' active' : ''}`} to={to} end={end}>
            <Icon size={20} strokeWidth={2} /><span>{short}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
