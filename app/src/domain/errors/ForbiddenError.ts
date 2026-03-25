import { DomainError } from './DomainError';

export class ForbiddenError extends DomainError {
  constructor(code: string = 'FORBIDDEN', message: string = 'Access denied.') {
    super(code, message);
  }
}
