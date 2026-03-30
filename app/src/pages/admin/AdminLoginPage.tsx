import { Navigate } from 'react-router-dom'

/** Legacy URL: same sign-in as storefront. */
export function AdminLoginPage() {
  return <Navigate to="/login" replace state={{ from: { pathname: '/admin' } }} />
}
