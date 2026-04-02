import type { CustomerRank } from '@domain/CustomerRank.enum';

export type UpdateCustomerAdminResponse = {
  customerId: string;
  fullName: string;
  email: string;
  phone: string | null;
  rank: CustomerRank;
  isActive: boolean;
  currentRentedItems: number;
};
