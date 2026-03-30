import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { getShoe, type GetShoeResponse } from '../lib/shoes.api'
import { ShoeImage } from '../components/ShoeImage'

export function ProductDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [shoe, setShoe] = useState<GetShoeResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    getShoe(id)
      .then(setShoe)
      .catch((err) => setError(err.message ?? 'Failed to load shoe'))
      .finally(() => setLoading(false))
  }, [id])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-slate-500">Loading...</div>
      </div>
    )
  }

  if (error || !shoe) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <p className="text-red-600">{error ?? 'Shoe not found'}</p>
        <Link to="/shoes" className="text-primary hover:underline">
          Back to collection
        </Link>
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto">
      <nav className="mb-8">
        <Link
          to="/shoes"
          className="text-sm text-slate-500 hover:text-primary transition-colors"
        >
          ← Back to collection
        </Link>
      </nav>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
        <div className="aspect-square overflow-hidden rounded-xl bg-slate-100 dark:bg-slate-800 relative">
          <ShoeImage
            src={shoe.imageUrlDetail ?? shoe.imageUrlCard}
            alt={shoe.name}
            imgClassName="absolute inset-0 object-cover w-full h-full"
          />
        </div>
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-primary">
            {shoe.category}
          </span>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white mt-2">
            {shoe.name}
          </h1>
          <p className="text-slate-600 dark:text-slate-400 mt-1">{shoe.brand}</p>
          <p className="text-2xl font-bold text-primary mt-6">
            ${shoe.pricePerDay}
            <span className="text-sm font-normal text-slate-500">/day</span>
          </p>
          {shoe.description && (
            <p className="mt-6 text-slate-600 dark:text-slate-400">
              {shoe.description}
            </p>
          )}
          {shoe.variants.length > 0 && (
            <div className="mt-8">
              <h3 className="font-semibold mb-3">Available sizes</h3>
              <div className="flex flex-wrap gap-2">
                {shoe.variants.map((v) => (
                  <span
                    key={v.variantId}
                    className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-sm"
                  >
                    EU {v.size} · {v.color} · {v.availableQuantity} available
                  </span>
                ))}
              </div>
            </div>
          )}
          <Link
            to={`/checkout?shoeId=${shoe.shoeId}`}
            className="mt-8 w-full py-3 bg-primary hover:bg-primary/90 text-white font-bold rounded-lg transition-opacity flex items-center justify-center"
          >
            Rent Now
          </Link>
        </div>
      </div>
    </div>
  )
}
