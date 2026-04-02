import type { RentalStatus } from './rentals.api'

const MS_PER_CALENDAR_DAY = 86400000

/** Mirrors domain rule: RESERVED and at least one calendar day before rental start. */
export function customerMayCancelReserved(
  startDateIso: string,
  status: RentalStatus,
  now: Date = new Date()
): boolean {
  if (status !== 'RESERVED') return false
  const start = new Date(startDateIso)
  const startDay = Date.UTC(start.getFullYear(), start.getMonth(), start.getDate())
  const atDay = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())
  return startDay - atDay >= MS_PER_CALENDAR_DAY
}
