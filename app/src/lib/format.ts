export function formatDate(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

export function formatCurrency(amount: number): string {
  return `$${amount.toFixed(2)}`
}

export function formatDurationDays(startDate: string, endDate: string): string {
  const start = new Date(startDate)
  const end = new Date(endDate)
  const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))
  if (days === 1) return '1 day'
  if (days === 7) return '1 week'
  return `${days} days`
}
