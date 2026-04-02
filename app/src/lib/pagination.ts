export const DEFAULT_PAGE_SIZE = 10
export const MAX_PAGE_SIZE = 50

export function normalizePage(page: number | undefined): number {
  if (page === undefined || !Number.isFinite(page)) return 1
  return Math.max(1, Math.floor(page))
}

export function normalizePageSize(size: number | undefined): number {
  if (size === undefined || !Number.isFinite(size)) return DEFAULT_PAGE_SIZE
  return Math.min(MAX_PAGE_SIZE, Math.max(1, Math.floor(size)))
}

export function totalPages(total: number, pageSize: number): number {
  if (pageSize <= 0) return 0
  return Math.max(1, Math.ceil(total / pageSize))
}
