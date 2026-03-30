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

export interface SystemUserRepository {
  findByEmail(email: string): Promise<SystemUserRecord | null>;
  findById(userId: string): Promise<SystemUserRecord | null>;
  save(user: NewSystemUserRecord): Promise<void>;
  updateContactFields(userId: string, fields: SystemUserContactUpdate): Promise<void>;
  updatePasswordHash(userId: string, passwordHash: string): Promise<void>;
}
