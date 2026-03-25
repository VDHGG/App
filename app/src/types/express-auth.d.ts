import type { AccessTokenPayload } from '@port/AccessTokenService.port';

declare global {
  namespace Express {
    interface Request {
      auth?: AccessTokenPayload;
    }
  }
}

export {};
