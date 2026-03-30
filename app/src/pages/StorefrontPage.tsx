import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { listShoes, type ShoeSummary } from '../lib/shoes.api'
import { ProductCard } from '../components/ProductCard'

const PAGE_SIZE = 9

type SortOption = 'featured' | 'price-asc' | 'price-desc' | 'name-asc' | 'name-desc'

function toggleSet<T>(set: Set<T>, value: T): Set<T> {
  const next = new Set(set)
  if (next.has(value)) next.delete(value)
  else next.add(value)
  return next
}

export function StorefrontPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const qFromUrl = (searchParams.get('q') ?? '').trim()

  const [shoes, setShoes] = useState<ShoeSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [localSearch, setLocalSearch] = useState(qFromUrl)
  const [categories, setCategories] = useState<Set<string>>(new Set())
  const [brands, setBrands] = useState<Set<string>>(new Set())
  const [priceMin, setPriceMin] = useState<string>('')
  const [priceMax, setPriceMax] = useState<string>('')
  const [sortBy, setSortBy] = useState<SortOption>('featured')
  const [page, setPage] = useState(1)

  useEffect(() => {
    setLocalSearch(qFromUrl)
  }, [qFromUrl])

  useEffect(() => {
    listShoes()
      .then((res) => setShoes(res.shoes.filter((s) => s.isActive)))
      .catch((err) => setError(err.message ?? 'Failed to load shoes'))
      .finally(() => setLoading(false))
  }, [])

  const uniqueCategories = useMemo(() => {
    const s = new Set(shoes.map((x) => x.category).filter(Boolean))
    return [...s].sort((a, b) => a.localeCompare(b))
  }, [shoes])

  const uniqueBrands = useMemo(() => {
    const s = new Set(shoes.map((x) => x.brand).filter(Boolean))
    return [...s].sort((a, b) => a.localeCompare(b))
  }, [shoes])

  const priceBounds = useMemo(() => {
    if (shoes.length === 0) return { min: 0, max: 0 }
    const prices = shoes.map((s) => s.pricePerDay)
    return { min: Math.min(...prices), max: Math.max(...prices) }
  }, [shoes])

  const filtered = useMemo(() => {
    const q = qFromUrl.toLowerCase()
    let list = shoes.slice()

    if (q) {
      list = list.filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          s.brand.toLowerCase().includes(q) ||
          s.category.toLowerCase().includes(q),
      )
    }

    if (categories.size > 0) {
      list = list.filter((s) => categories.has(s.category))
    }
    if (brands.size > 0) {
      list = list.filter((s) => brands.has(s.brand))
    }

    const minN = priceMin === '' ? null : Number(priceMin)
    const maxN = priceMax === '' ? null : Number(priceMax)
    if (minN !== null && !Number.isNaN(minN)) {
      list = list.filter((s) => s.pricePerDay >= minN)
    }
    if (maxN !== null && !Number.isNaN(maxN)) {
      list = list.filter((s) => s.pricePerDay <= maxN)
    }

    switch (sortBy) {
      case 'price-asc':
        list.sort((a, b) => a.pricePerDay - b.pricePerDay)
        break
      case 'price-desc':
        list.sort((a, b) => b.pricePerDay - a.pricePerDay)
        break
      case 'name-asc':
        list.sort((a, b) => a.name.localeCompare(b.name))
        break
      case 'name-desc':
        list.sort((a, b) => b.name.localeCompare(a.name))
        break
      case 'featured':
      default:
        list.sort((a, b) => b.unitsInStock - a.unitsInStock)
        break
    }

    return list
  }, [shoes, qFromUrl, categories, brands, priceMin, priceMax, sortBy])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages)
  const pageSlice = useMemo(() => {
    const p = Math.min(page, totalPages)
    const start = (p - 1) * PAGE_SIZE
    return filtered.slice(start, start + PAGE_SIZE)
  }, [filtered, page, totalPages])

  useEffect(() => {
    setPage(1)
  }, [qFromUrl, categories, brands, priceMin, priceMax, sortBy])

  useEffect(() => {
    if (page > totalPages) setPage(totalPages)
  }, [page, totalPages])

  const applySearch = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault()
      const next = new URLSearchParams(searchParams)
      const t = localSearch.trim()
      if (t) next.set('q', t)
      else next.delete('q')
      setSearchParams(next, { replace: true })
    },
    [localSearch, searchParams, setSearchParams],
  )

  const clearFilters = useCallback(() => {
    setCategories(new Set())
    setBrands(new Set())
    setPriceMin('')
    setPriceMax('')
    setSortBy('featured')
    setLocalSearch('')
    const next = new URLSearchParams(searchParams)
    next.delete('q')
    setSearchParams(next, { replace: true })
    setPage(1)
  }, [searchParams, setSearchParams])

  const showingFrom = filtered.length === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1
  const showingTo = Math.min(safePage * PAGE_SIZE, filtered.length)

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-slate-500">Loading...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <p className="text-red-600">{error}</p>
        <p className="text-sm text-slate-500">
          Make sure the backend server is running: <code>npm run server</code>
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <section className="relative overflow-hidden rounded-2xl bg-slate-900 mb-8">
        <div
          className="absolute inset-0 opacity-50 bg-cover bg-center"
          style={{
            backgroundImage: `url('https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=1200')`,
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-r from-slate-900 via-slate-900/60 to-transparent" />
        <div className="relative z-10 flex flex-col items-start justify-center min-h-[360px] px-8 py-12 lg:px-16 lg:w-2/3">
          <span className="inline-block px-3 py-1 mb-4 text-xs font-bold tracking-widest text-white uppercase bg-primary rounded">
            Premium Selection
          </span>
          <h1 className="text-4xl lg:text-6xl font-black text-white leading-tight mb-6">
            Step into Style, <br />
            <span className="text-[#60a5fa]">Rent Your Confidence.</span>
          </h1>
          <p className="text-slate-300 text-lg mb-8 max-w-lg leading-relaxed">
            Access the world&apos;s finest footwear for every occasion without the
            commitment. From bespoke Oxfords to limited-edition sneakers.
          </p>
          <div className="flex flex-wrap gap-4">
            <a
              href="#collection"
              className="bg-primary hover:bg-primary/90 text-white font-bold py-3 px-8 rounded-lg transition-all shadow-lg shadow-primary/25"
            >
              Browse Collection
            </a>
            <Link
              to="/how-it-works"
              className="bg-white/10 hover:bg-white/20 text-white backdrop-blur-md font-bold py-3 px-8 rounded-lg border border-white/20 transition-all"
            >
              How it works
            </Link>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 py-2">
        {[
          { t: 'Flexible rental periods', d: 'Pick dates that fit your plans.' },
          { t: 'Curated inventory', d: 'Premium pairs, ready to wear.' },
          { t: 'Simple checkout', d: 'Reserve in a few steps.' },
          { t: 'Walk-in friendly', d: 'In-store pickup available.' },
        ].map((item) => (
          <div
            key={item.t}
            className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 px-4 py-3 shadow-sm"
          >
            <p className="text-sm font-semibold text-slate-900 dark:text-white">{item.t}</p>
            <p className="text-xs text-slate-500 mt-1">{item.d}</p>
          </div>
        ))}
      </div>

      <div id="collection" className="flex flex-col lg:flex-row gap-8 lg:items-start scroll-mt-24">
        <aside className="w-full lg:w-64 shrink-0 space-y-6 lg:sticky lg:top-24">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-primary text-xl leading-none">
                tune
              </span>
              <h3 className="font-bold text-lg text-slate-900 dark:text-white">Filters</h3>
            </div>
            <button
              type="button"
              onClick={clearFilters}
              className="text-xs font-semibold text-primary hover:underline"
            >
              Clear all
            </button>
          </div>

          <form onSubmit={applySearch} className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Search
            </label>
            <input
              value={localSearch}
              onChange={(e) => setLocalSearch(e.target.value)}
              className="w-full h-10 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm focus:ring-2 focus:ring-primary"
              placeholder="Name, brand, category…"
            />
            <button
              type="submit"
              className="w-full py-2 text-sm font-semibold rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
            >
              Apply search
            </button>
          </form>

          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-500 block mb-2">
              Sort
            </label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortOption)}
              className="w-full h-10 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm focus:ring-2 focus:ring-primary"
            >
              <option value="featured">Featured (stock)</option>
              <option value="price-asc">Price: low to high</option>
              <option value="price-desc">Price: high to low</option>
              <option value="name-asc">Name: A–Z</option>
              <option value="name-desc">Name: Z–A</option>
            </select>
          </div>

          <div className="border-t border-slate-200 dark:border-slate-800 pt-4">
            <h4 className="font-semibold mb-3 text-xs uppercase tracking-wider text-slate-500">
              Category
            </h4>
            <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
              {uniqueCategories.length === 0 ? (
                <p className="text-sm text-slate-400">—</p>
              ) : (
                uniqueCategories.map((c) => (
                  <label
                    key={c}
                    className="flex items-center gap-3 cursor-pointer group text-sm"
                  >
                    <input
                      type="checkbox"
                      checked={categories.has(c)}
                      onChange={() => setCategories((prev) => toggleSet(prev, c))}
                      className="rounded border-slate-300 text-primary focus:ring-primary h-4 w-4"
                    />
                    <span className="group-hover:text-primary transition-colors">{c}</span>
                  </label>
                ))
              )}
            </div>
          </div>

          <div className="border-t border-slate-200 dark:border-slate-800 pt-4">
            <h4 className="font-semibold mb-3 text-xs uppercase tracking-wider text-slate-500">
              Brand
            </h4>
            <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
              {uniqueBrands.length === 0 ? (
                <p className="text-sm text-slate-400">—</p>
              ) : (
                uniqueBrands.map((b) => (
                  <label
                    key={b}
                    className="flex items-center gap-3 cursor-pointer group text-sm"
                  >
                    <input
                      type="checkbox"
                      checked={brands.has(b)}
                      onChange={() => setBrands((prev) => toggleSet(prev, b))}
                      className="rounded border-slate-300 text-primary focus:ring-primary h-4 w-4"
                    />
                    <span className="group-hover:text-primary transition-colors">{b}</span>
                  </label>
                ))
              )}
            </div>
          </div>

          <div className="border-t border-slate-200 dark:border-slate-800 pt-4 space-y-2">
            <h4 className="font-semibold text-xs uppercase tracking-wider text-slate-500">
              Price / day ($)
            </h4>
            <p className="text-[11px] text-slate-400">
              Range in catalog: ${priceBounds.min.toFixed(0)} – ${priceBounds.max.toFixed(0)}
            </p>
            <div className="flex gap-2">
              <input
                type="number"
                min={0}
                step={1}
                value={priceMin}
                onChange={(e) => setPriceMin(e.target.value)}
                placeholder="Min"
                className="w-1/2 h-9 px-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm"
              />
              <input
                type="number"
                min={0}
                step={1}
                value={priceMax}
                onChange={(e) => setPriceMax(e.target.value)}
                placeholder="Max"
                className="w-1/2 h-9 px-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm"
              />
            </div>
          </div>
        </aside>

        <div className="flex-1 min-w-0 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
            <p className="text-sm font-medium text-slate-500">
              Showing{' '}
              <span className="text-slate-900 dark:text-white font-semibold">
                {filtered.length === 0 ? 0 : `${showingFrom}–${showingTo}`}
              </span>{' '}
              of <span className="text-slate-900 dark:text-white">{filtered.length}</span>{' '}
              {filtered.length === 1 ? 'pair' : 'pairs'}
            </p>
            {totalPages > 1 && (
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  disabled={safePage <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="px-3 py-1.5 text-sm font-semibold rounded-lg border border-slate-200 dark:border-slate-700 disabled:opacity-40 hover:bg-slate-50 dark:hover:bg-slate-800"
                >
                  Previous
                </button>
                <span className="text-sm text-slate-600 dark:text-slate-400">
                  Page {safePage} / {totalPages}
                </span>
                <button
                  type="button"
                  disabled={safePage >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  className="px-3 py-1.5 text-sm font-semibold rounded-lg border border-slate-200 dark:border-slate-700 disabled:opacity-40 hover:bg-slate-50 dark:hover:bg-slate-800"
                >
                  Next
                </button>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
            {pageSlice.length === 0 ? (
              <div className="col-span-full text-center py-16 text-slate-500 rounded-xl border border-dashed border-slate-200 dark:border-slate-700">
                No shoes match your filters. Try clearing filters or widening the price range.
              </div>
            ) : (
              pageSlice.map((shoe) => <ProductCard key={shoe.shoeId} shoe={shoe} />)
            )}
          </div>

          {totalPages > 1 && (
            <div className="flex justify-center gap-1 pt-4 flex-wrap">
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setPage(n)}
                  className={`min-w-[2.25rem] h-9 px-2 rounded-lg text-sm font-semibold transition-colors ${
                    n === safePage
                      ? 'bg-primary text-white'
                      : 'border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
