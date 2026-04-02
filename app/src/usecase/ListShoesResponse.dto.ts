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
};

export type ListShoesResponse = {
  shoes: ShoeSummary[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};
