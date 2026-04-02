import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  clearWishlist,
  fetchWishlist,
  removeWishlistItem,
  type WishlistItemDto,
} from '../lib/wishlist.api'
import { getApiErrorMessage } from '../lib/api'
import { useAuth } from '../auth/AuthContext'
import { useWishlist } from '../wishlist/WishlistContext'
import { ShoeImage } from '../components/ShoeImage'

export function WishlistPage() {
  const { user } = useAuth()
  const { refresh: refreshWishlistIds } = useWishlist()
  const [items, setItems] = useState<WishlistItemDto[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [clearing, setClearing] = useState(false)

  const load = useCallback(async () => {
    setError(null)
    try {
      const res = await fetchWishlist()
      setItems(res.items)
    } catch (e) {
      setError(getApiErrorMessage(e))
    } finally {
      setLoading(false)
    }
  }, [])

  const isCustomer = user?.role === 'customer' && Boolean(user.customerId)

  useEffect(() => {
    if (!isCustomer) {
      setLoading(false)
      return
    }
    void load()
  }, [load, isCustomer])

  async function handleClear() {
    if (!items.length) return
    if (!window.confirm('Remove all shoes from your wishlist?')) return
    setClearing(true)
    setError(null)
    try {
      await clearWishlist()
      setItems([])
      await refreshWishlistIds()
    } catch (e) {
      setError(getApiErrorMessage(e))
    } finally {
      setClearing(false)
    }
  }

  async function handleRemove(shoeId: string) {
    setError(null)
    try {
      await removeWishlistItem(shoeId)
      setItems((prev) => prev.filter((i) => i.shoeId !== shoeId))
      await refreshWishlistIds()
    } catch (e) {
      setError(getApiErrorMessage(e))
    }
  }

  if (!isCustomer) {
    return (
      <div className="max-w-lg mx-auto px-4 py-16 text-center">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-3">Wishlist</h1>
        <p className="text-slate-600 dark:text-slate-400 mb-6">
          Save favorites with a customer account. Admins can browse shoes from the storefront without
          a wishlist.
        </p>
        <Link to="/shoes" className="text-primary font-semibold hover:underline">
          Browse shoes
        </Link>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10 lg:py-12">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-10">
        <div>
          <Link
            to="/shoes"
            className="flex items-center gap-2 text-primary font-semibold mb-2 hover:gap-3 transition-all text-sm"
          >
            <span className="material-symbols-outlined text-sm leading-none">arrow_back</span>
            Back to Store
          </Link>
          <h1 className="text-3xl font-black tracking-tight text-slate-900 dark:text-white">
            My Wishlist{' '}
            <span className="text-slate-500 font-light ml-2 text-xl">
              ({loading ? '…' : items.length} {items.length === 1 ? 'item' : 'items'})
            </span>
          </h1>
        </div>
        <button
          type="button"
          disabled={clearing || items.length === 0}
          onClick={() => void handleClear()}
          className="px-5 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-semibold rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-all text-sm flex items-center gap-2 disabled:opacity-50"
        >
          <span className="material-symbols-outlined text-lg leading-none">delete_sweep</span>
          {clearing ? 'Clearing…' : 'Clear all'}
        </button>
      </div>

      {error && (
        <div className="mb-6 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm px-3 py-2">
          {error}
        </div>
      )}

      {loading ? (
        <p className="text-slate-500">Loading wishlist…</p>
      ) : items.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed border-slate-200 dark:border-slate-700 p-12 text-center bg-slate-50/50 dark:bg-slate-900/30">
          <p className="text-slate-600 dark:text-slate-400 mb-4">Your wishlist is empty.</p>
          <Link
            to="/shoes"
            className="inline-flex items-center text-primary font-bold uppercase tracking-wide text-xs border-b-2 border-primary pb-1"
          >
            Browse collection
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {items.map((item) => (
            <div
              key={item.shoeId}
              className="group bg-white dark:bg-slate-900 rounded-xl overflow-hidden shadow-sm hover:shadow-lg transition-all border border-slate-200 dark:border-slate-800 hover:border-primary/30"
            >
              <div className="aspect-[4/3] bg-slate-100 dark:bg-slate-800 overflow-hidden relative">
                <Link to={`/shoes/${item.shoeId}`} className="block h-full">
                  <ShoeImage
                    src={item.imageUrl}
                    alt={item.name}
                    imgClassName="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                </Link>
                <div className="absolute top-4 right-4 bg-white/90 dark:bg-slate-900/90 backdrop-blur-sm p-2 rounded-full shadow-sm">
                  <span
                    className="material-symbols-outlined text-primary text-xl leading-none"
                    style={{ fontVariationSettings: "'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 24" }}
                  >
                    favorite
                  </span>
                </div>
              </div>
              <div className="p-5">
                <div className="flex justify-between items-start mb-1 gap-2">
                  <h3 className="text-lg font-extrabold text-slate-900 dark:text-white leading-tight">
                    {item.name}
                  </h3>
                  <span className="text-primary font-bold shrink-0">
                    ${item.pricePerDay} / day
                  </span>
                </div>
                <p className="text-slate-500 text-sm mb-6 line-clamp-2">
                  {item.brand} · {item.category}
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <Link
                    to={`/checkout?shoeId=${item.shoeId}`}
                    className="bg-primary text-white font-bold py-3 px-4 rounded-xl shadow-lg hover:opacity-90 text-sm text-center"
                  >
                    Rent now
                  </Link>
                  <button
                    type="button"
                    onClick={() => void handleRemove(item.shoeId)}
                    className="bg-transparent border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 font-semibold py-3 px-4 rounded-xl hover:bg-rose-50 dark:hover:bg-rose-950/30 hover:text-rose-600 hover:border-rose-200 text-sm transition-colors"
                  >
                    Remove
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
