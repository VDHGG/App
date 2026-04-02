import type { CustomerRank } from '@domain/CustomerRank.enum';

export type UpdateCustomerAdminRequest = {
  customerId: string;
  fullName: string;
  email: string;
  phone: string | null;
  rank: CustomerRank;
  isActive: boolean;
};
