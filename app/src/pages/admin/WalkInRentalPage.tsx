import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { listShoes, getShoe, type GetShoeResponse, type ShoeVariantDto } from '../../lib/shoes.api'
import {
  listCustomers,
  registerCustomer,
  type CustomerSummary,
  type RegisterCustomerRequest,
} from '../../lib/customers.api'
import { createRental, type CreateRentalResponse } from '../../lib/rentals.api'
import { AdminHeader } from '../../components/admin/AdminHeader'
import { formatCurrency } from '../../lib/format'
import { getApiErrorMessage } from '../../lib/api'

type CustomerMode = 'new' | 'existing'

type LineItem = {
  key: string
  shoeId: string
  shoeName: string
  variantId: string
  size: number
  color: string
  pricePerDay: number
  quantity: number
  maxQty: number
}

function toDateString(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function addDays(d: Date, days: number): Date {
  const out = new Date(d)
  out.setDate(out.getDate() + days)
  return out
}

function lineKey() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

export function WalkInRentalPage() {
  const navigate = useNavigate()

  const [shoeSummaries, setShoeSummaries] = useState<
    { shoeId: string; name: string; brand: string; pricePerDay: number }[]
  >([])
  const [customers, setCustomers] = useState<CustomerSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  const [customerMode, setCustomerMode] = useState<CustomerMode>('existing')
  const [selectedCustomerId, setSelectedCustomerId] = useState('')
  const [newCustomer, setNewCustomer] = useState<RegisterCustomerRequest>({
    fullName: '',
    email: '',
    rank: 'BRONZE',
  })

  const [pickShoeId, setPickShoeId] = useState('')
  const [detail, setDetail] = useState<GetShoeResponse | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [variantId, setVariantId] = useState('')
  const [lineQty, setLineQty] = useState(1)

  const [lines, setLines] = useState<LineItem[]>([])

  const today = toDateString(new Date())
  const defaultEnd = addDays(new Date(), 3)
  const [startDate, setStartDate] = useState(today)
  const [endDate, setEndDate] = useState(toDateString(defaultEnd))

  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [created, setCreated] = useState<CreateRentalResponse | null>(null)

  useEffect(() => {
    Promise.all([listShoes(), listCustomers()])
      .then(([shoesRes, customersRes]) => {
        const active = shoesRes.shoes.filter((s) => s.isActive)
        setShoeSummaries(
          active.map((s) => ({
            shoeId: s.shoeId,
            name: s.name,
            brand: s.brand,
            pricePerDay: s.pricePerDay,
          }))
        )
        setCustomers(customersRes.customers)
      })
      .catch((err) => setLoadError(getApiErrorMessage(err)))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (!pickShoeId) {
      setDetail(null)
      setVariantId('')
      return
    }
    setDetailLoading(true)
    getShoe(pickShoeId)
      .then((s) => {
        setDetail(s)
        if (s.variants.length > 0) {
          const first = s.variants.find((v) => v.availableQuantity > 0) ?? s.variants[0]
          setVariantId(first.variantId)
        } else setVariantId('')
      })
      .catch(() => setDetail(null))
      .finally(() => setDetailLoading(false))
  }, [pickShoeId])

  const selectedVariant: ShoeVariantDto | undefined = detail?.variants.find(
    (v) => v.variantId === variantId
  )

  const addLine = () => {
    if (!detail || !selectedVariant) return
    const maxQty = selectedVariant.availableQuantity
    if (maxQty <= 0) {
      setSubmitError('This variant has no available units.')
      return
    }
    const q = Math.min(Math.max(1, Math.floor(lineQty)), maxQty)
    setLines((prev) => [
      ...prev,
      {
        key: lineKey(),
        shoeId: detail.shoeId,
        shoeName: detail.name,
        variantId: selectedVariant.variantId,
        size: selectedVariant.size,
        color: selectedVariant.color,
        pricePerDay: detail.pricePerDay,
        quantity: q,
        maxQty,
      },
    ])
    setSubmitError(null)
  }

  const removeLine = (key: string) => setLines((prev) => prev.filter((l) => l.key !== key))

  const mergeItemsForApi = () => {
    const map = new Map<string, number>()
    for (const l of lines) {
      map.set(l.variantId, (map.get(l.variantId) ?? 0) + l.quantity)
    }
    return Array.from(map.entries()).map(([variantId, quantity]) => ({ variantId, quantity }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitError(null)
    const items = mergeItemsForApi()
    if (items.length === 0) {
      setSubmitError('Add at least one line item.')
      return
    }

    setSubmitting(true)
    try {
      let customerId: string
      if (customerMode === 'new') {
        const { fullName, email, rank } = newCustomer
        if (!fullName.trim() || !email.trim()) {
          setSubmitError('Enter customer full name and email.')
          setSubmitting(false)
          return
        }
        const res = await registerCustomer({
          fullName: fullName.trim(),
          email: email.trim(),
          rank,
        })
        customerId = res.customerId
      } else {
        if (!selectedCustomerId) {
          setSubmitError('Select a customer.')
          setSubmitting(false)
          return
        }
        customerId = selectedCustomerId
      }

      const res = await createRental({
        customerId,
        items,
        startDate,
        endDate,
      })
      setCreated(res)
    } catch (err: unknown) {
      setSubmitError(getApiErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <>
        <AdminHeader title="Walk-in rental" />
        <div className="p-8 flex items-center justify-center min-h-[400px]">
          <div className="text-slate-500">Loading...</div>
        </div>
      </>
    )
  }

  if (loadError) {
    return (
      <>
        <AdminHeader title="Walk-in rental" />
        <div className="p-8 text-red-600">{loadError}</div>
      </>
    )
  }

  if (created) {
    return (
      <>
        <AdminHeader title="Walk-in rental" />
        <div className="p-6 lg:p-8 max-w-lg space-y-4">
          <div className="p-6 rounded-xl border border-emerald-200 bg-emerald-50 dark:bg-emerald-900/20 dark:border-emerald-800">
            <h3 className="font-bold text-lg text-emerald-900 dark:text-emerald-100 mb-2">
              Rental created
            </h3>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              ID: <code className="font-mono">{created.rentalId}</code> — Status: {created.status}
            </p>
            <p className="text-sm mt-2">
              Total: <strong>{formatCurrency(created.totalAmount)}</strong>
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => navigate(`/admin/rentals/${created.rentalId}`)}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white"
            >
              Open rental
            </button>
            <button
              type="button"
              onClick={() => {
                setCreated(null)
                setLines([])
                setPickShoeId('')
              }}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold"
            >
              New order
            </button>
            <Link to="/admin/rentals" className="rounded-lg px-4 py-2 text-sm font-semibold text-primary">
              All rentals
            </Link>
          </div>
        </div>
      </>
    )
  }

  return (
    <>
      <AdminHeader title="Walk-in rental" />
      <div className="p-6 lg:p-8 max-w-[1100px] space-y-8">
        <nav className="flex items-center gap-2 text-sm text-slate-500">
          <Link to="/admin" className="hover:text-primary">
            Dashboard
          </Link>
          <span className="material-symbols-outlined text-xs">chevron_right</span>
          <span className="text-slate-900 dark:text-white font-medium">New rental (walk-in)</span>
        </nav>
        <div>
          <h1 className="text-2xl font-bold">Walk-in order entry</h1>
          <p className="text-slate-500 mt-1">
            Register or select a customer, add items from inventory, then set rental dates.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-5 space-y-6">
            <section className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm">
              <h3 className="font-bold flex items-center gap-2 mb-4">
                <span className="material-symbols-outlined text-primary">person</span>
                Customer
              </h3>
              <div className="flex gap-4 mb-4">
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="radio"
                    name="cmode"
                    checked={customerMode === 'existing'}
                    onChange={() => setCustomerMode('existing')}
                  />
                  Existing
                </label>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="radio"
                    name="cmode"
                    checked={customerMode === 'new'}
                    onChange={() => setCustomerMode('new')}
                  />
                  New walk-in
                </label>
              </div>

              {customerMode === 'existing' ? (
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
                    Customer
                  </label>
                  <select
                    value={selectedCustomerId}
                    onChange={(e) => setSelectedCustomerId(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm"
                  >
                    <option value="">— Select —</option>
                    {customers.map((c) => (
                      <option key={c.customerId} value={c.customerId}>
                        {c.fullName} ({c.email})
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
                      Full name
                    </label>
                    <input
                      value={newCustomer.fullName}
                      onChange={(e) => setNewCustomer((p) => ({ ...p, fullName: e.target.value }))}
                      className="w-full rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
                      Email
                    </label>
                    <input
                      type="email"
                      value={newCustomer.email}
                      onChange={(e) => setNewCustomer((p) => ({ ...p, email: e.target.value }))}
                      className="w-full rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
                      Rank
                    </label>
                    <select
                      value={newCustomer.rank}
                      onChange={(e) =>
                        setNewCustomer((p) => ({
                          ...p,
                          rank: e.target.value as RegisterCustomerRequest['rank'],
                        }))
                      }
                      className="w-full rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2 text-sm"
                    >
                      <option value="BRONZE">Bronze</option>
                      <option value="SILVER">Silver</option>
                      <option value="GOLD">Gold</option>
                      <option value="DIAMOND">Diamond</option>
                    </select>
                  </div>
                </div>
              )}
            </section>

            <section className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm">
              <h3 className="font-bold flex items-center gap-2 mb-4">
                <span className="material-symbols-outlined text-primary">calendar_today</span>
                Rental period
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
                    Start
                  </label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">End</label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2 text-sm"
                  />
                </div>
              </div>
            </section>
          </div>

          <div className="lg:col-span-7 space-y-6">
            <section className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm">
              <h3 className="font-bold flex items-center gap-2 mb-4">
                <span className="material-symbols-outlined text-primary">inventory_2</span>
                Add products
              </h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Shoe</label>
                  <select
                    value={pickShoeId}
                    onChange={(e) => setPickShoeId(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2 text-sm"
                  >
                    <option value="">— Choose shoe —</option>
                    {shoeSummaries.map((s) => (
                      <option key={s.shoeId} value={s.shoeId}>
                        {s.name} — {s.brand} ({formatCurrency(s.pricePerDay)}/day)
                      </option>
                    ))}
                  </select>
                </div>

                {detailLoading && <p className="text-sm text-slate-500">Loading variants…</p>}

                {detail && !detailLoading && (
                  <>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
                      <div className="sm:col-span-2">
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
                          Variant (size / color)
                        </label>
                        <select
                          value={variantId}
                          onChange={(e) => setVariantId(e.target.value)}
                          className="w-full rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2 text-sm"
                        >
                          {detail.variants.map((v) => (
                            <option key={v.variantId} value={v.variantId}>
                              Size {v.size} · {v.color} — available {v.availableQuantity}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
                          Qty
                        </label>
                        <input
                          type="number"
                          min={1}
                          max={selectedVariant?.availableQuantity ?? 1}
                          value={lineQty}
                          onChange={(e) => setLineQty(Number(e.target.value))}
                          className="w-full rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2 text-sm"
                        />
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={addLine}
                      className="w-full sm:w-auto rounded-lg bg-slate-900 dark:bg-slate-100 dark:text-slate-900 text-white px-4 py-2 text-sm font-semibold"
                    >
                      Add to order
                    </button>
                  </>
                )}
              </div>
            </section>

            <section className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm">
              <h3 className="font-bold mb-4">Line items</h3>
              {lines.length === 0 ? (
                <p className="text-sm text-slate-500">No items yet.</p>
              ) : (
                <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                  {lines.map((l) => (
                    <li key={l.key} className="py-3 flex justify-between gap-4 items-start">
                      <div>
                        <div className="font-semibold">{l.shoeName}</div>
                        <div className="text-sm text-slate-500">
                          Size {l.size} · {l.color} × {l.quantity}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeLine(l.key)}
                        className="text-red-600 p-1 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                      >
                        <span className="material-symbols-outlined">delete</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {submitError && (
              <div className="p-4 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-600 text-sm">
                {submitError}
              </div>
            )}

            <div className="flex flex-wrap gap-3">
              <button
                type="submit"
                disabled={submitting}
                className="rounded-lg bg-primary px-6 py-3 text-sm font-bold text-white hover:bg-primary/90 disabled:opacity-50"
              >
                {submitting ? 'Creating…' : 'Create rental'}
              </button>
              <Link
                to="/admin/rentals"
                className="rounded-lg border border-slate-300 dark:border-slate-600 px-6 py-3 text-sm font-semibold"
              >
                Cancel
              </Link>
            </div>
          </div>
        </form>
      </div>
    </>
  )
}
