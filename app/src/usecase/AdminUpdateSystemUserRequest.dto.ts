export type AdminUpdateSystemUserRequest = {
  userId: string;
  fullName: string;
  email: string;
  phone: string | null;
  roleId: number;
  isActive: boolean;
  customerId: string | null;
  /** When set, replaces password (bcrypt hashed server-side). */
  newPassword?: string;
};
