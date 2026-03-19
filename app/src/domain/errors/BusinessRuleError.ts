import { DomainError } from './DomainError';

export class BusinessRuleError extends DomainError {
  constructor(code: string, message: string) {
    super(code, message);
  }
}
