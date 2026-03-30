import { ValidationError } from './ValidationError';

/** Short alphanumeric id (1–10 chars) used for Rental, Customer, Shoe, Variant, etc. */
export function ensureValidEntityId(id: string, entityLabel: string): void {
  if (!id || id.trim().length === 0 || id.length > 10) {
    throw new ValidationError(`${entityLabel} id must be between 1 and 10 characters.`);
  }
}

/** Rental line item references (shoe / variant) — keeps legacy error wording. */
export function ensureValidRentalItemReferenceId(
  id: string,
  partLabel: 'shoe id' | 'variant id'
): void {
  if (!id || id.trim().length === 0 || id.length > 10) {
    throw new ValidationError(`Rental item ${partLabel} is invalid.`);
  }
}

export function ensureValidDate(value: Date, fieldName: string): void {
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) {
    throw new ValidationError(`${fieldName} is invalid.`);
  }
}

/** Calendar day boundary for comparing dates without time-of-day noise. */
export function normalizeDateToCalendarTime(value: Date): number {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate()).getTime();
}

export function ensureValidNonNegativeNumber(value: number, message: string): void {
  if (typeof value !== 'number' || Number.isNaN(value) || value < 0) {
    throw new ValidationError(message);
  }
}

export function ensureValidPositiveNumber(value: number, message: string): void {
  if (typeof value !== 'number' || Number.isNaN(value) || value <= 0) {
    throw new ValidationError(message);
  }
}

export function ensureValidPositiveInteger(value: number, message: string): void {
  if (!Number.isInteger(value) || value <= 0) {
    throw new ValidationError(message);
  }
}

export function ensureValidNonNegativeInteger(value: number, message: string): void {
  if (!Number.isInteger(value) || value < 0) {
    throw new ValidationError(message);
  }
}

export function ensureValidBoundedString(
  value: string,
  minTrimmedLength: number,
  maxLength: number,
  message: string
): void {
  const t = value?.trim() ?? '';
  if (t.length < minTrimmedLength || t.length > maxLength) {
    throw new ValidationError(message);
  }
}

export function ensureValidRentalNote(note: string | null): void {
  if (note !== null && note.trim().length > 255) {
    throw new ValidationError('Note must be 255 characters or fewer.');
  }
}

export function ensureValidCustomerEmail(email: string): void {
  if (!email || email.trim().length === 0 || email.length > 255 || !email.includes('@')) {
    throw new ValidationError('Customer email is invalid.');
  }
}

/** E.164-style local digits; 8–15 characters after stripping spaces and common separators. */
export function ensureValidCustomerPhone(phone: string): void {
  const digits = phone.replace(/[\s().-]/g, '');
  if (digits.length < 8 || digits.length > 15 || !/^\d+$/.test(digits)) {
    throw new ValidationError('Phone must be 8–15 digits.');
  }
}

export function ensureValidShoeDescription(description?: string | null): void {
  if (description && description.trim().length > 500) {
    throw new ValidationError('Shoe description must be 500 characters or fewer.');
  }
}

export function ensureValidIntegerInRange(
  value: number,
  min: number,
  max: number,
  message: string
): void {
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new ValidationError(message);
  }
}

export function ensureValidAvailableQuantityNotAboveTotal(
  availableQuantity: number,
  totalQuantity: number
): void {
  if (
    !Number.isInteger(availableQuantity) ||
    availableQuantity < 0 ||
    availableQuantity > totalQuantity
  ) {
    throw new ValidationError('Available quantity must be between 0 and total quantity.');
  }
}

export function ensureValidShoeImagePublicId(value: string): void {
  if (value.length < 1 || value.length > 512) {
    throw new ValidationError('Shoe image public id is invalid.');
  }
  if (!/^[a-zA-Z0-9/_-]+$/.test(value)) {
    throw new ValidationError('Shoe image public id contains invalid characters.');
  }
}
