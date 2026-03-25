export type AddShoeResponse = {
  shoeId: string;
  name: string;
  brand: string;
  category: string;
  pricePerDay: number;
  variantCount: number;
  variantIds: string[];
  imagePublicId: string | null;
};
