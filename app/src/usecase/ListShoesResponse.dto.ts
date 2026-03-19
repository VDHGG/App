export type ShoeSummary = {
  shoeId: string;
  name: string;
  brand: string;
  category: string;
  pricePerDay: number;
  variantCount: number;
};

export type ListShoesResponse = {
  shoes: ShoeSummary[];
};
