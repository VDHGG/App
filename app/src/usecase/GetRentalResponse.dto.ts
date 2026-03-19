import type { RentalStatus } from '@domain/RentalStatus.enum';

export type RentalItemDto = {
  shoeId: string;
  variantId: string;
  shoeName: string;
  size: number;
  color: string;
  pricePerDay: number;
  quantity: number;
};

export type GetRentalResponse = {
  rentalId: string;
  customerId: string;
  status: RentalStatus;
  totalItems: number;
  basePrice: number;
  lateFee: number;
  totalAmount: number;
  startDate: Date;
  endDate: Date;
  items: RentalItemDto[];
  note: string | null;
  createdAt: Date;
  activatedAt: Date | null;
  returnedAt: Date | null;
  cancelledAt: Date | null;
};
