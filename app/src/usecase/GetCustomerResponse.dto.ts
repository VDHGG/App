import type { CustomerRank } from '@domain/CustomerRank.enum';

export type GetCustomerResponse = {
  customerId: string;
  fullName: string;
  email: string;
  rank: CustomerRank;
  isActive: boolean;
  currentRentedItems: number;
};
