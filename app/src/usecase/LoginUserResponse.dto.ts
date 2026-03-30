import type { AuthRole } from '@port/AccessTokenService.port';

export type LoginUserResponse = {
  accessToken: string;
  tokenType: 'Bearer';
  role: AuthRole;
  customerId: string | null;
};
