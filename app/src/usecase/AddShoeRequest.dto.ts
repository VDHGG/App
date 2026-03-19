export type AddShoeVariantRequest = {
  size: number;
  color: string;
  totalQuantity: number;
};

export type AddShoeRequest = {
  name: string;
  brand: string;
  category: string;
  description?: string;
  pricePerDay: number;
  variants: AddShoeVariantRequest[];
};
