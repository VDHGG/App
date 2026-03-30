import type { CustomerRank } from '@domain/CustomerRank.enum';

export type RegisterCustomerRequest = {
  fullName: string;
  email: string;
  phone: string;
  rank?: CustomerRank;
};
