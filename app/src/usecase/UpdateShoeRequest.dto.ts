export type VariantQuantityUpdate = {
  variantId: string;
  totalQuantity: number;
};

export type NewVariantInput = {
  size: number;
  color: string;
  totalQuantity: number;
};

export type UpdateShoeRequest = {
  shoeId: string;
  name?: string;
  brand?: string;
  category?: string;
  description?: string | null;
  pricePerDay?: number;
  isActive?: boolean;
  imagePublicId?: string | null;
  variantQuantityUpdates?: VariantQuantityUpdate[];
  newVariants?: NewVariantInput[];
};
