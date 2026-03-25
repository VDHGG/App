import { DomainError } from './DomainError';

export class UnauthorizedError extends DomainError {
  constructor(code: string = 'UNAUTHORIZED', message: string = 'Authentication failed.') {
    super(code, message);
  }
}
