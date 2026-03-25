import type { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { DomainError } from '@domain/errors/DomainError';
import { ValidationError } from '@domain/errors/ValidationError';
import { NotFoundError } from '@domain/errors/NotFoundError';
import { ConflictError } from '@domain/errors/ConflictError';
import { BusinessRuleError } from '@domain/errors/BusinessRuleError';
import { UnauthorizedError } from '@domain/errors/UnauthorizedError';
import { ForbiddenError } from '@domain/errors/ForbiddenError';

function statusFor(err: DomainError): number {
  if (err instanceof NotFoundError) return 404;
  if (err instanceof ConflictError) return 409;
  if (err instanceof BusinessRuleError) return 422;
  if (err instanceof ValidationError) return 400;
  if (err instanceof UnauthorizedError) return 401;
  if (err instanceof ForbiddenError) return 403;
  return 400;
}

function isMulterLimitFileSize(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    (err as { name?: string }).name === 'MulterError' &&
    (err as { code?: string }).code === 'LIMIT_FILE_SIZE'
  );
}

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  if (err instanceof ZodError) {
    res.status(400).json({
      error: 'VALIDATION_ERROR',
      message: 'Request validation failed.',
      details: err.issues.map((e) => ({ field: e.path.join('.'), message: e.message })),
    });
    return;
  }

  if (isMulterLimitFileSize(err)) {
    res.status(400).json({
      error: 'FILE_TOO_LARGE',
      message: 'Image must be 2 MB or smaller.',
    });
    return;
  }

  if (err instanceof DomainError) {
    res.status(statusFor(err)).json({
      error: err.code,
      message: err.message,
    });
    return;
  }

  console.error('[Unhandled error]', err);
  res.status(500).json({
    error: 'INTERNAL_SERVER_ERROR',
    message: 'An unexpected error occurred.',
  });
}
