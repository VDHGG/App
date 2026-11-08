import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  clearWishlist,
  fetchWishlist,
  removeWishlistItem,
  type WishlistItemDto,
} from '../lib/wishlist.api'
import { listShoes, type ShoeSummary } from '../lib/shoes.api'
import { getApiErrorMessage } from '../lib/api'
import { formatCurrency } from '../lib/format'
import { useAuth } from '../auth/AuthContext'
import { useWishlist } from '../wishlist/WishlistContext'
import { useRentalCart } from '../cart/RentalCartContext'
import { ShoeImage } from '../components/ShoeImage'

export function WishlistPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const { refresh: refreshWishlistIds } = useWishlist()
  const { addOrMergeLine, hasVariantInCart } = useRentalCart()
  const [items, setItems] = useState<WishlistItemDto[]>([])
  const [catalogShoes, setCatalogShoes] = useState<ShoeSummary[]>([])
  const [selectedVariants, setSelectedVariants] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [clearing, setClearing] = useState(false)

  const load = useCallback(async () => {
    setError(null)
    try {
      const [res, shoesRes] = await Promise.all([
        fetchWishlist(),
        listShoes({ pageSize: 50 }).catch(() => ({ shoes: [] as ShoeSummary[] })),
      ])
      setItems(res.items)
      setCatalogShoes(shoesRes.shoes)
      const defaults: Record<string, string> = {}
      for (const s of shoesRes.shoes) {
        const variants = s.variants ?? []
        if (variants.length > 0) {
          const firstAvail =
            variants.find((v) => (v.availableQuantity ?? v.totalQuantity) > 0) ?? variants[0]
          defaults[s.shoeId] = firstAvail.variantId
        }
      }
      setSelectedVariants((prev) => ({ ...defaults, ...prev }))
    } catch (e) {
      setError(getApiErrorMessage(e))
    } finally {
      setLoading(false)
    }
  }, [])

  const shoeMap = useMemo(() => {
    const map = new Map<string, ShoeSummary>()
    for (const s of catalogShoes) {
      map.set(s.shoeId, s)
    }
    return map
  }, [catalogShoes])

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

  function addItemVariantToCart(item: WishlistItemDto): boolean {
    const summary = shoeMap.get(item.shoeId)
    const variants = summary?.variants ?? []
    const chosenId = selectedVariants[item.shoeId]
    const chosen =
      variants.find((v) => v.variantId === chosenId) ??
      variants.find((v) => (v.availableQuantity ?? v.totalQuantity) > 0) ??
      variants[0]
    if (!chosen) return false
    const avail = chosen.availableQuantity ?? chosen.totalQuantity
    if (avail <= 0) return false
    addOrMergeLine({
      variantId: chosen.variantId,
      shoeId: item.shoeId,
      shoeName: item.name,
      brand: item.brand,
      size: chosen.size,
      color: chosen.color,
      pricePerDay: item.pricePerDay,
      availableQuantity: avail,
      quantity: 1,
      imageUrlCard: item.imageUrl,
    })
    return true
  }

  function handleRentNow(item: WishlistItemDto) {
    const added = addItemVariantToCart(item)
    if (added) {
      navigate('/checkout')
    } else {
      navigate(`/checkout?shoeId=${item.shoeId}`)
    }
  }

  function handleRentAllAvailable() {
    let addedCount = 0
    for (const item of items) {
      if (addItemVariantToCart(item)) {
        addedCount++
      }
    }
    if (addedCount > 0) {
      navigate('/checkout')
    }
  }

  const availableWishlistCount = useMemo(() => {
    let count = 0
    for (const item of items) {
      const s = shoeMap.get(item.shoeId)
      const avail = s ? (s.availableUnitsInRange ?? s.unitsInStock) : 0
      if (avail > 0 && (s?.variants?.length ?? 0) > 0) count++
    }
    return count
  }, [items, shoeMap])

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
        <div className="flex flex-wrap items-center gap-3">
          {items.length > 0 && (
            <button
              type="button"
              disabled={availableWishlistCount === 0}
              onClick={handleRentAllAvailable}
              className="px-5 py-2.5 bg-primary text-white font-bold rounded-xl shadow-md hover:opacity-90 transition-all text-sm flex items-center gap-2 disabled:opacity-50"
            >
              🛒 Thuê tất cả mẫu còn hàng ({availableWishlistCount})
            </button>
          )}
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
          {items.map((item) => {
            const summary = shoeMap.get(item.shoeId)
            const variants = summary?.variants ?? []
            const availUnits = summary ? (summary.availableUnitsInRange ?? summary.unitsInStock) : 0
            const chosenVariantId =
              selectedVariants[item.shoeId] ??
              variants.find((v) => (v.availableQuantity ?? v.totalQuantity) > 0)?.variantId ??
              variants[0]?.variantId ??
              ''
            const chosenVariant = variants.find((v) => v.variantId === chosenVariantId)
            const chosenAvail = chosenVariant
              ? (chosenVariant.availableQuantity ?? chosenVariant.totalQuantity)
              : 0
            const inCart = chosenVariantId ? hasVariantInCart(chosenVariantId) : false

            return (
              <div
                key={item.shoeId}
                className="group bg-white dark:bg-slate-900 rounded-xl overflow-hidden shadow-sm hover:shadow-lg transition-all border border-slate-200 dark:border-slate-800 hover:border-primary/30 flex flex-col"
              >
                <div className="aspect-[4/3] bg-slate-100 dark:bg-slate-800 overflow-hidden relative">
                  <Link to={`/shoes/${item.shoeId}`} className="block h-full">
                    <ShoeImage
                      src={item.imageUrl}
                      alt={item.name}
                      imgClassName="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                  </Link>
                  <div className="absolute top-3 left-3">
                    {summary ? (
                      availUnits > 0 ? (
                        <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-600/90 text-white shadow-sm">
                          Còn {availUnits} đôi trống
                        </span>
                      ) : (
                        <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-rose-600/90 text-white shadow-sm">
                          Tạm hết hàng
                        </span>
                      )
                    ) : null}
                  </div>
                  <div className="absolute top-4 right-4 bg-white/90 dark:bg-slate-900/90 backdrop-blur-sm p-2 rounded-full shadow-sm">
                    <span
                      className="material-symbols-outlined text-primary text-xl leading-none"
                      style={{ fontVariationSettings: "'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 24" }}
                    >
                      favorite
                    </span>
                  </div>
                </div>
                <div className="p-5 flex-1 flex flex-col">
                  <div className="flex justify-between items-start mb-1 gap-2">
                    <Link
                      to={`/shoes/${item.shoeId}`}
                      className="text-lg font-extrabold text-slate-900 dark:text-white leading-tight hover:text-primary transition-colors"
                    >
                      {item.name}
                    </Link>
                    <span className="text-primary font-bold shrink-0">
                      {formatCurrency(item.pricePerDay)} / day
                    </span>
                  </div>
                  <p className="text-slate-500 text-sm mb-3 line-clamp-2">
                    {item.brand} · {item.category}
                  </p>

                  {variants.length > 0 && (
                    <div className="mb-4">
                      <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                        Chọn Size & Màu sắc
                      </label>
                      <select
                        value={chosenVariantId}
                        onChange={(e) =>
                          setSelectedVariants((prev) => ({
                            ...prev,
                            [item.shoeId]: e.target.value,
                          }))
                        }
                        className="w-full h-9 px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-semibold text-slate-800 dark:text-slate-200"
                      >
                        {variants.map((v) => {
                          const vAvail = v.availableQuantity ?? v.totalQuantity
                          return (
                            <option
                              key={v.variantId}
                              value={v.variantId}
                              disabled={vAvail <= 0}
                            >
                              Size EU {v.size} · {v.color} (còn {vAvail} đôi)
                            </option>
                          )
                        })}
                      </select>
                    </div>
                  )}

                  <div className="mt-auto space-y-2">
                    {variants.length > 0 && (
                      <button
                        type="button"
                        disabled={chosenAvail <= 0}
                        onClick={() => addItemVariantToCart(item)}
                        className={`w-full py-2.5 px-3 rounded-xl text-xs font-bold border transition-colors ${
                          inCart
                            ? 'bg-emerald-50 dark:bg-emerald-900/30 border-emerald-300 dark:border-emerald-700 text-emerald-700 dark:text-emerald-300'
                            : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 hover:border-primary hover:text-primary'
                        } disabled:opacity-50`}
                      >
                        {inCart ? '✓ Đã có trong giỏ (+1)' : '+ Thêm vào giỏ thuê'}
                      </button>
                    )}
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        type="button"
                        disabled={Boolean(summary && chosenAvail <= 0)}
                        onClick={() => handleRentNow(item)}
                        className="bg-primary text-white font-bold py-2.5 px-4 rounded-xl shadow-lg hover:opacity-90 disabled:opacity-50 text-sm text-center"
                      >
                        {summary && chosenAvail <= 0 ? 'Hết hàng' : 'Thuê ngay'}
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleRemove(item.shoeId)}
                        className="bg-transparent border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 font-semibold py-2.5 px-4 rounded-xl hover:bg-rose-50 dark:hover:bg-rose-950/30 hover:text-rose-600 hover:border-rose-200 text-sm transition-colors"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
