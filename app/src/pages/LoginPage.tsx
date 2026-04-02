import { useState } from 'react'
import { Link, Navigate, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { login } from '../lib/auth.api'
import { getApiErrorMessage } from '../lib/api'
import { useAuth } from '../auth/AuthContext'

export function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const { setSessionFromLogin, user, loading } = useAuth()

  const fromPath =
    (location.state as { from?: { pathname?: string } } | null)?.from?.pathname ??
    (() => {
      const raw = searchParams.get('from')
      if (!raw) return '/'
      try {
        return decodeURIComponent(raw)
      } catch {
        return '/'
      }
    })()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background-light dark:bg-background-dark text-slate-500">
        Loading…
      </div>
    )
  }

  if (user) {
    const dest =
      fromPath && fromPath !== '/'
        ? fromPath.startsWith('/')
          ? fromPath
          : '/'
        : user.role === 'admin'
          ? '/admin'
          : '/discovery'
    return <Navigate to={dest} replace />
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      const res = await login(email.trim(), password)
      await setSessionFromLogin(res.accessToken)
      const dest =
        fromPath && fromPath !== '/'
          ? fromPath.startsWith('/')
            ? fromPath
            : '/'
          : res.role === 'admin'
            ? '/admin'
            : '/discovery'
      navigate(dest, { replace: true })
    } catch (err) {
      setError(getApiErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-background-light dark:bg-background-dark flex items-center justify-center p-4 md:p-8">
      <div className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl p-8">
        <div className="flex items-center gap-3 mb-8">
          <div className="flex items-center justify-center size-11 rounded-xl bg-primary text-white shadow-lg">
            <span className="material-symbols-outlined text-[26px] leading-none">footprint</span>
          </div>
          <div>
            <h1 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">
              Rental Shoe
            </h1>
            <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider">
              Sign in
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {error && (
            <div className="rounded-lg bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm px-3 py-2">
              {error}
            </div>
          )}
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1.5">
              Email
            </label>
            <input
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-4 py-3 text-sm focus:ring-2 focus:ring-primary"
              required
            />
          </div>
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1.5">
              Password
            </label>
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-4 py-3 text-sm focus:ring-2 focus:ring-primary"
              required
            />
          </div>
          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-primary text-white py-3.5 rounded-xl font-bold text-sm uppercase tracking-widest shadow-lg hover:opacity-95 disabled:opacity-50 transition-opacity"
          >
            {submitting ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <p className="mt-8 text-center text-sm text-slate-500">
          No account?{' '}
          <Link to="/signup" className="text-primary font-bold hover:underline">
            Create one
          </Link>
        </p>
      </div>
    </div>
  )
}
