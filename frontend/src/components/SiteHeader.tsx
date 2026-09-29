import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { ArrowUpRight, Menu, X } from 'lucide-react'
import Brand from './Brand'
import { useAuth } from '../lib/auth'

export default function SiteHeader() {
  const [open, setOpen] = useState(false)
  const location = useLocation()
  const { session } = useAuth()
  const isSignedIn = session?.authenticated

  return (
    <header className="site-header">
      <div className="site-header-inner container">
        <Brand />
        <nav className="site-nav" aria-label="Navigasi utama">
          <a href="/#fitur">Fitur</a>
          <a href="/#cara-kerja">Cara kerja</a>
          <a href="/#tanya-jawab">Tanya jawab</a>
        </nav>
        <div className="site-header-actions">
          {!isSignedIn && <Link className="text-link" to="/login">Masuk</Link>}
          <Link className="button button-sm" to={isSignedIn ? '/app' : '/register'}>{isSignedIn ? 'Buka ruangmu' : 'Mulai gratis'} <ArrowUpRight size={16} /></Link>
        </div>
        <button
          className="icon-button mobile-menu-button"
          type="button"
          aria-label={open ? 'Tutup menu' : 'Buka menu'}
          aria-expanded={open}
          onClick={() => setOpen(!open)}
        >
          {open ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>
      {open && (
        <nav className="mobile-menu" aria-label="Navigasi seluler" key={location.pathname}>
          <a onClick={() => setOpen(false)} href="/#fitur">Fitur</a>
          <a onClick={() => setOpen(false)} href="/#cara-kerja">Cara kerja</a>
          <a onClick={() => setOpen(false)} href="/#tanya-jawab">Tanya jawab</a>
          {!isSignedIn && <Link onClick={() => setOpen(false)} to="/login">Masuk</Link>}
          <Link onClick={() => setOpen(false)} className="button" to={isSignedIn ? '/app' : '/register'}>{isSignedIn ? 'Buka ruangmu' : 'Buat akun gratis'}</Link>
        </nav>
      )}
    </header>
  )
}
