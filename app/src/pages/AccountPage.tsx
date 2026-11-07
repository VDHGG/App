import { type FormEvent, useCallback, useEffect, useState } from 'react'
import { ContentPageShell } from '../components/content/ContentPageShell'
import { RentalStatusBadge } from '../components/admin/RentalStatusBadge'
import { useAuth } from '../auth/AuthContext'
import { changePassword, updateProfile } from '../lib/auth.api'
import { getApiErrorMessage } from '../lib/api'
import {
  cancelMyRental,
  extendMyRental,
  getMyRental,
  listMyRentals,
  type GetRentalResponse,
  type RentalSummary,
} from '../lib/rentals.api'
import {
  fetchMomoPaymentStatuses,
  createMomoPayment,
  type MomoPaymentStatusRecord,
} from '../lib/payments.api'
import { customerMayCancelReserved } from '../lib/rentalCustomerUi'
import { formatCurrency } from '../lib/format'

function toDateString(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function nextDayDateString(isoDate: string): string {
  const d = new Date(isoDate)
  d.setDate(d.getDate() + 1)
  return toDateString(d)
}

export function AccountPage() {
  const { user, refreshUser } = useAuth()
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [pwError, setPwError] = useState<string | null>(null)
  const [pwSuccess, setPwSuccess] = useState<string | null>(null)
  const [pwSubmitting, setPwSubmitting] = useState(false)

  const showRentals = user?.role === 'customer' && Boolean(user.customerId)
  const [rentals, setRentals] = useState<RentalSummary[]>([])
  const [rentalsLoading, setRentalsLoading] = useState(false)
  const [rentalsError, setRentalsError] = useState<string | null>(null)

  const [detailId, setDetailId] = useState<string | null>(null)
  const [detail, setDetail] = useState<GetRentalResponse | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)

  const [cancelId, setCancelId] = useState<string | null>(null)
  const [cancelNote, setCancelNote] = useState('')
  const [cancelSubmitting, setCancelSubmitting] = useState(false)
  const [cancelError, setCancelError] = useState<string | null>(null)

  // MoMo Payment & Extend State
  const [paymentMap, setPaymentMap] = useState<Record<string, MomoPaymentStatusRecord>>({})
  const [momoLoadingId, setMomoLoadingId] = useState<string | null>(null)

  const [extendRentalTarget, setExtendRentalTarget] = useState<RentalSummary | null>(null)
  const [extendNewEndDate, setExtendNewEndDate] = useState('')
  const [extendNote, setExtendNote] = useState('')
  const [extendSubmitting, setExtendSubmitting] = useState(false)
  const [extendError, setExtendError] = useState<string | null>(null)

  const loadRentals = useCallback(async () => {
    if (!showRentals) return
    setRentalsLoading(true)
    setRentalsError(null)
    try {
      const res = await listMyRentals({ page: 1, pageSize: 50 })
      setRentals(res.rentals)
      if (res.rentals.length > 0) {
        try {
          const statuses = await fetchMomoPaymentStatuses(res.rentals.map((r) => r.rentalId))
          setPaymentMap(statuses.payments)
        } catch {
          // ignore payment status error
        }
      }
    } catch (e) {
      setRentalsError(getApiErrorMessage(e))
    } finally {
      setRentalsLoading(false)
    }
  }, [showRentals])

  async function handlePayMomo(rentalId: string) {
    setMomoLoadingId(rentalId)
    try {
      const pay = await createMomoPayment({ rentalId })
      if (pay.payUrl) {
        window.location.assign(pay.payUrl)
      }
    } catch (err: unknown) {
      alert(getApiErrorMessage(err))
    } finally {
      setMomoLoadingId(null)
    }
  }

  function openExtend(r: RentalSummary) {
    setExtendRentalTarget(r)
    setExtendNewEndDate(nextDayDateString(r.endDate))
    setExtendNote('')
    setExtendError(null)
  }

  function closeExtend() {
    setExtendRentalTarget(null)
    setExtendError(null)
  }

  async function confirmExtend() {
    if (!extendRentalTarget || !extendNewEndDate) return
    setExtendSubmitting(true)
    setExtendError(null)
    try {
      await extendMyRental(extendRentalTarget.rentalId, {
        newEndDate: extendNewEndDate,
        note: extendNote.trim() || undefined,
      })
      closeExtend()
      await loadRentals()
      setSuccess('Gia hạn thời gian thuê thành công!')
    } catch (err: unknown) {
      setExtendError(getApiErrorMessage(err))
    } finally {
      setExtendSubmitting(false)
    }
  }

  useEffect(() => {
    void loadRentals()
  }, [loadRentals])

  useEffect(() => {
    if (!user) return
    setFullName(user.fullName)
    setEmail(user.email)
    setPhone(user.phone ?? '')
  }, [user])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setSuccess(null)
    setSubmitting(true)
    try {
      await updateProfile({
        fullName: fullName.trim(),
        email: email.trim(),
        phone: phone.trim(),
      })
      await refreshUser()
      setSuccess('Account information saved successfully.')
    } catch (err) {
      setError(getApiErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  async function handlePasswordSubmit(e: FormEvent) {
    e.preventDefault()
    setPwError(null)
    setPwSuccess(null)
    if (newPassword !== confirmPassword) {
      setPwError('New password and confirmation do not match.')
      return
    }
    if (newPassword.length < 8) {
      setPwError('New password must be at least 8 characters.')
      return
    }
    setPwSubmitting(true)
    try {
      await changePassword({
        currentPassword,
        newPassword,
      })
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setPwSuccess('Password updated successfully.')
    } catch (err) {
      setPwError(getApiErrorMessage(err))
    } finally {
      setPwSubmitting(false)
    }
  }

  async function openDetail(rentalId: string) {
    setDetailId(rentalId)
    setDetail(null)
    setDetailLoading(true)
    try {
      const d = await getMyRental(rentalId)
      setDetail(d)
    } catch (e) {
      setDetailId(null)
      setRentalsError(getApiErrorMessage(e))
    } finally {
      setDetailLoading(false)
    }
  }

  function closeDetail() {
    setDetailId(null)
    setDetail(null)
  }

  function openCancel(rentalId: string) {
    setCancelId(rentalId)
    setCancelNote('')
    setCancelError(null)
  }

  function closeCancel() {
    setCancelId(null)
    setCancelNote('')
    setCancelError(null)
  }

  async function confirmCancel() {
    if (!cancelId) return
    setCancelSubmitting(true)
    setCancelError(null)
    try {
      await cancelMyRental(cancelId, {
        note: cancelNote.trim() || undefined,
      })
      closeCancel()
      await loadRentals()
      if (detailId === cancelId) closeDetail()
      setSuccess('Reservation cancelled.')
    } catch (e) {
      setCancelError(getApiErrorMessage(e))
    } finally {
      setCancelSubmitting(false)
    }
  }

  function formatDate(iso: string) {
    try {
      return new Date(iso).toLocaleDateString(undefined, { dateStyle: 'medium' })
    } catch {
      return iso
    }
  }

  return (
    <ContentPageShell
      title="Account"
      intro="Update your profile, manage password, and view your rental history."
      maxWidthClassName="max-w-5xl"
    >
      {user?.role === 'customer' && (
        <div className="mb-8 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="size-12 rounded-2xl bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center">
              <span className="material-symbols-outlined text-2xl">workspace_premium</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-black text-slate-900 dark:text-white uppercase tracking-wider text-sm">
                  Hạng thành viên:
                </h3>
                <span className="px-3 py-0.5 rounded-full text-xs font-black uppercase tracking-wider bg-amber-500 text-white shadow-sm">
                  {user?.rank ?? 'BRONZE'}
                </span>
                {user?.rankDiscountPercent ? (
                  <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                    (Ưu đãi tự động -{user.rankDiscountPercent}%)
                  </span>
                ) : null}
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Tự động tích lũy chi tiêu khi hoàn tất trả giày để nâng hạng vĩnh viễn.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-[11px] text-slate-500 bg-white/80 dark:bg-slate-900/80 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800">
            <span className="font-semibold text-slate-700 dark:text-slate-300">Cột mốc:</span>
            <span>Bạc (2M -5%)</span>
            <span>•</span>
            <span>Vàng (5M -10%)</span>
            <span>•</span>
            <span>Kim cương (10M -15%)</span>
          </div>
        </div>
      )}

      <form
        onSubmit={handleSubmit}
        className="space-y-5 max-w-lg pb-10 border-b border-slate-200 dark:border-slate-800"
      >
        {error && (
          <div className="rounded-lg bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm px-3 py-2">
            {error}
          </div>
        )}
        {success && (
          <div className="rounded-lg bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 text-sm px-3 py-2">
            {success}
          </div>
        )}
        <div>
          <label
            htmlFor="account-fullName"
            className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5"
          >
            Full Name
          </label>
          <input
            id="account-fullName"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className="w-full h-11 px-3 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-primary"
            autoComplete="name"
            required
            maxLength={100}
          />
        </div>
        <div>
          <label
            htmlFor="account-email"
            className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5"
          >
            Email
          </label>
          <input
            id="account-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full h-11 px-3 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-primary"
            autoComplete="email"
            required
            maxLength={255}
          />
        </div>
        <div>
          <label
            htmlFor="account-phone"
            className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5"
          >
            Phone
          </label>
          <input
            id="account-phone"
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="w-full h-11 px-3 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-primary"
            autoComplete="tel"
            required
            minLength={1}
            maxLength={20}
          />
          <p className="mt-1.5 text-xs text-slate-500">
            Use the contact number when receiving shoes; format like when registering (8–15 digits).
          </p>
        </div>
        <button
          type="submit"
          disabled={submitting}
          className="inline-flex items-center justify-center min-h-11 px-6 rounded-lg bg-primary text-white text-sm font-bold uppercase tracking-wide hover:opacity-90 disabled:opacity-50"
        >
          {submitting ? 'Saving…' : 'Save changes'}
        </button>
      </form>

      {showRentals && (
        <section className="pt-6 border-b border-slate-200 dark:border-slate-800 pb-10">
          <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">My rentals</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
            Status matches what you see in store admin. You can cancel only while the order is
            RESERVED and at least one full day before the rental start date. Optional note is stored
            on the order.
          </p>
          {rentalsError && (
            <div className="mb-4 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-600 text-sm px-3 py-2">
              {rentalsError}
            </div>
          )}
          {rentalsLoading ? (
            <p className="text-slate-500 text-sm">Loading rentals…</p>
          ) : rentals.length === 0 ? (
            <p className="text-slate-500 text-sm">No rentals yet.</p>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-900/50 text-left text-xs uppercase tracking-wider text-slate-500">
                    <th className="px-3 py-2 font-semibold">ID</th>
                    <th className="px-3 py-2 font-semibold">Start</th>
                    <th className="px-3 py-2 font-semibold">Return</th>
                    <th className="px-3 py-2 font-semibold">Status</th>
                    <th className="px-3 py-2 font-semibold">Payment</th>
                    <th className="px-3 py-2 font-semibold text-right">Total</th>
                    <th className="px-3 py-2 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {rentals.map((r) => (
                    <tr
                      key={r.rentalId}
                      className="border-t border-slate-200 dark:border-slate-800"
                    >
                      <td className="px-3 py-2 font-mono text-xs">{r.rentalId}</td>
                      <td className="px-3 py-2 whitespace-nowrap">{formatDate(r.startDate)}</td>
                      <td className="px-3 py-2 whitespace-nowrap">{formatDate(r.endDate)}</td>
                      <td className="px-3 py-2">
                        <RentalStatusBadge status={r.status} />
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        {paymentMap[r.rentalId]?.status === 'PAID' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300">
                            <span className="size-1.5 rounded-full bg-emerald-500" />
                            MoMo PAID
                          </span>
                        ) : paymentMap[r.rentalId]?.status === 'PENDING' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
                            <span className="size-1.5 rounded-full bg-amber-500" />
                            MoMo PENDING
                          </span>
                        ) : paymentMap[r.rentalId]?.status === 'EXPIRED' || paymentMap[r.rentalId]?.status === 'FAILED' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300">
                            <span className="size-1.5 rounded-full bg-rose-500" />
                            MoMo {paymentMap[r.rentalId]?.status}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                            COD / Unpaid
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right">{formatCurrency(r.totalAmount)}</td>
                      <td className="px-3 py-2 text-right space-x-2 whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => void openDetail(r.rentalId)}
                          className="text-primary font-semibold hover:underline"
                        >
                          Details
                        </button>
                        {r.status === 'RESERVED' && paymentMap[r.rentalId]?.status !== 'PAID' && (
                          <button
                            type="button"
                            disabled={momoLoadingId === r.rentalId}
                            onClick={() => void handlePayMomo(r.rentalId)}
                            className="text-amber-600 dark:text-amber-400 font-semibold hover:underline disabled:opacity-50"
                          >
                            {momoLoadingId === r.rentalId ? 'Processing…' : 'Pay MoMo'}
                          </button>
                        )}
                        {(r.status === 'RESERVED' || r.status === 'ACTIVE') && (
                          <button
                            type="button"
                            onClick={() => openExtend(r)}
                            className="text-indigo-600 dark:text-indigo-400 font-semibold hover:underline"
                          >
                            Extend
                          </button>
                        )}
                        {customerMayCancelReserved(r.startDate, r.status) && (
                          <button
                            type="button"
                            onClick={() => openCancel(r.rentalId)}
                            className="text-rose-600 dark:text-rose-400 font-semibold hover:underline"
                          >
                            Cancel
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      <div className="max-w-lg pt-2">
        <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-1">Change password</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
          Enter your current password, then choose a new one (at least 8 characters).
        </p>
        <form onSubmit={handlePasswordSubmit} className="space-y-5">
          {pwError && (
            <div className="rounded-lg bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm px-3 py-2">
              {pwError}
            </div>
          )}
          {pwSuccess && (
            <div className="rounded-lg bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 text-sm px-3 py-2">
              {pwSuccess}
            </div>
          )}
          <div>
            <label
              htmlFor="account-current-password"
              className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5"
            >
              Current password
            </label>
            <input
              id="account-current-password"
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="w-full h-11 px-3 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-primary"
              autoComplete="current-password"
              required
            />
          </div>
          <div>
            <label
              htmlFor="account-new-password"
              className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5"
            >
              New password
            </label>
            <input
              id="account-new-password"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full h-11 px-3 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-primary"
              autoComplete="new-password"
              required
              minLength={8}
            />
          </div>
          <div>
            <label
              htmlFor="account-confirm-password"
              className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5"
            >
              Confirm new password
            </label>
            <input
              id="account-confirm-password"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full h-11 px-3 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-primary"
              autoComplete="new-password"
              required
              minLength={8}
            />
          </div>
          <button
            type="submit"
            disabled={pwSubmitting}
            className="inline-flex items-center justify-center min-h-11 px-6 rounded-lg bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-sm font-bold uppercase tracking-wide hover:opacity-90 disabled:opacity-50"
          >
            {pwSubmitting ? 'Updating…' : 'Update password'}
          </button>
        </form>
      </div>

      {detailId && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50"
          role="dialog"
          aria-modal="true"
          aria-labelledby="rental-detail-title"
        >
          <div className="bg-white dark:bg-slate-900 rounded-xl max-w-lg w-full max-h-[90vh] overflow-y-auto shadow-xl border border-slate-200 dark:border-slate-800 p-6">
            <h2 id="rental-detail-title" className="text-lg font-bold text-slate-900 dark:text-white mb-4">
              Rental details
            </h2>
            {detailLoading ? (
              <p className="text-slate-500 text-sm">Loading…</p>
            ) : detail ? (
              <div className="space-y-3 text-sm">
                <div className="flex justify-between gap-4">
                  <span className="text-slate-500">ID</span>
                  <span className="font-mono">{detail.rentalId}</span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-slate-500">Status</span>
                  <RentalStatusBadge status={detail.status} />
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-slate-500">Start</span>
                  <span>{formatDate(detail.startDate)}</span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-slate-500">Expected return</span>
                  <span>{formatDate(detail.endDate)}</span>
                </div>
                <div className="pt-2 border-t border-slate-200 dark:border-slate-800">
                  <p className="text-slate-500 mb-2">Items</p>
                  <ul className="space-y-2">
                    {detail.items.map((it) => (
                      <li key={it.variantId} className="text-slate-700 dark:text-slate-300">
                        {it.shoeName} · EU {it.size} · {it.color} × {it.quantity}
                      </li>
                    ))}
                  </ul>
                </div>
                {detail.note && (
                  <div>
                    <p className="text-slate-500 mb-1">Note</p>
                    <p className="text-slate-800 dark:text-slate-200">{detail.note}</p>
                  </div>
                )}
              </div>
            ) : null}
            <button
              type="button"
              onClick={closeDetail}
              className="mt-6 w-full py-2.5 rounded-lg bg-slate-100 dark:bg-slate-800 font-semibold text-sm"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {cancelId && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white dark:bg-slate-900 rounded-xl max-w-md w-full shadow-xl border border-slate-200 dark:border-slate-800 p-6">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-2">Cancel reservation</h2>
            <p className="text-sm text-slate-500 mb-4">
              Add an optional note (reason). This updates your order in the app only.
            </p>
            {cancelError && (
              <div className="mb-3 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-600 text-sm px-3 py-2">
                {cancelError}
              </div>
            )}
            <label htmlFor="cancel-note" className="block text-xs font-bold uppercase text-slate-500 mb-1.5">
              Note (optional)
            </label>
            <textarea
              id="cancel-note"
              value={cancelNote}
              onChange={(e) => setCancelNote(e.target.value)}
              maxLength={255}
              rows={3}
              className="w-full px-3 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm mb-4"
              placeholder="Reason for cancellation…"
            />
            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={closeCancel}
                className="px-4 py-2 rounded-lg text-sm font-semibold text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                Back
              </button>
              <button
                type="button"
                disabled={cancelSubmitting}
                onClick={() => void confirmCancel()}
                className="px-4 py-2 rounded-lg text-sm font-bold bg-rose-600 text-white hover:opacity-90 disabled:opacity-50"
              >
                {cancelSubmitting ? 'Cancelling…' : 'Confirm cancel'}
              </button>
            </div>
          </div>
        </div>
      )}

      {extendRentalTarget && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white dark:bg-slate-900 rounded-xl max-w-md w-full shadow-xl border border-slate-200 dark:border-slate-800 p-6">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-2">
              Gia hạn đơn thuê {extendRentalTarget.rentalId}
            </h2>
            <p className="text-sm text-slate-500 mb-4">
              Ngày trả hiện tại: <strong>{formatDate(extendRentalTarget.endDate)}</strong>. Chọn ngày trả mới sau ngày này.
            </p>
            {extendError && (
              <div className="mb-3 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-600 text-sm px-3 py-2">
                {extendError}
              </div>
            )}
            <div className="space-y-4 mb-4">
              <div>
                <label className="block text-xs font-bold uppercase text-slate-500 mb-1.5">
                  Ngày trả mới
                </label>
                <input
                  type="date"
                  value={extendNewEndDate}
                  min={nextDayDateString(extendRentalTarget.endDate)}
                  onChange={(e) => setExtendNewEndDate(e.target.value)}
                  className="w-full h-11 px-3 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-sm"
                  required
                />
              </div>
              <div>
                <label htmlFor="extend-note" className="block text-xs font-bold uppercase text-slate-500 mb-1.5">
                  Ghi chú (tùy chọn)
                </label>
                <textarea
                  id="extend-note"
                  value={extendNote}
                  onChange={(e) => setExtendNote(e.target.value)}
                  maxLength={255}
                  rows={2}
                  className="w-full px-3 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm"
                  placeholder="Lý do gia hạn…"
                />
              </div>
            </div>
            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={closeExtend}
                className="px-4 py-2 rounded-lg text-sm font-semibold text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                Hủy
              </button>
              <button
                type="button"
                disabled={extendSubmitting || !extendNewEndDate}
                onClick={() => void confirmExtend()}
                className="px-4 py-2 rounded-lg text-sm font-bold bg-primary text-white hover:opacity-90 disabled:opacity-50"
              >
                {extendSubmitting ? 'Đang gia hạn…' : 'Xác nhận gia hạn'}
              </button>
            </div>
          </div>
        </div>
      )}
    </ContentPageShell>
  )
}
