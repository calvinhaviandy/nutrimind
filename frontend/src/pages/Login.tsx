import { useEffect, useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { ArrowRight, Eye, EyeOff } from 'lucide-react'
import AuthLayout from '../components/AuthLayout'
import { api, ApiError } from '../lib/api'
import { useAuth } from '../lib/auth'
import type { Session } from '../lib/types'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const navigate = useNavigate()
  const location = useLocation()
  const { setSession } = useAuth()

  useEffect(() => { document.title = 'Masuk — NutriMind' }, [])

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      const session = await api<Session>('/api/auth/login', { method: 'POST', body: JSON.stringify({ email: email.trim(), password }) })
      if (!session.authenticated) throw new ApiError('Email atau kata sandi tidak sesuai.', 401)
      setSession(session)
      const from = (location.state as { from?: string } | null)?.from
      navigate(from?.startsWith('/app') ? from : '/app', { replace: true })
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Gagal masuk. Silakan coba lagi.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AuthLayout variant="login">
      <h1>Senang bertemu lagi<span className="coral-dot">.</span></h1>
      <p className="auth-subtitle">Masuk untuk melanjutkan perjalanan makan lebih sadar.</p>
      <form onSubmit={submit} className="auth-form">
        {error && <div className="form-error" role="alert">{error}</div>}
        <label htmlFor="email">Alamat email</label>
        <input id="email" type="email" name="email" autoComplete="email" placeholder="nama@email.com" value={email} onChange={event => setEmail(event.target.value)} required />
        <label htmlFor="password">Kata sandi</label>
        <div className="password-field"><input id="password" type={showPassword ? 'text' : 'password'} name="password" autoComplete="current-password" placeholder="Masukkan kata sandi" value={password} onChange={event => setPassword(event.target.value)} required /><button type="button" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'}>{showPassword ? <EyeOff size={19} /> : <Eye size={19} />}</button></div>
        <button className="button auth-submit" type="submit" disabled={submitting}>{submitting ? 'Memproses...' : 'Masuk ke NutriMind'} <ArrowRight size={18} /></button>
      </form>
      <p className="auth-switch">Belum punya akun? <Link to="/register">Daftar gratis</Link></p>
    </AuthLayout>
  )
}
