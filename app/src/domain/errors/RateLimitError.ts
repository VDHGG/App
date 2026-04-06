import { DomainError } from './DomainError';

/** Too many requests (e.g. payment initiation rate limit). */
export class RateLimitError extends DomainError {
  constructor(code: string, message: string) {
    super(code, message);
  }
}
