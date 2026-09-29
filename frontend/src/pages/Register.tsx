import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowRight, Eye, EyeOff } from 'lucide-react'
import AuthLayout from '../components/AuthLayout'
import { api, ApiError } from '../lib/api'
import { useAuth } from '../lib/auth'
import type { Session } from '../lib/types'

export default function Register() {
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const { setSession } = useAuth()
  const navigate = useNavigate()

  useEffect(() => { document.title = 'Daftar — NutriMind' }, [])

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    if (password !== confirmPassword) {
      setError('Konfirmasi kata sandi belum sama.')
      return
    }
    setSubmitting(true)
    try {
      const session = await api<Session>('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({ full_name: fullName.trim(), email: email.trim(), password, confirm_password: confirmPassword }),
      })
      if (!session.authenticated) throw new ApiError('Akun belum berhasil dibuat. Silakan coba lagi.', 400)
      setSession(session)
      navigate('/app', { replace: true })
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Gagal membuat akun. Silakan coba lagi.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AuthLayout variant="register">
      <h1>Mulai dari sini<span className="coral-dot">.</span></h1>
      <p className="auth-subtitle">Buat akun dan bangun kebiasaan makan yang cocok untukmu.</p>
      <form onSubmit={submit} className="auth-form">
        {error && <div className="form-error" role="alert">{error}</div>}
        <label htmlFor="full-name">Nama lengkap</label>
        <input id="full-name" name="full_name" type="text" autoComplete="name" placeholder="Nama panggilanmu" value={fullName} onChange={event => setFullName(event.target.value)} minLength={2} required />
        <label htmlFor="email">Alamat email</label>
        <input id="email" name="email" type="email" autoComplete="email" placeholder="nama@email.com" value={email} onChange={event => setEmail(event.target.value)} required />
        <label htmlFor="password">Kata sandi</label>
        <div className="password-field"><input id="password" name="password" type={showPassword ? 'text' : 'password'} autoComplete="new-password" placeholder="Minimal 8 karakter" value={password} onChange={event => setPassword(event.target.value)} minLength={8} required /><button type="button" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'}>{showPassword ? <EyeOff size={19} /> : <Eye size={19} />}</button></div>
        <label htmlFor="confirm-password">Konfirmasi kata sandi</label>
        <input id="confirm-password" name="confirm_password" type={showPassword ? 'text' : 'password'} autoComplete="new-password" placeholder="Ulangi kata sandi" value={confirmPassword} onChange={event => setConfirmPassword(event.target.value)} minLength={8} required />
        <button className="button auth-submit" type="submit" disabled={submitting}>{submitting ? 'Membuat akun...' : 'Buat akun gratis'} <ArrowRight size={18} /></button>
      </form>
      <p className="auth-switch">Sudah punya akun? <Link to="/login">Masuk</Link></p>
    </AuthLayout>
  )
}
