export type RentalCartLine = {
  variantId: string
  shoeId: string
  shoeName: string
  brand: string
  size: number
  color: string
  pricePerDay: number
  quantity: number
  availableQuantity: number
  imageUrlCard?: string | null
}

const STORAGE_KEY = 'rentalCart_v1'

type StoredCart = {
  customerId: string
  lines: RentalCartLine[]
}

export function loadCartFromStorage(customerId: string): RentalCartLine[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as StoredCart
    if (parsed.customerId !== customerId || !Array.isArray(parsed.lines)) return []
    return parsed.lines.filter(
      (l) =>
        l &&
        typeof l.variantId === 'string' &&
        typeof l.shoeId === 'string' &&
        typeof l.quantity === 'number' &&
        l.quantity >= 1
    )
  } catch {
    return []
  }
}

export function saveCartToStorage(customerId: string, lines: RentalCartLine[]): void {
  try {
    const payload: StoredCart = { customerId, lines }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
  } catch {
  }
}

export function clearCartStorage(): void {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
  }
}
