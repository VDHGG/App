import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { useAuth } from '../auth/AuthContext'
import {
  addWishlistItem,
  fetchWishlistShoeIds,
  removeWishlistItem,
} from '../lib/wishlist.api'

type WishlistContextValue = {
  shoeIds: Set<string>
  loading: boolean
  isCustomer: boolean
  isInWishlist: (shoeId: string) => boolean
  refresh: () => Promise<void>
  toggle: (shoeId: string) => Promise<void>
}

const WishlistContext = createContext<WishlistContextValue | null>(null)

export function WishlistProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [shoeIds, setShoeIds] = useState<Set<string>>(() => new Set())
  const [loading, setLoading] = useState(false)

  const isCustomer = user?.role === 'customer' && Boolean(user.customerId)

  const refresh = useCallback(async () => {
    if (!isCustomer) {
      setShoeIds(new Set())
      return
    }
    setLoading(true)
    try {
      const { shoeIds: ids } = await fetchWishlistShoeIds()
      setShoeIds(new Set(ids))
    } catch {
      setShoeIds(new Set())
    } finally {
      setLoading(false)
    }
  }, [isCustomer])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const isInWishlist = useCallback(
    (shoeId: string) => shoeIds.has(shoeId),
    [shoeIds]
  )

  const toggle = useCallback(
    async (shoeId: string) => {
      if (!isCustomer) return
      const was = shoeIds.has(shoeId)
      try {
        if (was) {
          await removeWishlistItem(shoeId)
        } else {
          await addWishlistItem(shoeId)
        }
        setShoeIds((prev) => {
          const next = new Set(prev)
          if (was) next.delete(shoeId)
          else next.add(shoeId)
          return next
        })
      } catch {
        await refresh()
      }
    },
    [isCustomer, shoeIds, refresh]
  )

  const value = useMemo(
    () => ({
      shoeIds,
      loading,
      isCustomer,
      isInWishlist,
      refresh,
      toggle,
    }),
    [shoeIds, loading, isCustomer, isInWishlist, refresh, toggle]
  )

  return <WishlistContext.Provider value={value}>{children}</WishlistContext.Provider>
}

export function useWishlist() {
  const ctx = useContext(WishlistContext)
  if (!ctx) {
    throw new Error('useWishlist must be used within WishlistProvider')
  }
  return ctx
}
