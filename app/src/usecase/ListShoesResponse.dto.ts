export type ShoeSummary = {
  shoeId: string;
  name: string;
  brand: string;
  category: string;
  pricePerDay: number;
  variantCount: number;
  isActive: boolean;
  unitsInStock: number;
  imagePublicId: string | null;
  imageUrl: string | null;
  variants: Array<{ variantId: string; size: number; color: string; totalQuantity: number }>;
};

export type ListShoesResponse = {
  shoes: ShoeSummary[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};
