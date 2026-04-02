export type SystemUserRecord = {
  userId: string;
  fullName: string;
  email: string;
  phone: string | null;
  roleId: number;
  passwordHash: string | null;
  customerId: string | null;
  isActive: boolean;
};

export type NewSystemUserRecord = {
  userId: string;
  fullName: string;
  email: string;
  phone: string | null;
  roleId: number;
  passwordHash: string;
  customerId: string | null;
  isActive: boolean;
};

export type SystemUserContactUpdate = {
  fullName: string;
  email: string;
  phone: string | null;
};

export type SystemUserAdminUpdate = {
  fullName: string;
  email: string;
  phone: string | null;
  roleId: number;
  isActive: boolean;
  customerId: string | null;
};

export type ListSystemUsersOptions = {
  limit: number;
  offset: number;
  search?: string;
};

export type ListSystemUsersResult = {
  items: SystemUserRecord[];
  total: number;
};

export interface SystemUserRepository {
  findByEmail(email: string): Promise<SystemUserRecord | null>;
  findByEmailExcluding(email: string, excludeUserId: string): Promise<SystemUserRecord | null>;
  findById(userId: string): Promise<SystemUserRecord | null>;
  findByCustomerId(customerId: string): Promise<SystemUserRecord | null>;
  save(user: NewSystemUserRecord): Promise<void>;
  updateContactFields(userId: string, fields: SystemUserContactUpdate): Promise<void>;
  updatePasswordHash(userId: string, passwordHash: string): Promise<void>;
  listForAdmin(options: ListSystemUsersOptions): Promise<ListSystemUsersResult>;
  countActiveAdminsExcluding(excludeUserId: string): Promise<number>;
  updateAdminFields(userId: string, fields: SystemUserAdminUpdate): Promise<void>;
  updateMirrorFromCustomer(
    userId: string,
    fields: { fullName: string; email: string; phone: string | null; isActive: boolean }
  ): Promise<void>;
}
