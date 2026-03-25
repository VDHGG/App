export type ShoeVariantDto = {
  variantId: string;
  size: number;
  color: string;
  totalQuantity: number;
  availableQuantity: number;
};

export type GetShoeResponse = {
  shoeId: string;
  name: string;
  brand: string;
  category: string;
  description: string | null;
  pricePerDay: number;
  isActive: boolean;
  imagePublicId: string | null;
  imageUrlCard: string | null;
  imageUrlDetail: string | null;
  variants: ShoeVariantDto[];
};
