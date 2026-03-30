import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../../auth/AuthContext'
import { AdminSidebar } from './AdminSidebar'

export function AdminLayout() {
  const location = useLocation()
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background-light dark:bg-background-dark text-slate-500">
        Loading…
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  if (user.role !== 'admin') {
    return <Navigate to="/" replace />
  }

  return (
    <div className="flex min-h-screen overflow-hidden bg-background-light dark:bg-background-dark">
      <AdminSidebar />
      <main className="ml-64 flex-1 flex flex-col min-w-0 overflow-auto">
        <Outlet />
      </main>
    </div>
  )
}
