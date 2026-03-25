import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { getAdminAccessToken } from '../../lib/authStorage'
import { AdminSidebar } from './AdminSidebar'

export function AdminLayout() {
  const location = useLocation()
  const token = getAdminAccessToken()

  if (!token) {
    return <Navigate to="/admin/login" state={{ from: location }} replace />
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
