export type WishlistItemDto = {
  shoeId: string
  name: string
  brand: string
  category: string
  pricePerDay: number
  imagePublicId: string | null
  imageUrl: string | null
  addedAt: string
}

export type ListWishlistResponse = {
  items: WishlistItemDto[]
}
