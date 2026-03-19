export type CreateRentalItemRequest = {
  variantId: string;
  quantity: number;
};

export type CreateRentalRequest = {
  customerId: string;
  items: CreateRentalItemRequest[];
  startDate: Date;
  endDate: Date;
};
