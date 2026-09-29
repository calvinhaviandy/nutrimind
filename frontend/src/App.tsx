import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import type { ReactNode } from 'react'
import { AuthProvider, useAuth } from './lib/auth'
import AppShell from './components/AppShell'
import Landing from './pages/Landing'
import Login from './pages/Login'
import Register from './pages/Register'
import Dashboard from './pages/app/Dashboard'
import ScanFood from './pages/app/ScanFood'
import FoodLog from './pages/app/FoodLog'
import GeneratePlan from './pages/app/GeneratePlan'
import MealPlans from './pages/app/MealPlans'
import Reports from './pages/app/Reports'

function Protected() {
  const { session, loading } = useAuth()
  const location = useLocation()

  if (loading) return <div className="loading-screen" role="status"><span className="loading-mark">N</span><p>Menyiapkan ruangmu...</p></div>
  if (!session?.authenticated) return <Navigate to="/login" replace state={{ from: location.pathname }} />
  return <AppShell />
}

function GuestOnly({ children }: { children: ReactNode }) {
  const { session, loading } = useAuth()
  if (loading) return <div className="loading-screen" role="status"><span className="loading-mark">N</span><p>Menyiapkan ruangmu...</p></div>
  if (session?.authenticated) return <Navigate to="/app" replace />
  return children
}

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/landing" element={<Landing />} />
        <Route path="/login" element={<GuestOnly><Login /></GuestOnly>} />
        <Route path="/register" element={<GuestOnly><Register /></GuestOnly>} />
        <Route path="/app" element={<Protected />}>
          <Route index element={<Dashboard />} />
          <Route path="scan" element={<ScanFood />} />
          <Route path="journal" element={<FoodLog />} />
          <Route path="plan" element={<MealPlans />} />
          <Route path="plan/new" element={<GeneratePlan />} />
          <Route path="insights" element={<Reports />} />
        </Route>
        <Route path="/dashboard" element={<Navigate to="/app" replace />} />
        <Route path="/scanfood" element={<Navigate to="/app/scan" replace />} />
        <Route path="/food-log" element={<Navigate to="/app/journal" replace />} />
        <Route path="/meal-plan" element={<Navigate to="/app/plan" replace />} />
        <Route path="/generate-plan" element={<Navigate to="/app/plan/new" replace />} />
        <Route path="/reports" element={<Navigate to="/app/insights" replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthProvider>
  )
}
