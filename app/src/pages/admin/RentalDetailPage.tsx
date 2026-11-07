import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {  getRental,  activateRental,  returnRental,  cancelRental} from '../../lib/rentals.api'
import { getCustomer } from '../../lib/customers.api'
import { AdminHeader } from '../../components/admin/AdminHeader'
import { RentalStatusBadge } from '../../components/admin/RentalStatusBadge'
import { formatDate, formatCurrency } from '../../lib/format'
import { getApiErrorMessage } from '../../lib/api'

function confirmRentalAction(action: 'activate' | 'cancel'): boolean {
  const msg =
    action === 'activate'
      ? 'Activate this rental? The reservation will become active.'
      : 'Cancel this reservation? This cannot be undone.'
  return window.confirm(msg)
}

function toDateString(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function RentalDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [rental, setRental] = useState<Awaited<ReturnType<typeof getRental>> | null>(null)
  const [customerName, setCustomerName] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  const [returnModalOpen, setReturnModalOpen] = useState(false)
  const [returnDate, setReturnDate] = useState('')
  const [returnNote, setReturnNote] = useState('')
  const [returnLoading, setReturnLoading] = useState(false)
  const [returnError, setReturnError] = useState<string | null>(null)

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

  const openReturn = () => {
    setReturnDate(toDateString(new Date()))
    setReturnNote('')
    setReturnError(null)
    setReturnModalOpen(true)
  }

  const closeReturn = () => {
    setReturnModalOpen(false)
    setReturnError(null)
  }

  const returnCalculation = useMemo(() => {
    if (!rental || !returnDate) {
      return { overdueDays: 0, lateFee: 0, totalPayable: 0 }
    }
    const startD = new Date(rental.startDate)
    const endD = new Date(rental.endDate)
    const retD = new Date(`${returnDate}T00:00:00`)

    const startNorm = new Date(startD.getFullYear(), startD.getMonth(), startD.getDate()).getTime()
    const endNorm = new Date(endD.getFullYear(), endD.getMonth(), endD.getDate()).getTime()
    const retNorm = new Date(retD.getFullYear(), retD.getMonth(), retD.getDate()).getTime()

    const overdueDays = Math.max(0, Math.round((retNorm - endNorm) / 86400000))
    const rentalDays = Math.max(1, Math.round((endNorm - startNorm) / 86400000) + 1)
    const dailyRate = rental.basePrice / rentalDays
    const lateFee = Math.round(overdueDays * dailyRate * 0.5)
    const totalPayable = rental.basePrice + lateFee

    return { overdueDays, lateFee, totalPayable }
  }, [rental, returnDate])

  const confirmReturn = async () => {
    if (!id || !returnDate) return
    setReturnLoading(true)
    setReturnError(null)
    try {
      await returnRental(id, {
        returnedAt: returnDate,
        note: returnNote.trim() || undefined,
      })
      closeReturn()
      const r = await getRental(id)
      setRental(r)
    } catch (err: unknown) {
      setReturnError(getApiErrorMessage(err))
    } finally {
      setReturnLoading(false)
    }
  }

  const handleAction = async (action: 'activate' | 'cancel') => {
    if (!id) return
    if (!confirmRentalAction(action)) return
    setActionLoading(action)
    setActionError(null)
    try {
      if (action === 'activate') await activateRental(id)
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
                  onClick={openReturn}
                  disabled={!!actionLoading || returnLoading}
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
                {rental.isOverdue && (rental.overdueDays ?? 0) > 0 && (
                  <span className="ml-2 inline-block px-2.5 py-0.5 rounded text-xs font-bold bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300">
                    Quá hạn {rental.overdueDays} ngày (Dự kiến phạt +{formatCurrency(rental.estimatedLateFee ?? 0)})
                  </span>
                )}
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
              {rental.status !== 'RETURNED' && rental.isOverdue && (rental.estimatedLateFee ?? 0) > 0 && (
                <div className="flex justify-between text-sm mb-1 text-rose-600 dark:text-rose-400 font-semibold">
                  <span>Phí trễ hạn dự kiến (50%/ngày)</span>
                  <span>+{formatCurrency(rental.estimatedLateFee ?? 0)}</span>
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

      {returnModalOpen && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white dark:bg-slate-900 rounded-xl max-w-md w-full shadow-xl border border-slate-200 dark:border-slate-800 p-6">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-2">
              Xác nhận trả giày — Đơn {rental.rentalId}
            </h2>
            <p className="text-sm text-slate-500 mb-4">
              Ngày thuê: <strong>{formatDate(rental.startDate)}</strong> → Hạn trả:{' '}
              <strong>{formatDate(rental.endDate)}</strong>
            </p>
            {returnError && (
              <div className="mb-3 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-600 text-sm px-3 py-2">
                {returnError}
              </div>
            )}
            <div className="space-y-4 mb-4">
              <div>
                <label className="block text-xs font-bold uppercase text-slate-500 mb-1.5">
                  Ngày trả thực tế
                </label>
                <input
                  type="date"
                  value={returnDate}
                  onChange={(e) => setReturnDate(e.target.value)}
                  className="w-full h-11 px-3 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-sm"
                  required
                />
              </div>

              <div className="rounded-lg bg-slate-50 dark:bg-slate-800/60 p-3.5 border border-slate-200 dark:border-slate-700 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-500">Giá thuê gốc (Base price)</span>
                  <span className="font-semibold">{formatCurrency(rental.basePrice)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Số ngày quá hạn (Overdue days)</span>
                  <span className={`font-semibold ${returnCalculation.overdueDays > 0 ? 'text-rose-600 dark:text-rose-400 font-bold' : ''}`}>
                    {returnCalculation.overdueDays} ngày
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Phí phạt trễ hạn (50%/ngày)</span>
                  <span className={`font-semibold ${returnCalculation.lateFee > 0 ? 'text-rose-600 dark:text-rose-400' : ''}`}>
                    +{formatCurrency(returnCalculation.lateFee)}
                  </span>
                </div>
                <div className="pt-2 border-t border-slate-200 dark:border-slate-700 flex justify-between font-bold text-base">
                  <span>Tổng cộng thanh toán</span>
                  <span className="text-primary">{formatCurrency(returnCalculation.totalPayable)}</span>
                </div>
              </div>

              <p className="text-xs text-slate-500 dark:text-slate-400 italic">
                * Hệ thống sẽ tự động cộng tích lũy và nâng hạng thành viên cho khách nếu đạt cột mốc.
              </p>

              <div>
                <label htmlFor="detail-return-note" className="block text-xs font-bold uppercase text-slate-500 mb-1.5">
                  Ghi chú (tùy chọn)
                </label>
                <textarea
                  id="detail-return-note"
                  value={returnNote}
                  onChange={(e) => setReturnNote(e.target.value)}
                  maxLength={255}
                  rows={2}
                  className="w-full px-3 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm"
                  placeholder="Ghi chú tình trạng giày khi trả…"
                />
              </div>
            </div>
            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={closeReturn}
                className="px-4 py-2 rounded-lg text-sm font-semibold text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                Hủy
              </button>
              <button
                type="button"
                disabled={returnLoading || !returnDate}
                onClick={() => void confirmReturn()}
                className="px-4 py-2 rounded-lg text-sm font-bold bg-primary text-white hover:opacity-90 disabled:opacity-50"
              >
                {returnLoading ? 'Đang xử lý…' : 'Xác nhận trả'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
