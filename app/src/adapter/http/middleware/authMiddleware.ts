import type { RequestHandler } from 'express';
import type { AccessTokenService } from '@port/AccessTokenService.port';
import type { AuthRole } from '@port/AccessTokenService.port';

export function createBearerAuthMiddleware(accessTokenService: AccessTokenService): RequestHandler {
  return async (req, res, next) => {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) {
      res.status(401).json({
        error: 'UNAUTHORIZED',
        message: 'Missing or invalid Authorization header.',
      });
      return;
    }

    const token = header.slice('Bearer '.length).trim();
    if (!token) {
      res.status(401).json({
        error: 'UNAUTHORIZED',
        message: 'Missing or invalid Authorization header.',
      });
      return;
    }

    try {
      const payload = await accessTokenService.verifyAccessToken(token);
      req.auth = payload;
      next();
    } catch {
      res.status(401).json({
        error: 'UNAUTHORIZED',
        message: 'Invalid or expired token.',
      });
    }
  };
}

export function createRequireRolesMiddleware(...roles: AuthRole[]): RequestHandler {
  return (req, res, next) => {
    if (!req.auth) {
      res.status(401).json({
        error: 'UNAUTHORIZED',
        message: 'Authentication required.',
      });
      return;
    }

    if (!roles.includes(req.auth.role)) {
      res.status(403).json({
        error: 'FORBIDDEN',
        message: 'Insufficient permissions.',
      });
      return;
    }

    next();
  };
}
