import { DomainError } from './DomainError';

export class ConflictError extends DomainError {
  constructor(code: string, message: string) {
    super(code, message);
  }
}
