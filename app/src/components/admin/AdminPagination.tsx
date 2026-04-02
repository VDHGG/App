import { DEFAULT_PAGE_SIZE } from '../../lib/pagination'

type AdminPaginationProps = {
  page: number
  totalPages: number
  total: number
  pageSize?: number
  onPageChange: (nextPage: number) => void
  className?: string
}

export function AdminPagination({
  page,
  totalPages,
  total,
  pageSize = DEFAULT_PAGE_SIZE,
  onPageChange,
  className = '',
}: AdminPaginationProps) {
  if (totalPages <= 1) {
    return (
      <p className={`text-sm text-slate-500 ${className}`}>
        {total} item{total === 1 ? '' : 's'}
      </p>
    )
  }

  const from = total === 0 ? 0 : (page - 1) * pageSize + 1
  const to = Math.min(page * pageSize, total)

  return (
    <div className={`flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 ${className}`}>
      <p className="text-sm text-slate-500">
        Showing {from}–{to} of {total}
      </p>
      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          className="px-3 py-1.5 rounded-lg text-sm font-semibold border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 dark:hover:bg-slate-800"
        >
          Previous
        </button>
        <span className="text-sm text-slate-600 dark:text-slate-400 tabular-nums px-1">
          Page {page} / {totalPages}
        </span>
        <button
          type="button"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
          className="px-3 py-1.5 rounded-lg text-sm font-semibold border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 dark:hover:bg-slate-800"
        >
          Next
        </button>
      </div>
    </div>
  )
}
