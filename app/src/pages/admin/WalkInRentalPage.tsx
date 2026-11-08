import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  listShoes,
  getShoe,
  fetchShoeAvailability,
  type GetShoeResponse,
  type ShoeVariantDto,
  type ShoeAvailabilityResponse,
} from '../../lib/shoes.api'
import {
  listCustomers,
  registerCustomer,
  type CustomerSummary,
  type CustomerRank,
  type RegisterCustomerRequest,
} from '../../lib/customers.api'
import {
  createRental,
  activateRental,
  getRental,
  validateVoucher,
  type CreateRentalResponse,
  type GetRentalResponse,
  type ValidateVoucherResponse,
} from '../../lib/rentals.api'
import { listActiveVouchers } from '../../lib/vouchers.api'
import { AdminHeader } from '../../components/admin/AdminHeader'
import { RentalStatusBadge } from '../../components/admin/RentalStatusBadge'
import { formatCurrency, formatDate } from '../../lib/format'
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

const RANK_DISCOUNT_MAP: Record<CustomerRank, number> = {
  BRONZE: 0,
  SILVER: 5,
  GOLD: 10,
  DIAMOND: 15,
}

function toDateString(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
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
    phone: '',
    rank: 'BRONZE',
  })

  const [pickShoeId, setPickShoeId] = useState('')
  const [detail, setDetail] = useState<GetShoeResponse | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [availability, setAvailability] = useState<ShoeAvailabilityResponse | null>(null)
  const [availLoading, setAvailLoading] = useState(false)
  const [variantId, setVariantId] = useState('')
  const [lineQty, setLineQty] = useState(1)

  const [lines, setLines] = useState<LineItem[]>([])

  const today = toDateString(new Date())
  const defaultEnd = addDays(new Date(), 2)
  const [startDate, setStartDate] = useState(today)
  const [endDate, setEndDate] = useState(toDateString(defaultEnd))

  // Voucher & POS state
  const [voucherInput, setVoucherInput] = useState('')
  const [voucherLoading, setVoucherLoading] = useState(false)
  const [voucherError, setVoucherError] = useState<string | null>(null)
  const [appliedVoucher, setAppliedVoucher] = useState<ValidateVoucherResponse | null>(null)
  const [activeVoucherPills, setActiveVoucherPills] = useState<
    Array<{ code: string; discountPercent: number }>
  >([])
  const [instantActivate, setInstantActivate] = useState(true)
  const [posNote, setPosNote] = useState('')

  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [created, setCreated] = useState<CreateRentalResponse | null>(null)
  const [createdDetail, setCreatedDetail] = useState<GetRentalResponse | null>(null)
  const [activationWarning, setActivationWarning] = useState<string | null>(null)
  const [invoiceOpen, setInvoiceOpen] = useState(false)

  useEffect(() => {
    Promise.all([
      listShoes(),
      listCustomers(),
      listActiveVouchers().catch(() => ({ vouchers: [] })),
    ])
      .then(([shoesRes, customersRes, vouchersRes]) => {
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
        if (vouchersRes.vouchers.length > 0) {
          setActiveVoucherPills(
            vouchersRes.vouchers.map((v) => ({
              code: v.code,
              discountPercent: v.discountPercent,
            }))
          )
        }
      })
      .catch((err) => setLoadError(getApiErrorMessage(err)))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (!pickShoeId) {
      setDetail(null)
      setAvailability(null)
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
        } else {
          setVariantId('')
        }
      })
      .catch(() => setDetail(null))
      .finally(() => setDetailLoading(false))
  }, [pickShoeId])

  useEffect(() => {
    if (!pickShoeId || !startDate || !endDate || endDate < startDate) {
      setAvailability(null)
      return
    }
    let cancelled = false
    setAvailLoading(true)
    fetchShoeAvailability(pickShoeId, startDate, endDate)
      .then((res) => {
        if (cancelled) return
        setAvailability(res)
        const firstAvail = res.variants.find((v) => v.availableQuantity > 0)
        if (firstAvail) {
          setVariantId((prev) => {
            const currentAvail = res.variants.find((x) => x.variantId === prev)
            if (currentAvail && currentAvail.availableQuantity > 0) return prev
            return firstAvail.variantId
          })
        }
      })
      .catch(() => {
        if (!cancelled) setAvailability(null)
      })
      .finally(() => {
        if (!cancelled) setAvailLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [pickShoeId, startDate, endDate])

  const variantAvailMap = useMemo(() => {
    const m = new Map<string, number>()
    if (availability?.variants) {
      for (const v of availability.variants) {
        m.set(v.variantId, v.availableQuantity)
      }
    }
    return m
  }, [availability])

  const effectiveAvailable = useCallback(
    (v: ShoeVariantDto): number => {
      return variantAvailMap.has(v.variantId)
        ? variantAvailMap.get(v.variantId)!
        : v.availableQuantity
    },
    [variantAvailMap]
  )

  const selectedVariant: ShoeVariantDto | undefined = detail?.variants.find(
    (v) => v.variantId === variantId
  )

  const selectedCustomer = useMemo(
    () => customers.find((c) => c.customerId === selectedCustomerId) ?? null,
    [customers, selectedCustomerId]
  )

  const activeCustomerRank: CustomerRank =
    customerMode === 'existing'
      ? (selectedCustomer?.rank ?? 'BRONZE')
      : (newCustomer.rank ?? 'BRONZE')

  const rankDiscountPercent = RANK_DISCOUNT_MAP[activeCustomerRank] ?? 0
  const voucherDiscountPercent = appliedVoucher?.discountPercent ?? 0
  const effectiveDiscountPercent = Math.min(50, rankDiscountPercent + voucherDiscountPercent)

  const rentalDays = useMemo(
    () => (startDate && endDate && endDate >= startDate ? inclusiveRentalDays(startDate, endDate) : 1),
    [startDate, endDate]
  )

  const totalItems = useMemo(
    () => lines.reduce((sum, l) => sum + l.quantity, 0),
    [lines]
  )

  const rawBasePrice = useMemo(
    () => lines.reduce((sum, l) => sum + l.pricePerDay * l.quantity * rentalDays, 0),
    [lines, rentalDays]
  )

  const finalRentalPrice = useMemo(
    () =>
      lines.reduce((sum, l) => {
        const unitPrice =
          effectiveDiscountPercent > 0
            ? Math.max(1, Math.round((l.pricePerDay * (100 - effectiveDiscountPercent)) / 100))
            : l.pricePerDay
        return sum + unitPrice * l.quantity * rentalDays
      }, 0),
    [lines, rentalDays, effectiveDiscountPercent]
  )

  const discountAmount = Math.max(0, rawBasePrice - finalRentalPrice)
  const depositAmount = totalItems * 500_000
  const grandTotal = finalRentalPrice + depositAmount

  const handleApplyVoucher = async (codeToApply?: string) => {
    const code = (codeToApply ?? voucherInput).trim().toUpperCase()
    if (!code) return
    setVoucherLoading(true)
    setVoucherError(null)
    try {
      const res = await validateVoucher(code)
      if (res.valid) {
        setAppliedVoucher(res)
        setVoucherInput(res.code)
      } else {
        setVoucherError('Mã giảm giá không hợp lệ hoặc đã hết hạn.')
      }
    } catch (err: unknown) {
      setVoucherError(getApiErrorMessage(err))
    } finally {
      setVoucherLoading(false)
    }
  }

  const handleRemoveVoucher = () => {
    setAppliedVoucher(null)
    setVoucherInput('')
    setVoucherError(null)
  }

  const addLine = () => {
    if (!detail || !selectedVariant) return
    const maxQty = effectiveAvailable(selectedVariant)
    if (maxQty <= 0) {
      setSubmitError('Biến thể này đã hết hàng trong khoảng ngày đã chọn.')
      return
    }
    const existingForVariant = lines
      .filter((l) => l.variantId === selectedVariant.variantId)
      .reduce((s, l) => s + l.quantity, 0)
    const remainingVariantStock = maxQty - existingForVariant
    if (remainingVariantStock <= 0) {
      setSubmitError(`Bạn đã thêm tối đa số lượng tồn kho trống (${maxQty} đôi) cho biến thể này.`)
      return
    }

    const currentRented =
      customerMode === 'existing' ? (selectedCustomer?.currentRentedItems ?? 0) : 0
    const remainingCustomerCap = Math.max(0, 5 - currentRented - totalItems)
    if (remainingCustomerCap <= 0) {
      setSubmitError('Khách hàng đã đạt giới hạn tối đa 5 đôi giày đang thuê cùng lúc.')
      return
    }

    const q = Math.min(
      Math.max(1, Math.floor(lineQty)),
      remainingVariantStock,
      remainingCustomerCap
    )
    setLines((prev) => {
      const existingIdx = prev.findIndex((l) => l.variantId === selectedVariant.variantId)
      if (existingIdx >= 0) {
        return prev.map((l, idx) =>
          idx === existingIdx ? { ...l, quantity: l.quantity + q, maxQty } : l
        )
      }
      return [
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
      ]
    })
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
    setActivationWarning(null)
    const items = mergeItemsForApi()
    if (items.length === 0) {
      setSubmitError('Add at least one line item.')
      return
    }

    setSubmitting(true)
    try {
      let customerId: string
      if (customerMode === 'new') {
        const { fullName, email, phone, rank } = newCustomer
        if (!fullName.trim() || !email.trim() || !phone.trim()) {
          setSubmitError('Enter customer full name, email, and phone.')
          setSubmitting(false)
          return
        }
        const res = await registerCustomer({
          fullName: fullName.trim(),
          email: email.trim(),
          phone: phone.trim(),
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

      const trimmedNote = posNote.trim()
      const res = await createRental({
        customerId,
        items,
        startDate,
        endDate,
        ...(appliedVoucher ? { voucherCode: appliedVoucher.code } : {}),
        ...(trimmedNote ? { note: trimmedNote } : {}),
      })

      let finalRes = res
      if (instantActivate) {
        try {
          const activated = await activateRental(res.rentalId)
          finalRes = {
            ...res,
            status: activated.status,
            totalAmount: activated.totalAmount,
          }
          setCreatedDetail(activated)
        } catch (actErr: unknown) {
          setActivationWarning(
            `Đơn ${res.rentalId} đã tạo thành công (RESERVED), nhưng chưa thể kích hoạt giao giày tự động: ${getApiErrorMessage(actErr)}`
          )
          const d = await getRental(res.rentalId).catch(() => null)
          setCreatedDetail(d)
        }
      } else {
        const d = await getRental(res.rentalId).catch(() => null)
        setCreatedDetail(d)
      }

      setCreated(finalRes)
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
    const customerLabel =
      customerMode === 'existing'
        ? (selectedCustomer?.fullName ?? created.customerId)
        : newCustomer.fullName || created.customerId

    return (
      <>
        <AdminHeader title="Walk-in rental" />
        <div className="p-6 lg:p-8 max-w-xl space-y-4">
          <div className="p-6 rounded-xl border border-emerald-200 bg-emerald-50 dark:bg-emerald-900/20 dark:border-emerald-800 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-bold text-lg text-emerald-900 dark:text-emerald-100">
                Rental created
              </h3>
              <RentalStatusBadge status={created.status} />
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              ID: <code className="font-mono font-bold">{created.rentalId}</code> — Status: {created.status}
            </p>
            <p className="text-sm">
              Total: <strong>{formatCurrency(created.totalAmount)}</strong> · Tiền cọc:{' '}
              <strong>{formatCurrency(created.depositAmount ?? created.totalItems * 500_000)}</strong>
            </p>
            {activationWarning && (
              <p className="text-xs text-amber-700 dark:text-amber-300 pt-1">
                {activationWarning}
              </p>
            )}
          </div>

          <div className="flex flex-wrap gap-3">
            {createdDetail && (
              <button
                type="button"
                onClick={() => setInvoiceOpen(true)}
                className="rounded-lg bg-emerald-600 hover:bg-emerald-700 px-4 py-2 text-sm font-bold text-white inline-flex items-center gap-1.5"
              >
                <span className="material-symbols-outlined text-base">print</span>
                In Phiếu Giao Giày / Biên Nhận
              </button>
            )}
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
                setCreatedDetail(null)
                setActivationWarning(null)
                setLines([])
                setPickShoeId('')
                handleRemoveVoucher()
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

        {invoiceOpen && createdDetail && (
          <div
            className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/60"
            role="dialog"
            aria-modal="true"
          >
            <div className="bg-white text-slate-900 rounded-2xl max-w-2xl w-full max-h-[92vh] overflow-y-auto shadow-2xl border border-slate-200 p-6 sm:p-8">
              <div className="flex items-start justify-between border-b-2 border-slate-900 pb-4 mb-6">
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest text-slate-500">
                    RENTAL SHOES VIETNAM · POS COUNTER
                  </p>
                  <h2 className="text-xl font-black uppercase tracking-tight mt-0.5">
                    PHIẾU GIAO NHẬN &amp; HÓA ĐƠN THUÊ GIÀY
                  </h2>
                  <p className="text-xs text-slate-500 mt-1">
                    Mã đơn: <span className="font-mono font-bold text-slate-900">{createdDetail.rentalId}</span> · Ngày tạo: {formatDate(createdDetail.createdAt)}
                  </p>
                </div>
                <RentalStatusBadge status={createdDetail.status} />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs mb-6 bg-slate-50 p-4 rounded-xl border border-slate-200">
                <div>
                  <p className="text-slate-500 uppercase font-bold mb-1">Khách hàng</p>
                  <p className="font-bold text-sm">{customerLabel}</p>
                  <p className="text-slate-600">Mã KH: {createdDetail.customerId}</p>
                </div>
                <div>
                  <p className="text-slate-500 uppercase font-bold mb-1">Thời hạn thuê</p>
                  <p className="font-semibold">Nhận giày: {formatDate(createdDetail.startDate)}</p>
                  <p className="font-semibold">Hẹn trả: {formatDate(createdDetail.endDate)}</p>
                </div>
              </div>

              <table className="w-full text-xs border-collapse mb-6">
                <thead>
                  <tr className="border-b-2 border-slate-300 text-left uppercase text-slate-500">
                    <th className="py-2">Sản phẩm</th>
                    <th className="py-2">Size / Màu</th>
                    <th className="py-2 text-center">SL</th>
                    <th className="py-2 text-right">Đơn giá/ngày</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {createdDetail.items.map((item) => (
                    <tr key={item.variantId}>
                      <td className="py-2.5 font-semibold">{item.shoeName}</td>
                      <td className="py-2.5">EU {item.size} · {item.color}</td>
                      <td className="py-2.5 text-center">{item.quantity}</td>
                      <td className="py-2.5 text-right">{formatCurrency(item.pricePerDay)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="border-t-2 border-slate-300 pt-4 space-y-1.5 text-sm mb-6">
                <div className="flex justify-between text-base font-black pt-1">
                  <span>Tổng tiền thuê:</span>
                  <span className="text-primary">{formatCurrency(createdDetail.totalAmount)}</span>
                </div>
                <div className="flex justify-between text-xs font-bold text-amber-800 bg-amber-50 px-3 py-2 rounded-lg border border-amber-200 mt-2">
                  <span>Tiền đặt cọc bảo đảm (500.000₫ × {createdDetail.totalItems} đôi):</span>
                  <span>{formatCurrency(createdDetail.depositAmount ?? createdDetail.totalItems * 500_000)}</span>
                </div>
              </div>

              <div className="flex justify-end gap-3 print:hidden">
                <button
                  type="button"
                  onClick={() => setInvoiceOpen(false)}
                  className="px-4 py-2 rounded-lg text-sm font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700"
                >
                  Đóng
                </button>
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-5 py-2 rounded-lg text-sm font-bold bg-primary text-white hover:opacity-90 inline-flex items-center gap-1.5"
                >
                  <span className="material-symbols-outlined text-lg">print</span>
                  In ngay
                </button>
              </div>
            </div>
          </div>
        )}
      </>
    )
  }

  return (
    <>
      <AdminHeader title="Walk-in rental" />
      <div className="p-6 lg:p-8 max-w-[1200px] space-y-8">
        <nav className="flex items-center gap-2 text-sm text-slate-500">
          <Link to="/admin" className="hover:text-primary">
            Dashboard
          </Link>
          <span className="material-symbols-outlined text-xs">chevron_right</span>
          <span className="text-slate-900 dark:text-white font-medium">New rental (walk-in)</span>
        </nav>
        <div>
          <h1 className="text-2xl font-bold">Walk-in POS Counter</h1>
          <p className="text-slate-500 mt-1">
            Register or select a customer, check real-time date-range stock, apply rank &amp; voucher discounts, and hand over shoes in 1 step.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-5 space-y-6">
            <section className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm space-y-4">
              <h3 className="font-bold flex items-center gap-2">
                <span className="material-symbols-outlined text-primary">person</span>
                Customer
              </h3>
              <div className="flex gap-4">
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
                <div className="space-y-3">
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
                          {c.fullName} ({c.email}) — {c.rank}
                        </option>
                      ))}
                    </select>
                  </div>

                  {selectedCustomer && (
                    <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-xs space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-900 dark:text-white">
                          {selectedCustomer.fullName}
                        </span>
                        <span className="px-2 py-0.5 rounded-full font-bold bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
                          Hạng {selectedCustomer.rank} (-{RANK_DISCOUNT_MAP[selectedCustomer.rank]}%)
                        </span>
                      </div>
                      <p className="text-slate-500">
                        SĐT: {selectedCustomer.phone ?? '—'} · Email: {selectedCustomer.email}
                      </p>
                      <p className="font-semibold text-blue-600 dark:text-blue-400">
                        Số đôi đang thuê: {selectedCustomer.currentRentedItems} / 5 đôi
                      </p>
                    </div>
                  )}
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
                      Phone
                    </label>
                    <input
                      type="tel"
                      value={newCustomer.phone}
                      onChange={(e) => setNewCustomer((p) => ({ ...p, phone: e.target.value }))}
                      placeholder="8–15 digits"
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
                      <option value="BRONZE">Bronze (0%)</option>
                      <option value="SILVER">Silver (-5%)</option>
                      <option value="GOLD">Gold (-10%)</option>
                      <option value="DIAMOND">Diamond (-15%)</option>
                    </select>
                  </div>
                </div>
              )}
            </section>

            <section className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary">calendar_today</span>
                  Rental period
                </h3>
                <span className="text-xs font-bold text-primary">
                  {rentalDays} ngày
                </span>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
                    Start
                  </label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => {
                      const nextStart = e.target.value
                      setStartDate(nextStart)
                      if (nextStart > endDate) {
                        setEndDate(nextStart)
                      }
                    }}
                    className="w-full rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">End</label>
                  <input
                    type="date"
                    value={endDate}
                    min={startDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2 text-sm"
                  />
                </div>
              </div>
            </section>

            {/* Voucher Counter Card */}
            <section className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-bold flex items-center gap-2 text-sm">
                  <span className="material-symbols-outlined text-primary">local_activity</span>
                  Mã giảm giá (Voucher)
                </h3>
                {appliedVoucher && (
                  <button
                    type="button"
                    onClick={handleRemoveVoucher}
                    className="text-xs font-semibold text-rose-600 hover:underline"
                  >
                    Xóa mã
                  </button>
                )}
              </div>

              {appliedVoucher ? (
                <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-900/25 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-800 dark:text-emerald-300 font-semibold">
                  Đã áp dụng: {appliedVoucher.code} (-{appliedVoucher.discountPercent}%) — {appliedVoucher.description}
                </div>
              ) : (
                <>
                  <div className="flex gap-2">
                    <input
                      value={voucherInput}
                      onChange={(e) => setVoucherInput(e.target.value.toUpperCase())}
                      placeholder="Nhập mã (vd: WELCOME10)"
                      className="flex-1 rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2 text-xs font-mono uppercase"
                    />
                    <button
                      type="button"
                      disabled={voucherLoading || !voucherInput.trim()}
                      onClick={() => void handleApplyVoucher()}
                      className="px-3.5 py-2 rounded-lg bg-primary text-white text-xs font-bold disabled:opacity-50"
                    >
                      {voucherLoading ? '...' : 'Áp dụng'}
                    </button>
                  </div>
                  {voucherError && (
                    <p className="text-xs text-rose-600">{voucherError}</p>
                  )}
                  <div className="flex flex-wrap gap-1.5">
                    {(activeVoucherPills.length > 0
                      ? activeVoucherPills
                      : [
                          { code: 'WELCOME10', discountPercent: 10 },
                          { code: 'SHOE20', discountPercent: 20 },
                          { code: 'GIAM5', discountPercent: 5 },
                        ]
                    ).map((v) => (
                      <button
                        key={v.code}
                        type="button"
                        onClick={() => void handleApplyVoucher(v.code)}
                        className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-primary/15 hover:text-primary transition-colors"
                      >
                        {v.code} (-{v.discountPercent}%)
                      </button>
                    ))}
                  </div>
                </>
              )}
            </section>
          </div>

          <div className="lg:col-span-7 space-y-6">
            <section className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary">inventory_2</span>
                  Add products
                </h3>
                {availLoading && (
                  <span className="text-xs text-slate-400">Đang kiểm tra lịch trống…</span>
                )}
              </div>
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
                          {detail.variants.map((v) => {
                            const avail = effectiveAvailable(v)
                            return (
                              <option key={v.variantId} value={v.variantId} disabled={avail <= 0}>
                                Size {v.size} · {v.color} — Còn trống {avail} đôi ({startDate} → {endDate})
                              </option>
                            )
                          })}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
                          Qty
                        </label>
                        <input
                          type="number"
                          min={1}
                          max={selectedVariant ? Math.max(1, effectiveAvailable(selectedVariant)) : 1}
                          value={lineQty}
                          onChange={(e) => setLineQty(Number(e.target.value) || 1)}
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
              <h3 className="font-bold mb-4">Line items ({totalItems} đôi)</h3>
              {lines.length === 0 ? (
                <p className="text-sm text-slate-500">No items yet.</p>
              ) : (
                <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                  {lines.map((l) => (
                    <li key={l.key} className="py-3 flex justify-between gap-4 items-start">
                      <div>
                        <div className="font-semibold">{l.shoeName}</div>
                        <div className="text-sm text-slate-500">
                          Size {l.size} · {l.color} × {l.quantity} ({formatCurrency(l.pricePerDay)}/ngày)
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

            {/* Live POS Receipt Summary */}
            <section className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm space-y-3">
              <h3 className="font-bold text-sm uppercase tracking-wider text-slate-500">
                Phiếu Tạm Tính Tại Quầy (POS Summary)
              </h3>
              <div className="space-y-1.5 text-sm">
                <div className="flex justify-between text-slate-600 dark:text-slate-400">
                  <span>Giá thuê gốc ({totalItems} đôi × {rentalDays} ngày):</span>
                  <span className="font-semibold text-slate-900 dark:text-white">
                    {formatCurrency(rawBasePrice)}
                  </span>
                </div>
                <div className="flex justify-between text-emerald-600 dark:text-emerald-400 text-xs font-semibold">
                  <span>
                    Ưu đãi hạng {activeCustomerRank} (-{rankDiscountPercent}%)
                    {appliedVoucher ? ` + Mã ${appliedVoucher.code} (-${voucherDiscountPercent}%)` : ''}:
                  </span>
                  <span>
                    -{effectiveDiscountPercent}% (-{formatCurrency(discountAmount)})
                  </span>
                </div>
                <div className="flex justify-between font-bold text-slate-900 dark:text-white pt-1 border-t border-slate-100 dark:border-slate-800">
                  <span>Tiền thuê sau ưu đãi:</span>
                  <span className="text-primary">{formatCurrency(finalRentalPrice)}</span>
                </div>
                <div className="flex justify-between text-amber-700 dark:text-amber-400 text-xs font-bold">
                  <span>Tiền đặt cọc bảo đảm (500.000₫/đôi):</span>
                  <span>{formatCurrency(depositAmount)}</span>
                </div>
                <div className="flex justify-between text-base font-black pt-2 border-t border-dashed border-slate-200 dark:border-slate-700">
                  <span>Tổng thu tại quầy (Thuê + Cọc):</span>
                  <span className="text-primary">{formatCurrency(grandTotal)}</span>
                </div>
              </div>

              <div className="pt-2">
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
                  Ghi chú đơn tại quầy (Tuỳ chọn)
                </label>
                <input
                  value={posNote}
                  maxLength={200}
                  onChange={(e) => setPosNote(e.target.value)}
                  placeholder="VD: Khách thanh toán tiền mặt + đã thu đủ tiền cọc..."
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs"
                />
              </div>

              <label className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center gap-2.5 cursor-pointer text-sm font-semibold text-slate-800 dark:text-slate-200">
                <input
                  type="checkbox"
                  checked={instantActivate}
                  onChange={(e) => setInstantActivate(e.target.checked)}
                  className="rounded border-slate-300 text-primary focus:ring-primary h-4 w-4"
                />
                <span>
                  Giao giày ngay tại quầy (Tự động chuyển sang trạng thái ĐANG THUÊ / ACTIVE)
                </span>
              </label>
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
