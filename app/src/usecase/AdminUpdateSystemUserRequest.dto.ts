export type AdminUpdateSystemUserRequest = {
  userId: string;
  fullName: string;
  email: string;
  phone: string | null;
  roleId: number;
  isActive: boolean;
  customerId: string | null;
  newPassword?: string;
};
