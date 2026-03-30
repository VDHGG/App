import { SignJWT, jwtVerify } from 'jose';
import type {
  AccessTokenPayload,
  AccessTokenService,
  AuthRole,
} from '@port/AccessTokenService.port';

function isAuthRole(value: unknown): value is AuthRole {
  return value === 'admin' || value === 'customer';
}

export class JoseAccessTokenService implements AccessTokenService {
  private readonly encodedKey: Uint8Array;
  private readonly expiresIn: string;

  constructor(secret: string, expiresIn: string) {
    if (!secret || secret.length < 16) {
      throw new Error('JWT_SECRET must be set and at least 16 characters long.');
    }
    this.encodedKey = new TextEncoder().encode(secret);
    this.expiresIn = expiresIn;
  }

  async createAccessToken(payload: AccessTokenPayload): Promise<string> {
    const body: Record<string, unknown> = { role: payload.role };
    if (payload.customerId) {
      body.customerId = payload.customerId;
    }
    return new SignJWT(body)
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(payload.sub)
      .setIssuedAt()
      .setExpirationTime(this.expiresIn)
      .sign(this.encodedKey);
  }

  async verifyAccessToken(token: string): Promise<AccessTokenPayload> {
    const { payload } = await jwtVerify(token, this.encodedKey);
    const sub = payload.sub;
    const role = payload.role;
    const customerIdRaw = payload.customerId;
    if (typeof sub !== 'string' || !isAuthRole(role)) {
      throw new Error('Invalid access token payload.');
    }
    const out: AccessTokenPayload = { sub, role };
    if (typeof customerIdRaw === 'string' && customerIdRaw.length > 0) {
      out.customerId = customerIdRaw;
    }
    return out;
  }
}
