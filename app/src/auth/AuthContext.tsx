import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { fetchMe, type MeResponse } from '../lib/auth.api'
import { clearAccessToken, getAccessToken, setAccessToken } from '../lib/authStorage'

type AuthContextValue = {
  user: MeResponse | null
  loading: boolean
  setSessionFromLogin: (token: string) => Promise<void>
  refreshUser: () => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<MeResponse | null>(null)
  const [loading, setLoading] = useState(true)

  const refreshUser = useCallback(async () => {
    const t = getAccessToken()
    if (!t) {
      setUser(null)
      setLoading(false)
      return
    }
    try {
      const me = await fetchMe()
      setUser(me)
    } catch {
      clearAccessToken()
      setUser(null)
    } finally {
      setLoading(false)
    }
  }, [])

  const setSessionFromLogin = useCallback(async (token: string) => {
    setAccessToken(token)
    setLoading(true)
    try {
      const me = await fetchMe()
      setUser(me)
    } catch {
      clearAccessToken()
      setUser(null)
    } finally {
      setLoading(false)
    }
  }, [])

  const logout = useCallback(() => {
    clearAccessToken()
    setUser(null)
  }, [])

  useEffect(() => {
    void refreshUser()
  }, [refreshUser])

  const value = useMemo(
    () => ({ user, loading, setSessionFromLogin, refreshUser, logout }),
    [user, loading, setSessionFromLogin, refreshUser, logout],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return ctx
}
