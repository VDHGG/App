import type { AuthRole } from '@port/AccessTokenService.port';

export type UpdateProfileResponse = {
  sub: string;
  role: AuthRole;
  customerId: string | null;
  fullName: string;
  email: string;
  phone: string | null;
};
