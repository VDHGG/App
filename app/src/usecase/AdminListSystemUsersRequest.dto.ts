export type AdminListSystemUsersRequest = {
  page?: number;
  pageSize?: number;
  search?: string;
  roleId?: number;
  isActive?: boolean;
};
