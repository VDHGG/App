import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { getShoe, type GetShoeResponse, type ShoeVariantDto } from '../lib/shoes.api'
import { createRental, type CreateRentalResponse } from '../lib/rentals.api'
import { createMomoPayment } from '../lib/payments.api'
import { getApiErrorMessage } from '../lib/api'
import { ShoeImage } from '../components/ShoeImage'
import { useAuth } from '../auth/AuthContext'
import { useRentalCart } from '../cart/RentalCartContext'

function toDateString(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function addDays(d: Date, days: number): Date {
  const out = new Date(d)
  out.setDate(out.getDate() + days)
  return out
}

function inclusiveRentalDays(start: string, end: string): number {
  const s = new Date(`${start}T12:00:00`)
  const e = new Date(`${end}T12:00:00`)
  const diff = Math.round((e.getTime() - s.getTime()) / 86400000)
  return Math.max(1, diff + 1)
}

type PaymentChoice = 'cod' | 'momo' | 'zalo'

export function CheckoutPage() {
  const { user } = useAuth()
  const {
    lines: cartLines,
    setLineQuantity,
    removeLine,
    clearCart,
    isCustomer: cartCustomer,
  } = useRentalCart()

  const [searchParams] = useSearchParams()
  const shoeIdParam = searchParams.get('shoeId')
  const variantIdParam = searchParams.get('variantId')
  const quantityParam = searchParams.get('quantity')

  const [quickShoe, setQuickShoe] = useState<GetShoeResponse | null>(null)
  const [quickLoading, setQuickLoading] = useState(false)
  const [quickError, setQuickError] = useState<string | null>(null)
  const [quickVariantId, setQuickVariantId] = useState('')
  const [quickQty, setQuickQty] = useState(1)

  const today = toDateString(new Date())
  const defaultEnd = addDays(new Date(), 3)
  const [startDate, setStartDate] = useState(today)
  const [endDate, setEndDate] = useState(toDateString(defaultEnd))

  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [createdRental, setCreatedRental] = useState<CreateRentalResponse | null>(null)
  const [paymentMethod, setPaymentMethod] = useState<PaymentChoice | null>(null)
  const [cartImageByShoeId, setCartImageByShoeId] = useState<Record<string, string>>({})

  const useCartMode = cartLines.length > 0
  const useQuickMode = !useCartMode && Boolean(shoeIdParam) && cartCustomer

  const shoeIdsNeedingImage = useMemo(() => {
    if (!useCartMode) return [] as string[]
    const ids = new Set<string>()
    for (const l of cartLines) {
      if (!l.imageUrlCard) ids.add(l.shoeId)
    }
    return [...ids].sort()
  }, [useCartMode, cartLines])

  useEffect(() => {
    if (shoeIdsNeedingImage.length === 0) return
    let cancelled = false
    void Promise.all(
      shoeIdsNeedingImage.map((id) =>
        getShoe(id).then(
          (s) => [id, s.imageUrlCard] as const,
          () => [id, ''] as const
        )
      )
    ).then((pairs) => {
      if (cancelled) return
      setCartImageByShoeId((prev) => {
        const next = { ...prev }
        for (const [id, url] of pairs) {
          if (url) next[id] = url
        }
        return next
      })
    })
    return () => {
      cancelled = true
    }
  }, [shoeIdsNeedingImage.join('|')])

  useEffect(() => {
    if (!useQuickMode || !shoeIdParam) {
      setQuickShoe(null)
      setQuickError(null)
      return
    }
    setQuickLoading(true)
    setQuickError(null)
    getShoe(shoeIdParam)
      .then((shoeRes) => {
        setQuickShoe(shoeRes)
        const fromQuery =
          variantIdParam && shoeRes.variants.some((v) => v.variantId === variantIdParam)
            ? variantIdParam
            : undefined
        const first =
          fromQuery ??
          shoeRes.variants.find((v) => v.availableQuantity > 0)?.variantId ??
          shoeRes.variants[0]?.variantId ??
          ''
        setQuickVariantId(first)
        const q = Number(quantityParam)
        setQuickQty(Number.isFinite(q) && q >= 1 ? Math.floor(q) : 1)
      })
      .catch((err) => setQuickError(err.message ?? 'Failed to load shoe'))
      .finally(() => setQuickLoading(false))
  }, [useQuickMode, shoeIdParam, variantIdParam, quantityParam])

  const quickVariant: ShoeVariantDto | undefined = quickShoe?.variants.find(
    (v) => v.variantId === quickVariantId
  )

  useEffect(() => {
    if (!quickVariant) return
    setQuickQty((q) => Math.min(Math.max(1, q), quickVariant.availableQuantity))
  }, [quickVariantId, quickVariant])

  const rentalDays = inclusiveRentalDays(startDate, endDate)

  const estimatedTotal = useMemo(() => {
    if (useCartMode) {
      return cartLines.reduce(
        (sum, l) => sum + l.pricePerDay * l.quantity * rentalDays,
        0
      )
    }
    if (useQuickMode && quickVariant) {
      const q = Math.min(quickQty, quickVariant.availableQuantity)
      return quickShoe!.pricePerDay * q * rentalDays
    }
    return 0
  }, [
    useCartMode,
    useQuickMode,
    cartLines,
    quickVariant,
    quickShoe,
    quickQty,
    rentalDays,
  ])

  const submitItems = (): { variantId: string; quantity: number }[] => {
    if (useCartMode) {
      return cartLines.map((l) => ({ variantId: l.variantId, quantity: l.quantity }))
    }
    if (useQuickMode && quickVariantId && quickShoe) {
      const v = quickShoe.variants.find((x) => x.variantId === quickVariantId)
      if (!v || v.availableQuantity < 1) return []
      const q = Math.min(Math.max(1, quickQty), v.availableQuantity)
      return [{ variantId: quickVariantId, quantity: q }]
    }
    return []
  }

  const canConfirm = paymentMethod === 'cod' || paymentMethod === 'momo'

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user?.customerId) return
    if (!canConfirm) return

    const items = submitItems()
    if (items.length === 0) {
      setSubmitError('Add at least one item to your rental.')
      return
    }

    setSubmitting(true)
    setSubmitError(null)

    try {
      const res = await createRental({
        customerId: user.customerId,
        items,
        startDate,
        endDate,
      })
      if (useCartMode) clearCart()

      if (paymentMethod === 'cod') {
        setCreatedRental(res)
        return
      }

      if (paymentMethod === 'momo') {
        try {
          const pay = await createMomoPayment({ rentalId: res.rentalId })
          if (!pay.skipped && pay.payUrl) {
            window.location.assign(pay.payUrl)
            return
          }
        } catch (payErr: unknown) {
          setSubmitError(
            `Rental ${res.rentalId} was created, but MoMo checkout could not start (${getApiErrorMessage(payErr)}). You can review it under My rentals.`
          )
          setCreatedRental(res)
          return
        }
        setCreatedRental(res)
        return
      }
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
          Create an account with{' '}
          <Link to="/signup" className="text-primary font-semibold">
            Sign up
          </Link>
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

  if (createdRental) {
    return (
      <div className="max-w-xl mx-auto px-4 py-12">
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 shadow-lg p-8 text-center">
          <div className="inline-flex items-center justify-center size-16 rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 mb-6">
            <span className="material-symbols-outlined text-4xl">check_circle</span>
          </div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white mb-2 tracking-tight">
            Rental confirmed
          </h1>
          <p className="text-slate-600 dark:text-slate-400 mb-2">
            Rental ID:{' '}
            <span className="font-mono font-semibold text-slate-900 dark:text-white">
              {createdRental.rentalId}
            </span>
          </p>
          <p className="text-sm text-slate-500 mb-8">
            Total: ${createdRental.totalAmount.toFixed(2)} · {createdRental.totalItems} item(s)
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              to="/"
              className="inline-flex justify-center items-center py-3.5 px-6 rounded-xl bg-primary text-white font-bold hover:opacity-95 transition-opacity"
            >
              Back to home
            </Link>
            <Link
              to="/shoes"
              className="inline-flex justify-center items-center py-3.5 px-6 rounded-xl border border-slate-300 dark:border-slate-600 font-bold text-slate-800 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
            >
              Browse more
            </Link>
            <Link
              to="/account"
              className="inline-flex justify-center items-center py-3.5 px-6 rounded-xl border border-slate-300 dark:border-slate-600 font-bold text-slate-800 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
            >
              My rentals
            </Link>
          </div>
        </div>
      </div>
    )
  }

  if (useQuickMode && quickLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-slate-500">Loading...</div>
      </div>
    )
  }

  if (useQuickMode && (quickError || !quickShoe)) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <p className="text-red-600">{quickError ?? 'Shoe not found'}</p>
        <Link to="/shoes" className="text-primary hover:underline">
          Back to collection
        </Link>
      </div>
    )
  }

  if (!useCartMode && !useQuickMode) {
    return (
      <div className="max-w-lg mx-auto py-16 px-4 text-center space-y-4">
        <h1 className="text-xl font-bold text-slate-900 dark:text-white">Checkout</h1>
        <p className="text-slate-600 dark:text-slate-400">
          Your rental cart is empty. Add shoes from the product page, or open a product from your
          wishlist.
        </p>
        <Link
          to="/shoes"
          className="inline-block font-semibold text-primary hover:underline"
        >
          Browse collection
        </Link>
      </div>
    )
  }

  const firstShoeId = useCartMode ? cartLines[0]?.shoeId : quickShoe?.shoeId

  function cartLineImageUrl(line: (typeof cartLines)[0]): string | undefined {
    return line.imageUrlCard ?? cartImageByShoeId[line.shoeId] ?? undefined
  }

  return (
    <div className="max-w-6xl mx-auto px-4 pb-16 pt-2">
      <nav className="mb-6 flex flex-wrap gap-4 justify-between items-center">
        {firstShoeId && (
          <Link
            to={`/shoes/${firstShoeId}`}
            className="text-sm font-semibold text-slate-500 hover:text-primary transition-colors inline-flex items-center gap-1"
          >
            <span className="material-symbols-outlined text-lg">arrow_back</span>
            Back to product
          </Link>
        )}
        <Link
          to="/shoes"
          className="text-sm font-semibold text-primary hover:underline ml-auto"
        >
          Continue shopping
        </Link>
      </nav>

      <div className="mb-8">
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary mb-1">
          Checkout
        </p>
        <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
          Complete your rental
        </h1>
        <p className="text-sm text-slate-500 mt-2 max-w-2xl">
          Renting as{' '}
          <span className="font-semibold text-slate-700 dark:text-slate-300">{user.fullName}</span> ·{' '}
          {user.email}. Stock is checked when you confirm.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-3 gap-8 lg:gap-10">
        <div className="lg:col-span-2 space-y-6">
          <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/40 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/80">
              <h2 className="text-sm font-black uppercase tracking-wider text-slate-800 dark:text-slate-200">
                Items
              </h2>
            </div>
            <div className="divide-y divide-slate-200 dark:divide-slate-800">
              {useCartMode &&
                cartLines.map((line) => (
                  <div
                    key={line.variantId}
                    className="p-4 sm:p-5 flex flex-col sm:flex-row gap-4 sm:gap-5"
                  >
                    <div className="w-full sm:w-28 shrink-0 aspect-square rounded-xl overflow-hidden bg-slate-100 dark:bg-slate-800 ring-1 ring-slate-200/80 dark:ring-slate-700">
                      <ShoeImage
                        src={cartLineImageUrl(line)}
                        alt={line.shoeName}
                        imgClassName="w-full h-full object-cover"
                      />
                    </div>
                    <div className="flex-1 min-w-0 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                      <div>
                        <p className="font-bold text-slate-900 dark:text-white leading-snug">
                          {line.shoeName}
                        </p>
                        <p className="text-sm text-slate-500 mt-1">
                          {line.brand} · EU {line.size} · {line.color}
                        </p>
                        <p className="text-sm font-semibold text-primary mt-2">
                          ${line.pricePerDay}/day × {line.quantity} pair(s)
                        </p>
                      </div>
                      <div className="flex items-center gap-3 flex-wrap sm:flex-col sm:items-end">
                        <label className="text-sm text-slate-600 flex items-center gap-2">
                          Qty
                          <input
                            type="number"
                            min={1}
                            max={line.availableQuantity}
                            value={line.quantity}
                            onChange={(e) =>
                              setLineQuantity(line.variantId, Number(e.target.value) || 1)
                            }
                            className="w-20 px-2 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm"
                          />
                        </label>
                        <span className="text-xs text-slate-400">max {line.availableQuantity}</span>
                        <button
                          type="button"
                          onClick={() => removeLine(line.variantId)}
                          className="text-sm font-semibold text-rose-600 hover:underline"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  </div>
                ))}

              {useQuickMode && quickShoe && quickVariant && (
                <div className="p-4 sm:p-5 flex flex-col sm:flex-row gap-5">
                  <div className="w-full sm:w-32 shrink-0 aspect-square rounded-xl overflow-hidden bg-slate-100 dark:bg-slate-800 ring-1 ring-slate-200/80 dark:ring-slate-700">
                    <ShoeImage
                      src={quickShoe.imageUrlCard}
                      alt={quickShoe.name}
                      imgClassName="w-full h-full object-cover"
                    />
                  </div>
                  <div className="flex-1 space-y-4">
                    <p className="font-bold text-lg text-slate-900 dark:text-white">{quickShoe.name}</p>
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                        Variant
                      </label>
                      <select
                        value={quickVariantId}
                        onChange={(e) => setQuickVariantId(e.target.value)}
                        className="w-full max-w-md px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm"
                      >
                        {quickShoe.variants.map((v) => (
                          <option key={v.variantId} value={v.variantId}>
                            EU {v.size} · {v.color} · {v.availableQuantity} available
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                        Quantity
                      </label>
                      <input
                        type="number"
                        min={1}
                        max={quickVariant.availableQuantity}
                        value={quickQty}
                        onChange={(e) => setQuickQty(Number(e.target.value) || 1)}
                        className="w-full max-w-xs px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/40 shadow-sm p-5 sm:p-6">
            <h2 className="text-sm font-black uppercase tracking-wider text-slate-800 dark:text-slate-200 mb-4">
              Rental period
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                  Start date
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  min={today}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                  End date
                </label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  min={startDate}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm"
                  required
                />
              </div>
            </div>
          </section>
        </div>

        <div className="lg:col-span-1">
          <div className="lg:sticky lg:top-24 space-y-5">
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-gradient-to-b from-slate-50 to-white dark:from-slate-900/90 dark:to-slate-950 shadow-sm p-5 sm:p-6">
              <h2 className="text-sm font-black uppercase tracking-wider text-slate-800 dark:text-slate-200 mb-4">
                Summary
              </h2>
              <div className="flex justify-between text-sm text-slate-600 dark:text-slate-400 mb-2">
                <span>Duration (inclusive)</span>
                <span className="font-semibold text-slate-900 dark:text-white">{rentalDays} days</span>
              </div>
              <div className="border-t border-slate-200 dark:border-slate-800 pt-4 mt-4">
                <div className="flex justify-between items-baseline gap-2">
                  <span className="text-sm font-medium text-slate-600 dark:text-slate-400">
                    Estimated total
                  </span>
                  <span className="text-2xl font-black text-primary">${estimatedTotal.toFixed(2)}</span>
                </div>
                <p className="text-xs text-slate-500 mt-2">
                  Final amount is set on the server when you confirm.
                </p>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/40 shadow-sm p-5 sm:p-6">
              <h2 className="text-sm font-black uppercase tracking-wider text-slate-800 dark:text-slate-200 mb-1">
                Payment method
              </h2>
              <p className="text-xs text-slate-500 mb-4">Choose one option to enable confirmation.</p>
              <div className="space-y-3">
                <button
                  type="button"
                  onClick={() => setPaymentMethod('cod')}
                  className={`w-full text-left rounded-xl border-2 px-4 py-3 transition-all flex items-start gap-3 ${
                    paymentMethod === 'cod'
                      ? 'border-primary bg-primary/5 dark:bg-primary/10'
                      : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
                  }`}
                >
                  <span
                    className={`mt-0.5 material-symbols-outlined text-xl ${
                      paymentMethod === 'cod' ? 'text-primary' : 'text-slate-400'
                    }`}
                  >
                    payments
                  </span>
                  <span>
                    <span className="font-bold text-slate-900 dark:text-white block">
                      Pay on pickup
                    </span>
                    <span className="text-xs text-slate-500">Thanh toán khi nhận hàng</span>
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentMethod('momo')}
                  className={`w-full text-left rounded-xl border-2 px-4 py-3 transition-all flex items-start gap-3 ${
                    paymentMethod === 'momo'
                      ? 'border-primary bg-primary/5 dark:bg-primary/10'
                      : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
                  }`}
                >
                  <span
                    className={`mt-0.5 material-symbols-outlined text-xl ${
                      paymentMethod === 'momo' ? 'text-primary' : 'text-slate-400'
                    }`}
                  >
                    account_balance_wallet
                  </span>
                  <span>
                    <span className="font-bold text-slate-900 dark:text-white block">MoMo</span>
                    <span className="text-xs text-slate-500">Redirect to MoMo to pay</span>
                  </span>
                </button>
                <div
                  className="w-full rounded-xl border-2 border-dashed border-slate-200 dark:border-slate-700 px-4 py-3 flex items-start gap-3 opacity-60 cursor-not-allowed"
                  title="Coming soon"
                >
                  <span className="mt-0.5 material-symbols-outlined text-xl text-slate-400">chat</span>
                  <span>
                    <span className="font-bold text-slate-700 dark:text-slate-300 block">Zalo Pay</span>
                    <span className="text-xs text-slate-500">Coming soon</span>
                  </span>
                </div>
              </div>
            </div>

            {submitError && (
              <div className="p-4 rounded-xl bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm border border-red-200 dark:border-red-900/40">
                {submitError}
              </div>
            )}

            {canConfirm ? (
              <button
                type="submit"
                disabled={submitting}
                className="w-full py-4 rounded-xl bg-primary hover:bg-primary/90 disabled:opacity-50 text-white font-black text-sm uppercase tracking-widest shadow-lg transition-opacity"
              >
                {submitting ? 'Processing…' : 'Confirm rental'}
              </button>
            ) : (
              <p className="text-center text-xs text-slate-500 py-3 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700">
                Select a payment method above to continue.
              </p>
            )}
          </div>
        </div>
      </form>
    </div>
  )
}
