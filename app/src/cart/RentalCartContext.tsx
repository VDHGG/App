import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { useAuth } from '../auth/AuthContext'
import type { RentalCartLine } from './rentalCartTypes'
import { clearCartStorage, loadCartFromStorage, saveCartToStorage } from './rentalCartTypes'

type AddLineInput = Omit<RentalCartLine, 'quantity'> & { quantity: number }

type RentalCartContextValue = {
  lines: RentalCartLine[]
  totalQuantity: number
  isCustomer: boolean
  hasVariantInCart: (variantId: string) => boolean
  getLine: (variantId: string) => RentalCartLine | undefined
  addOrMergeLine: (input: AddLineInput) => void
  setLineQuantity: (variantId: string, quantity: number) => void
  removeLine: (variantId: string) => void
  clearCart: () => void
}

const RentalCartContext = createContext<RentalCartContextValue | null>(null)

export function RentalCartProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const isCustomer = user?.role === 'customer' && Boolean(user?.customerId)
  const customerId = isCustomer ? user!.customerId! : null

  const [lines, setLines] = useState<RentalCartLine[]>([])

  useEffect(() => {
    if (!customerId) {
      setLines([])
      return
    }
    setLines(loadCartFromStorage(customerId))
  }, [customerId])

  useEffect(() => {
    if (!customerId) return
    saveCartToStorage(customerId, lines)
  }, [customerId, lines])

  const totalQuantity = useMemo(
    () => lines.reduce((sum, l) => sum + l.quantity, 0),
    [lines]
  )

  const hasVariantInCart = useCallback(
    (variantId: string) => lines.some((l) => l.variantId === variantId),
    [lines]
  )

  const getLine = useCallback(
    (variantId: string) => lines.find((l) => l.variantId === variantId),
    [lines]
  )

  const addOrMergeLine = useCallback((input: AddLineInput) => {
    if (!customerId) return
    const qty = Math.max(1, Math.floor(input.quantity))
    const cap = Math.max(0, input.availableQuantity)
    setLines((prev) => {
      const i = prev.findIndex((l) => l.variantId === input.variantId)
      if (i >= 0) {
        const next = [...prev]
        const merged = Math.min(next[i].quantity + qty, cap)
        next[i] = {
          ...next[i],
          quantity: merged < 1 ? 1 : merged,
          availableQuantity: cap,
          pricePerDay: input.pricePerDay,
          shoeName: input.shoeName,
          brand: input.brand,
          size: input.size,
          color: input.color,
          ...(input.imageUrlCard !== undefined ? { imageUrlCard: input.imageUrlCard } : {}),
        }
        return next
      }
      const q = Math.min(qty, cap)
      if (q < 1 || cap < 1) return prev
      return [
        ...prev,
        {
          variantId: input.variantId,
          shoeId: input.shoeId,
          shoeName: input.shoeName,
          brand: input.brand,
          size: input.size,
          color: input.color,
          pricePerDay: input.pricePerDay,
          quantity: q,
          availableQuantity: cap,
          ...(input.imageUrlCard !== undefined ? { imageUrlCard: input.imageUrlCard } : {}),
        },
      ]
    })
  }, [customerId])

  const setLineQuantity = useCallback((variantId: string, quantity: number) => {
    const q = Math.max(1, Math.floor(quantity))
    setLines((prev) => {
      const line = prev.find((l) => l.variantId === variantId)
      if (!line) return prev
      const cap = line.availableQuantity
      const nextQ = Math.min(q, cap)
      return prev.map((l) =>
        l.variantId === variantId ? { ...l, quantity: nextQ < 1 ? 1 : nextQ } : l
      )
    })
  }, [])

  const removeLine = useCallback((variantId: string) => {
    setLines((prev) => prev.filter((l) => l.variantId !== variantId))
  }, [])

  const clearCart = useCallback(() => {
    setLines([])
    clearCartStorage()
  }, [])

  const value = useMemo(
    () => ({
      lines,
      totalQuantity,
      isCustomer,
      hasVariantInCart,
      getLine,
      addOrMergeLine,
      setLineQuantity,
      removeLine,
      clearCart,
    }),
    [
      lines,
      totalQuantity,
      isCustomer,
      hasVariantInCart,
      getLine,
      addOrMergeLine,
      setLineQuantity,
      removeLine,
      clearCart,
    ]
  )

  return (
    <RentalCartContext.Provider value={value}>{children}</RentalCartContext.Provider>
  )
}

export function useRentalCart() {
  const ctx = useContext(RentalCartContext)
  if (!ctx) {
    throw new Error('useRentalCart must be used within RentalCartProvider')
  }
  return ctx
}
