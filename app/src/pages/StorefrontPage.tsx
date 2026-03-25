import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { listShoes, type ShoeSummary } from '../lib/shoes.api'
import { ProductCard } from '../components/ProductCard'

export function StorefrontPage() {
  const [shoes, setShoes] = useState<ShoeSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    listShoes()
      .then((res) => setShoes(res.shoes.filter((s) => s.isActive)))
      .catch((err) => setError(err.message ?? 'Failed to load shoes'))
      .finally(() => setLoading(false))
  }, [])

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
      <section className="relative overflow-hidden rounded-2xl bg-slate-900 mb-12">
        <div
          className="absolute inset-0 opacity-50 bg-cover bg-center"
          style={{
            backgroundImage: `url('https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=1200')`,
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-r from-slate-900 via-slate-900/60 to-transparent" />
        <div className="relative z-10 flex flex-col items-start justify-center min-h-[400px] px-8 py-12 lg:px-16 lg:w-2/3">
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
          <div className="flex gap-4">
            <Link
              to="/shoes"
              className="bg-primary hover:bg-primary/90 text-white font-bold py-3 px-8 rounded-lg transition-all shadow-lg shadow-primary/25"
            >
              Browse Collection
            </Link>
          </div>
        </div>
      </section>

      <div className="flex items-center justify-between mb-8 pb-4 border-b border-slate-200 dark:border-slate-800">
        <p className="text-sm font-medium text-slate-500">
          Showing <span className="text-slate-900 dark:text-white">{shoes.length}</span>{' '}
          results
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
        {shoes.length === 0 ? (
          <div className="col-span-full text-center py-12 text-slate-500">
            No shoes available yet. Add some via the API or admin.
          </div>
        ) : (
          shoes.map((shoe) => <ProductCard key={shoe.shoeId} shoe={shoe} />)
        )}
      </div>
    </div>
  )
}
