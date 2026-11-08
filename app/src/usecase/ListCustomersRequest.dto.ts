export type ListCustomersRequest = {
  page?: number;
  pageSize?: number;
  search?: string;
  rank?: 'BRONZE' | 'SILVER' | 'GOLD' | 'DIAMOND';
  isActive?: boolean;
};
