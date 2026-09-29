import type { ReactNode } from 'react'
import { ArrowLeft, Check, Sparkles } from 'lucide-react'
import { Link } from 'react-router-dom'
import Brand from './Brand'

export default function AuthLayout({ children, variant }: { children: ReactNode; variant: 'login' | 'register' }) {
  return (
    <div className="auth-layout">
      <aside className="auth-aside">
        <Brand inverse />
        <div className="auth-aside-body">
          <span className="eyebrow eyebrow-light"><Sparkles size={14} /> Teman makan lebih sadar</span>
          <h2>Perubahan baik dimulai dari <em>satu pilihan.</em></h2>
          <p>Pahami pola makanmu, temukan rencana yang pas, dan rayakan tiap langkah kecil menuju kebiasaan yang lebih sehat.</p>
          <div className="auth-benefits">
            <span><Check size={16} /> Catat makanan tanpa ribet</span>
            <span><Check size={16} /> Rencana makan sesuai kebutuhan</span>
            <span><Check size={16} /> Lihat progres dengan jelas</span>
          </div>
        </div>
        <div className="auth-aside-decoration" aria-hidden="true"><span /><span /><span /></div>
        <p className="auth-aside-foot">NutriMind · Dibuat untuk keseharian yang lebih seimbang.</p>
      </aside>
      <main className="auth-main">
        <div className="auth-mobile-brand"><Brand /></div>
        <Link className="auth-back" to="/"><ArrowLeft size={16} /> Kembali ke beranda</Link>
        <div className="auth-panel">
          <span className="eyebrow">{variant === 'login' ? 'Selamat datang kembali' : 'Mulai perjalananmu'}</span>
          {children}
        </div>
        <p className="auth-main-foot">© {new Date().getFullYear()} NutriMind</p>
      </main>
    </div>
  )
}
