import type { GetRentalResponse } from '../lib/rentals.api'
import { formatCurrency, formatDate } from '../lib/format'

export type RentalTimelineProps = {
  rental: GetRentalResponse
  paymentStatus?: 'PENDING' | 'PAID' | 'FAILED' | 'EXPIRED' | 'CANCELLED' | null
}

type TimelineStepStatus = 'done' | 'current' | 'upcoming' | 'error' | 'cancelled'

type TimelineStep = {
  key: string
  title: string
  timestamp: string
  subtitle: string
  badge?: string | null
  status: TimelineStepStatus
  icon: string
}

export function RentalTimeline({ rental, paymentStatus }: RentalTimelineProps) {
  const note = rental.note ?? ''
  const discountMatch = note.match(/\[Ưu đãi:[^\]]+\]/)
  const extensionMatch = note.match(/\[Gia hạn đến ([^\]]+)\]/)
  const inspectionMatch = note.match(/\[Kiểm định trả giày: ([^\]]+)\]/)

  const paymentDone =
    paymentStatus === 'PAID' || rental.status === 'ACTIVE' || rental.status === 'RETURNED'
  const paymentError = paymentStatus === 'EXPIRED' || paymentStatus === 'FAILED'
  const paymentStepStatus: TimelineStepStatus = paymentDone
    ? 'done'
    : paymentError
      ? 'error'
      : rental.status === 'RESERVED'
        ? 'current'
        : 'cancelled'

  const momoLabel =
    paymentStatus === 'PAID'
      ? 'MoMo PAID'
      : paymentStatus === 'PENDING'
        ? 'MoMo PENDING'
        : paymentStatus === 'EXPIRED'
          ? 'MoMo EXPIRED'
          : paymentStatus === 'FAILED'
            ? 'MoMo FAILED'
            : 'COD / Thanh toán tại quầy'

  const depositText = `Cọc: ${formatCurrency(rental.depositAmount ?? rental.totalItems * 500000)}`

  const activeDone =
    Boolean(rental.activatedAt) || rental.status === 'ACTIVE' || rental.status === 'RETURNED'
  const activeStepStatus: TimelineStepStatus = activeDone
    ? 'done'
    : rental.status === 'RESERVED'
      ? 'current'
      : 'cancelled'

  const steps: TimelineStep[] = [
    {
      key: 'reserved',
      title: 'Đặt đơn (RESERVED)',
      timestamp: formatDate(rental.createdAt),
      subtitle: `Thuê ${rental.totalItems} đôi (${formatDate(rental.startDate)} → ${formatDate(rental.endDate)})`,
      status: 'done',
      icon: 'shopping_bag',
    },
    {
      key: 'payment',
      title: 'Thanh toán & Đặt cọc',
      timestamp: momoLabel,
      subtitle: `${depositText} · Tổng: ${formatCurrency(rental.totalAmount)}`,
      badge: discountMatch ? discountMatch[0].replace(/^\[|\]$/g, '') : null,
      status: paymentStepStatus,
      icon: 'payments',
    },
    {
      key: 'active',
      title: 'Kích hoạt giao giày (ACTIVE)',
      timestamp: rental.activatedAt ? formatDate(rental.activatedAt) : 'Chờ nhận giày',
      subtitle: activeDone
        ? 'Đã bàn giao giày tại cửa hàng / vận chuyển'
        : rental.status === 'CANCELLED'
          ? 'Đơn đã hủy trước khi nhận giày'
          : 'Khách hàng nhận giày theo lịch hẹn',
      status: activeStepStatus,
      icon: 'local_shipping',
    },
  ]

  if (extensionMatch) {
    steps.push({
      key: 'extended',
      title: 'Gia hạn thời gian thuê',
      timestamp: `Gia hạn đến ${extensionMatch[1]}`,
      subtitle: `Hạn trả mới: ${formatDate(rental.endDate)}`,
      status: 'done',
      icon: 'edit_calendar',
    })
  }

  if (rental.status === 'CANCELLED') {
    const cleanReason = note
      .replace(/\[Ưu đãi:[^\]]+\]\s*/g, '')
      .replace(/\[Gia hạn đến [^\]]+\]\s*/g, '')
      .trim()
    steps.push({
      key: 'cancelled',
      title: 'Đã hủy đơn (CANCELLED)',
      timestamp: rental.cancelledAt ? formatDate(rental.cancelledAt) : 'Đã hủy',
      subtitle: cleanReason || 'Đơn thuê đã được hủy và hoàn trả tồn kho',
      status: 'error',
      icon: 'cancel',
    })
  } else {
    const returnStatus: TimelineStepStatus =
      rental.status === 'RETURNED'
        ? 'done'
        : rental.status === 'ACTIVE'
          ? 'current'
          : 'upcoming'
    const inspectionText = inspectionMatch
      ? `Kiểm định: ${inspectionMatch[1]}`
      : rental.lateFee > 0
        ? `Phụ phí / Trễ hạn: +${formatCurrency(rental.lateFee)}`
        : rental.isOverdue && (rental.overdueDays ?? 0) > 0
          ? `Đang quá hạn ${rental.overdueDays} ngày (+${formatCurrency(rental.estimatedLateFee ?? 0)})`
          : 'Hoàn trả giày & đối soát tiền cọc'

    steps.push({
      key: 'returned',
      title: 'Trả giày & Kiểm định (RETURNED)',
      timestamp: rental.returnedAt
        ? formatDate(rental.returnedAt)
        : `Hạn trả: ${formatDate(rental.endDate)}`,
      subtitle: inspectionText,
      status: returnStatus,
      icon: 'task_alt',
    })
  }

  function getCircleClass(status: TimelineStepStatus): string {
    switch (status) {
      case 'done':
        return 'bg-emerald-500 text-white ring-4 ring-emerald-500/15'
      case 'current':
        return 'bg-blue-600 text-white ring-4 ring-blue-500/20'
      case 'error':
        return 'bg-rose-500 text-white ring-4 ring-rose-500/15'
      case 'cancelled':
        return 'bg-slate-200 dark:bg-slate-800 text-slate-400'
      case 'upcoming':
      default:
        return 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30'
    }
  }

  function getBadgeClass(status: TimelineStepStatus): string {
    switch (status) {
      case 'done':
        return 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300'
      case 'current':
        return 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
      case 'error':
        return 'bg-rose-50 dark:bg-rose-900/30 text-rose-700 dark:text-rose-300'
      case 'cancelled':
        return 'bg-slate-100 dark:bg-slate-800 text-slate-500'
      case 'upcoming':
      default:
        return 'bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300'
    }
  }

  return (
    <div
      data-testid="rental-timeline"
      className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 p-4"
    >
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-xs font-black uppercase tracking-wider text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
          <span className="material-symbols-outlined text-base text-primary">timeline</span>
          Tiến trình Vòng đời Đơn thuê
        </h4>
        <span className="text-[11px] font-semibold text-slate-400">
          #{rental.rentalId}
        </span>
      </div>

      <ol className="relative space-y-3 before:absolute before:left-[15px] before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200 dark:before:bg-slate-700">
        {steps.map((step) => (
          <li key={step.key} className="relative flex items-start gap-3 pl-0">
            <div
              className={`relative z-10 size-8 rounded-full flex items-center justify-center shrink-0 transition-colors ${getCircleClass(
                step.status
              )}`}
            >
              <span className="material-symbols-outlined text-[16px] leading-none">
                {step.icon}
              </span>
            </div>
            <div className="flex-1 min-w-0 pt-0.5">
              <div className="flex flex-wrap items-center justify-between gap-1">
                <p className="text-xs font-bold text-slate-900 dark:text-white">
                  {step.title}
                </p>
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${getBadgeClass(
                    step.status
                  )}`}
                >
                  {step.timestamp}
                </span>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                {step.subtitle}
              </p>
              {step.badge && (
                <span className="inline-block mt-1 px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-50 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300">
                  {step.badge}
                </span>
              )}
            </div>
          </li>
        ))}
      </ol>
    </div>
  )
}
