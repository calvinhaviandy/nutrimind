import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { api } from './api'
import type { Session } from './types'

type AuthContextValue = {
  session: Session | null
  loading: boolean
  setSession: (value: Session) => void
  refresh: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  async function refresh() {
    setLoading(true)
    try {
      setSession(await api<Session>('/api/session'))
    } catch {
      setSession({ authenticated: false, user: null })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void refresh() }, [])

  return <AuthContext.Provider value={{ session, loading, setSession, refresh }}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const value = useContext(AuthContext)
  if (!value) throw new Error('useAuth must be used inside AuthProvider')
  return value
}
