import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {  getRental,  activateRental,  returnRental,  cancelRental} from '../../lib/rentals.api'
import { getCustomer } from '../../lib/customers.api'
import { AdminHeader } from '../../components/admin/AdminHeader'
import { RentalStatusBadge } from '../../components/admin/RentalStatusBadge'
import { formatDate, formatCurrency } from '../../lib/format'
import { getApiErrorMessage } from '../../lib/api'

function confirmRentalAction(action: 'activate' | 'return' | 'cancel'): boolean {
  const msg =
    action === 'activate'
      ? 'Activate this rental? The reservation will become active.'
      : action === 'return'
        ? 'Mark this rental as returned?'
        : 'Cancel this reservation? This cannot be undone.'
  return window.confirm(msg)
}

export function RentalDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [rental, setRental] = useState<Awaited<ReturnType<typeof getRental>> | null>(null)
  const [customerName, setCustomerName] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    getRental(id)
      .then(async (r) => {
        setRental(r)
        try {
          const c = await getCustomer(r.customerId)
          setCustomerName(c.fullName)
        } catch {
          setCustomerName(r.customerId)
        }
      })
      .catch((err) => setError(err.message ?? 'Failed to load'))
      .finally(() => setLoading(false))
  }, [id])

  const handleAction = async (action: 'activate' | 'return' | 'cancel') => {
    if (!id) return
    if (!confirmRentalAction(action)) return
    setActionLoading(action)
    setActionError(null)
    try {
      if (action === 'activate') await activateRental(id)
      else if (action === 'return') await returnRental(id)
      else await cancelRental(id)
      const r = await getRental(id)
      setRental(r)
    } catch (err: unknown) {
      setActionError(getApiErrorMessage(err))
    } finally {
      setActionLoading(null)
    }
  }

  if (loading) {
    return (
      <>
        <AdminHeader title="Rental Details" />
        <div className="p-8 flex items-center justify-center min-h-[400px]">
          <div className="text-slate-500">Loading...</div>
        </div>
      </>
    )
  }

  if (error || !rental) {
    return (
      <>
        <AdminHeader title="Rental Details" />
        <div className="p-8 flex flex-col items-center justify-center min-h-[400px] gap-4">
          <p className="text-red-600">{error ?? 'Rental not found'}</p>
          <Link to="/admin/rentals" className="text-primary hover:underline">
            Back to Rentals
          </Link>
        </div>
      </>
    )
  }

  const canActivate = rental.status === 'RESERVED'
  const canReturn = rental.status === 'ACTIVE'
  const canCancel = rental.status === 'RESERVED'

  return (
    <>
      <AdminHeader title="Rental Details" />
      <div className="p-6 lg:p-8 max-w-4xl">
        <nav className="mb-6">
          <Link
            to="/admin/rentals"
            className="text-sm text-slate-500 hover:text-primary transition-colors"
          >
            ← Back to Rentals
          </Link>
        </nav>

        {actionError && (
          <div className="mb-6 p-4 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm">
            {actionError}
          </div>
        )}

        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                Rental {rental.rentalId}
              </h2>
              <RentalStatusBadge status={rental.status} />
            </div>
            <div className="flex flex-wrap gap-2">
              {canActivate && (
                <button
                  type="button"
                  onClick={() => handleAction('activate')}
                  disabled={!!actionLoading}
                  className="px-4 py-2 rounded-lg bg-green-600 hover:bg-green-700 text-white text-sm font-semibold disabled:opacity-50"
                >
                  Activate
                </button>
              )}
              {canReturn && (
                <button
                  type="button"
                  onClick={() => handleAction('return')}
                  disabled={!!actionLoading}
                  className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold disabled:opacity-50"
                >
                  Mark Returned
                </button>
              )}
              {canCancel && (
                <button
                  type="button"
                  onClick={() => handleAction('cancel')}
                  disabled={!!actionLoading}
                  className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm font-semibold disabled:opacity-50"
                >
                  Cancel
                </button>
              )}
            </div>
          </div>

          <div className="p-6 space-y-6">
            <div>
              <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-2">
                Customer
              </h3>
              <p className="font-semibold">{customerName}</p>
              <p className="text-sm text-slate-500">{rental.customerId}</p>
            </div>

            <div>
              <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-2">
                Period
              </h3>
              <p className="text-sm">
                {formatDate(rental.startDate)} → {formatDate(rental.endDate)}
              </p>
            </div>

            <div>
              <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-2">
                Items
              </h3>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-700">
                    <th className="text-left py-2 font-semibold">Shoe</th>
                    <th className="text-left py-2 font-semibold">Size</th>
                    <th className="text-left py-2 font-semibold">Color</th>
                    <th className="text-left py-2 font-semibold">Qty</th>
                    <th className="text-right py-2 font-semibold">Price/day</th>
                  </tr>
                </thead>
                <tbody>
                  {rental.items.map((item) => (
                    <tr
                      key={item.variantId}
                      className="border-b border-slate-100 dark:border-slate-800"
                    >
                      <td className="py-2">{item.shoeName}</td>
                      <td className="py-2">EU {item.size}</td>
                      <td className="py-2">{item.color}</td>
                      <td className="py-2">{item.quantity}</td>
                      <td className="py-2 text-right">{formatCurrency(item.pricePerDay)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="pt-4 border-t border-slate-200 dark:border-slate-700">
              <div className="flex justify-between text-sm mb-1">
                <span className="text-slate-500">Base price</span>
                <span>{formatCurrency(rental.basePrice)}</span>
              </div>
              {rental.lateFee > 0 && (
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-slate-500">Late fee</span>
                  <span>{formatCurrency(rental.lateFee)}</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-lg mt-2">
                <span>Total</span>
                <span>{formatCurrency(rental.totalAmount)}</span>
              </div>
            </div>

            {rental.note && (
              <div>
                <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-2">
                  Note
                </h3>
                <p className="text-sm text-slate-600 dark:text-slate-400">{rental.note}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
