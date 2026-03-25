import type { RentalStatus } from '../../lib/rentals.api'

const STATUS_STYLES: Record<
  RentalStatus,
  string
> = {
  RESERVED: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400',
  ACTIVE: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400',
  RETURNED: 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400',
  CANCELLED: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400',
}

type RentalStatusBadgeProps = {
  status: RentalStatus
}

export function RentalStatusBadge({ status }: RentalStatusBadgeProps) {
  return (
    <span
      className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${STATUS_STYLES[status] ?? 'bg-slate-100 text-slate-600'}`}
    >
      {status}
    </span>
  )
}
