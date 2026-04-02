import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  listShoes,
  deactivateShoe,
  type ListShoesQuery,
  type ShoeSummary,
} from '../../lib/shoes.api'
import { AdminHeader } from '../../components/admin/AdminHeader'
import { formatCurrency } from '../../lib/format'
import { getApiErrorMessage } from '../../lib/api'
import { ShoeImage } from '../../components/ShoeImage'
import { DEFAULT_PAGE_SIZE } from '../../lib/pagination'
import { AdminPagination } from '../../components/admin/AdminPagination'

function activeStatus(s: ShoeSummary): {
  label: string
  dotClass: string
  textClass: string
} {
  if (!s.isActive) {
    return {
      label: 'Inactive',
      dotClass: 'bg-slate-400',
      textClass: 'text-slate-500',
    }
  }
  return {
    label: 'Active',
    dotClass: 'bg-emerald-500',
    textClass: 'text-emerald-600 dark:text-emerald-400',
  }
}

export function AdminShoesPage() {
  const [shoes, setShoes] = useState<ShoeSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [showInactive, setShowInactive] = useState(true)
  const [priceBucket, setPriceBucket] = useState<ListShoesQuery['priceBucket']>('all')
  const [stockBucket, setStockBucket] = useState<ListShoesQuery['stockBucket']>('all')
  const [actionId, setActionId] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [listMeta, setListMeta] = useState({
    total: 0,
    totalPages: 1,
    pageSize: DEFAULT_PAGE_SIZE,
  })

  const load = useCallback((): Promise<void> => {
    setError(null)
    return listShoes({
      ...(priceBucket && priceBucket !== 'all' ? { priceBucket } : {}),
      ...(stockBucket && stockBucket !== 'all' ? { stockBucket } : {}),
      page,
      pageSize: DEFAULT_PAGE_SIZE,
    })
      .then((res) => {
        setShoes(res.shoes)
        setListMeta({
          total: res.total,
          totalPages: res.totalPages,
          pageSize: res.pageSize,
        })
      })
      .catch((err) => setError(getApiErrorMessage(err)))
      .finally(() => setLoading(false))
  }, [priceBucket, stockBucket, page])

  useEffect(() => {
    setLoading(true)
    void load()
  }, [load])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return shoes.filter((s) => {
      if (!showInactive && !s.isActive) return false
      if (!q) return true
      return (
        s.name.toLowerCase().includes(q) ||
        s.brand.toLowerCase().includes(q) ||
        s.category.toLowerCase().includes(q) ||
        s.shoeId.toLowerCase().includes(q)
      )
    })
  }, [shoes, search, showInactive])

  const handleDeactivate = async (shoeId: string) => {
    if (!window.confirm('Deactivate this product? It will be hidden from the storefront.')) return
    setActionId(shoeId)
    setActionError(null)
    try {
      await deactivateShoe(shoeId)
      await load()
    } catch (err: unknown) {
      setActionError(getApiErrorMessage(err))
    } finally {
      setActionId(null)
    }
  }

  if (loading) {
    return (
      <>
        <AdminHeader title="Shoe inventory" />
        <div className="p-8 flex items-center justify-center min-h-[400px]">
          <div className="text-slate-500">Loading...</div>
        </div>
      </>
    )
  }

  if (error) {
    return (
      <>
        <AdminHeader title="Shoe inventory" />
        <div className="p-8 flex flex-col items-center justify-center min-h-[400px] gap-4">
          <p className="text-red-600">{error}</p>
        </div>
      </>
    )
  }

  return (
    <>
      <AdminHeader title="Shoe inventory" />
      <div className="p-6 lg:p-8 space-y-6 max-w-[1400px]">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <p className="text-sm text-slate-500">
              Add, edit, or deactivate shoes and variants (stock is per variant).
            </p>
          </div>
          <Link
            to="/admin/shoes/new"
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary/90"
          >
            <span className="material-symbols-outlined text-lg">add</span>
            Add shoe
          </Link>
        </div>

        {actionError && (
          <div className="p-4 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm">
            {actionError}
          </div>
        )}

        <div className="flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1 max-w-md">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xl">
                search
              </span>
              <input
                type="search"
                placeholder="Search name, brand, category, ID..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm"
              />
            </div>
            <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400 cursor-pointer">
              <input
                type="checkbox"
                checked={showInactive}
                onChange={(e) => setShowInactive(e.target.checked)}
                className="rounded border-slate-300"
              />
              Show inactive
            </label>
          </div>
          <div className="flex flex-col sm:flex-row flex-wrap gap-3 sm:items-center">
            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Price / day (USD)
              </span>
              <select
                value={priceBucket ?? 'all'}
                onChange={(e) => {
                  setPage(1)
                  setPriceBucket(e.target.value as NonNullable<ListShoesQuery['priceBucket']>)
                }}
                className="px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 focus:ring-2 focus:ring-primary text-sm font-semibold min-w-[180px]"
              >
                <option value="all">All prices</option>
                <option value="lt10">Under $10</option>
                <option value="10to20">$10 – $20</option>
                <option value="20to50">$20 – $50</option>
                <option value="gt50">Over $50</option>
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Total stock
              </span>
              <select
                value={stockBucket ?? 'all'}
                onChange={(e) => {
                  setPage(1)
                  setStockBucket(e.target.value as NonNullable<ListShoesQuery['stockBucket']>)
                }}
                className="px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 focus:ring-2 focus:ring-primary text-sm font-semibold min-w-[180px]"
              >
                <option value="all">All stock levels</option>
                <option value="0">0 units</option>
                <option value="1to5">1 – 5 units</option>
                <option value="6plus">6+ units</option>
              </select>
            </div>
          </div>
        </div>

        <p className="text-xs text-slate-500">
          Search and “Show inactive” apply to the current page of results only.
        </p>

        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead className="bg-slate-50/80 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-500 uppercase tracking-wider">
                <tr>
                  <th className="px-6 py-4">Product details</th>
                  <th className="px-6 py-4">Category</th>
                  <th className="px-6 py-4">Stock</th>
                  <th className="px-6 py-4">Rental price</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
                      No shoes match your filters.
                    </td>
                  </tr>
                ) : (
                  filtered.map((s) => {
                    const st = activeStatus(s)
                    return (
                      <tr
                        key={s.shoeId}
                        className="hover:bg-slate-50/80 dark:hover:bg-slate-800/30 transition-colors group"
                      >
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-4">
                            <div className="w-16 h-16 rounded-xl bg-slate-100 dark:bg-slate-800 flex-shrink-0 overflow-hidden border border-slate-200 dark:border-slate-600 relative">
                              <ShoeImage
                                src={s.imageUrl}
                                alt=""
                                compact
                                imgClassName="absolute inset-0 w-full h-full object-cover"
                              />
                            </div>
                            <div>
                              <p className="font-bold text-slate-900 dark:text-white">{s.name}</p>
                              <p className="text-xs text-slate-400 mt-0.5">SKU: {s.shoeId}</p>
                              <p className="text-xs text-slate-500 mt-0.5">
                                {s.brand} · {s.variantCount} variant{s.variantCount === 1 ? '' : 's'}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="inline-flex px-3 py-1 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-full text-xs font-medium">
                            {s.category}
                          </span>
                        </td>
                        <td className="px-6 py-4 font-semibold text-slate-700 dark:text-slate-200">
                          {String(s.unitsInStock).padStart(2, '0')} units
                        </td>
                        <td className="px-6 py-4">
                          <span className="font-bold text-primary">{formatCurrency(s.pricePerDay)}</span>
                          <span className="text-xs text-slate-400"> /day</span>
                        </td>
                        <td className="px-6 py-4">
                          <div className={`flex items-center gap-1.5 ${st.textClass}`}>
                            <span className={`w-2 h-2 rounded-full shrink-0 ${st.dotClass}`} />
                            <span className="text-xs font-bold uppercase tracking-wide">{st.label}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center justify-end gap-1">
                            <Link
                              to={`/admin/shoes/${s.shoeId}/edit`}
                              aria-label="Edit product"
                              className="inline-flex items-center justify-center p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                            >
                              <span
                                className="material-symbols-outlined text-[22px] leading-none"
                                style={{ fontVariationSettings: "'FILL' 0, 'wght' 400" }}
                              >
                                edit
                              </span>
                            </Link>
                            {s.isActive && (
                              <button
                                type="button"
                                aria-label="Deactivate product"
                                disabled={actionId === s.shoeId}
                                onClick={() => handleDeactivate(s.shoeId)}
                                className="inline-flex items-center justify-center p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors disabled:opacity-50"
                              >
                                <span
                                  className="material-symbols-outlined text-[22px] leading-none"
                                  style={{ fontVariationSettings: "'FILL' 0, 'wght' 400" }}
                                >
                                  delete
                                </span>
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
          <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30">
            <AdminPagination
              page={page}
              totalPages={listMeta.totalPages}
              total={listMeta.total}
              pageSize={listMeta.pageSize}
              onPageChange={setPage}
            />
          </div>
        </div>
      </div>
    </>
  )
}
