import { DomainError } from './DomainError';

export class NotFoundError extends DomainError {
  constructor(resource: string, id: string) {
    super(`${resource.toUpperCase()}_NOT_FOUND`, `${resource} '${id}' was not found.`);
  }
}
