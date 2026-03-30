import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { getShoe, type GetShoeResponse, type ShoeVariantDto } from '../lib/shoes.api'
import { createRental, type CreateRentalResponse } from '../lib/rentals.api'
import { getApiErrorMessage } from '../lib/api'
import { ShoeImage } from '../components/ShoeImage'
import { useAuth } from '../auth/AuthContext'

function toDateString(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function addDays(d: Date, days: number): Date {
  const out = new Date(d)
  out.setDate(out.getDate() + days)
  return out
}

export function CheckoutPage() {
  const { user } = useAuth()
  const [searchParams] = useSearchParams()
  const shoeId = searchParams.get('shoeId')

  const [shoe, setShoe] = useState<GetShoeResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [variantId, setVariantId] = useState<string>('')
  const [quantity, setQuantity] = useState(1)

  const today = toDateString(new Date())
  const defaultEnd = addDays(new Date(), 3)
  const [startDate, setStartDate] = useState(today)
  const [endDate, setEndDate] = useState(toDateString(defaultEnd))

  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [createdRental, setCreatedRental] = useState<CreateRentalResponse | null>(null)

  useEffect(() => {
    if (!shoeId) {
      setError('Missing shoe. Please select a shoe from the collection.')
      setLoading(false)
      return
    }
    getShoe(shoeId)
      .then((shoeRes) => {
        setShoe(shoeRes)
        if (shoeRes.variants.length > 0) {
          const first =
            shoeRes.variants.find((v) => v.availableQuantity > 0) ?? shoeRes.variants[0]
          setVariantId(first.variantId)
        }
      })
      .catch((err) => setError(err.message ?? 'Failed to load'))
      .finally(() => setLoading(false))
  }, [shoeId])

  const selectedVariant: ShoeVariantDto | undefined = shoe?.variants.find(
    (v) => v.variantId === variantId,
  )

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!shoe || !variantId || !user?.customerId) return

    setSubmitting(true)
    setSubmitError(null)

    try {
      const res = await createRental({
        customerId: user.customerId,
        items: [{ variantId, quantity }],
        startDate,
        endDate,
      })
      setCreatedRental(res)
    } catch (err: unknown) {
      setSubmitError(getApiErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  if (!user?.customerId) {
    return (
      <div className="max-w-lg mx-auto py-16 px-4 text-center space-y-4">
        <h1 className="text-xl font-bold text-slate-900 dark:text-white">Checkout</h1>
        <p className="text-slate-600 dark:text-slate-400">
          Online rental checkout is available for customer accounts linked to a rental profile.
        </p>
        <p className="text-sm text-slate-500">
          Create an account with <Link to="/signup" className="text-primary font-semibold">Sign up</Link>
          , or if you are staff, use{' '}
          <Link to="/admin/rentals/new" className="text-primary font-semibold">
            Walk-in rental
          </Link>{' '}
          in the admin panel.
        </p>
        <Link to="/shoes" className="inline-block text-primary font-semibold hover:underline">
          ← Back to collection
        </Link>
      </div>
    )
  }

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

  if (createdRental) {
    return (
      <div className="max-w-2xl mx-auto text-center py-12">
        <div className="inline-flex items-center justify-center size-16 rounded-full bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 mb-6">
          <span className="material-symbols-outlined text-4xl">check_circle</span>
        </div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">
          Rental created successfully
        </h1>
        <p className="text-slate-600 dark:text-slate-400 mb-6">
          Rental ID: <strong>{createdRental.rentalId}</strong>
        </p>
        <p className="text-sm text-slate-500 mb-8">
          Total: ${createdRental.totalAmount} · {createdRental.totalItems} item(s)
        </p>
        <div className="flex gap-4 justify-center">
          <Link
            to="/shoes"
            className="bg-primary hover:bg-primary/90 text-white font-bold py-3 px-6 rounded-lg"
          >
            Browse more
          </Link>
          <Link
            to="/"
            className="border border-slate-300 dark:border-slate-600 dark:text-slate-300 font-bold py-3 px-6 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800"
          >
            Home
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto">
      <nav className="mb-8">
        <Link
          to={`/shoes/${shoe.shoeId}`}
          className="text-sm text-slate-500 hover:text-primary transition-colors"
        >
          ← Back to product
        </Link>
      </nav>

      <p className="text-sm text-slate-500 mb-6">
        Renting as <span className="font-semibold text-slate-700 dark:text-slate-300">{user.fullName}</span>{' '}
        ({user.email})
      </p>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
        <div>
          <div className="aspect-square overflow-hidden rounded-xl bg-slate-100 dark:bg-slate-800 relative">
            <ShoeImage
              src={shoe.imageUrlDetail ?? shoe.imageUrlCard}
              alt={shoe.name}
              imgClassName="absolute inset-0 object-cover w-full h-full"
            />
          </div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white mt-4">{shoe.name}</h2>
          <p className="text-slate-600 dark:text-slate-400">{shoe.brand}</p>
          <p className="text-2xl font-bold text-primary mt-2">
            ${shoe.pricePerDay}
            <span className="text-sm font-normal text-slate-500">/day</span>
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-8">
          <div>
            <h3 className="font-bold text-lg mb-4">Rental details</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">
                  Variant
                </label>
                <select
                  value={variantId}
                  onChange={(e) => setVariantId(e.target.value)}
                  className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 focus:ring-2 focus:ring-primary"
                  required
                >
                  {shoe.variants.map((v) => (
                    <option key={v.variantId} value={v.variantId}>
                      EU {v.size} · {v.color} · {v.availableQuantity} available
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">
                  Quantity
                </label>
                <input
                  type="number"
                  min={1}
                  max={selectedVariant?.availableQuantity ?? 1}
                  value={quantity}
                  onChange={(e) => setQuantity(Number(e.target.value) || 1)}
                  className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 focus:ring-2 focus:ring-primary"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">
                    Start date
                  </label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    min={today}
                    className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 focus:ring-2 focus:ring-primary"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">
                    End date
                  </label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    min={startDate}
                    className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 focus:ring-2 focus:ring-primary"
                    required
                  />
                </div>
              </div>
            </div>
          </div>

          {submitError && (
            <div className="p-4 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm">
              {submitError}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3 bg-primary hover:bg-primary/90 disabled:opacity-50 text-white font-bold rounded-lg transition-opacity flex items-center justify-center"
          >
            {submitting ? 'Creating...' : 'Confirm rental'}
          </button>
        </form>
      </div>
    </div>
  )
}
