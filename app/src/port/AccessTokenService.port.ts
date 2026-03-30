export type AuthRole = 'admin' | 'customer';

export type AccessTokenPayload = {
  sub: string;
  role: AuthRole;
  customerId?: string;
};

export interface AccessTokenService {
  createAccessToken(payload: AccessTokenPayload): Promise<string>;
  verifyAccessToken(token: string): Promise<AccessTokenPayload>;
}
