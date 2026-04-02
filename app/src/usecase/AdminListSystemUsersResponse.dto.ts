export type SystemUserSummaryDto = {
  userId: string;
  fullName: string;
  email: string;
  phone: string | null;
  roleId: number;
  customerId: string | null;
  isActive: boolean;
};

export type AdminListSystemUsersResponse = {
  users: SystemUserSummaryDto[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};
