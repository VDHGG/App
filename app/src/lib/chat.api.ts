import { api } from './api'

export type ChatTurn = { role: 'user' | 'assistant'; content: string }

export type ChatContextInput = {
  currentPath?: string
  currentShoeId?: string
}

export type ChatShoeCard = {
  shoeId: string
  name: string
  brand: string
  category: string
  pricePerDay: number
  availableSizes: number[]
  availableColors: string[]
  inStock: boolean
  availableUnits?: number
  averageRating?: number
  actionUrl: string
}

export type ChatQuoteCard = {
  shoeId: string
  shoeName: string
  brand: string
  pricePerDay: number
  days: number
  quantity: number
  startDate?: string
  endDate?: string
  rawBasePrice: number
  rank: string
  rankDiscountPercent: number
  voucherCode?: string | null
  voucherDiscountPercent: number
  effectiveDiscountPercent: number
  finalRentalPrice: number
  depositAmount: number
  grandTotal: number
  actionUrl: string
}

export type ChatResponsePayload = {
  reply: string
  mode?: string
  cards?: ChatShoeCard[]
  quote?: ChatQuoteCard
  suggestions?: string[]
}

export async function sendChatMessageRich(
  messages: ChatTurn[],
  context?: ChatContextInput
): Promise<ChatResponsePayload> {
  const { data } = await api.post<ChatResponsePayload>('/chat', {
    messages,
    ...(context ? { context } : {}),
  })
  if (data == null || typeof data.reply !== 'string') {
    throw new Error('Phản hồi chat không hợp lệ từ server.')
  }
  return {
    reply: data.reply,
    mode: data.mode,
    cards: data.cards,
    quote: data.quote,
    suggestions: data.suggestions,
  }
}

export async function sendChatMessage(
  messages: ChatTurn[],
  context?: ChatContextInput
): Promise<string> {
  const res = await sendChatMessageRich(messages, context)
  return res.reply
}
