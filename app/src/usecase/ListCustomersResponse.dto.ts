import type { CustomerRank } from '@domain/CustomerRank.enum';

export type CustomerSummary = {
  customerId: string;
  fullName: string;
  email: string;
  rank: CustomerRank;
  currentRentedItems: number;
};

export type ListCustomersResponse = {
  customers: CustomerSummary[];
};
