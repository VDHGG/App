import type { CustomerRank } from '@domain/CustomerRank.enum';

export type CustomerSummary = {
  customerId: string;
  fullName: string;
  email: string;
  phone: string | null;
  rank: CustomerRank;
  isActive: boolean;
  currentRentedItems: number;
};

export type ListCustomersResponse = {
  customers: CustomerSummary[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};
