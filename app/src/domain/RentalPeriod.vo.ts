import { ValidationError } from './errors/ValidationError';

function ensureValidDate(value: Date, fieldName: string): void {
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) {
    throw new ValidationError(`${fieldName} is invalid.`);
  }
}

function normalizeDate(value: Date): Date {
  ensureValidDate(value, 'date');
  return new Date(value.getFullYear(), value.getMonth(), value.getDate());
}

export class RentalPeriod {
  private readonly startDateValue: Date;
  private readonly endDateValue: Date;

  constructor(startDate: Date, endDate: Date) {
    const normalizedStartDate = normalizeDate(startDate);
    const normalizedEndDate = normalizeDate(endDate);

    if (normalizedEndDate < normalizedStartDate) {
      throw new ValidationError('Rental end date cannot be before start date.');
    }

    this.startDateValue = normalizedStartDate;
    this.endDateValue = normalizedEndDate;
  }

  get startDate(): Date {
    return new Date(this.startDateValue);
  }

  get endDate(): Date {
    return new Date(this.endDateValue);
  }

  get durationInDays(): number {
    const millisecondsPerDay = 24 * 60 * 60 * 1000;

    return (
      Math.floor(
        (this.endDateValue.getTime() - this.startDateValue.getTime()) / millisecondsPerDay
      ) + 1
    );
  }

  overlaps(other: RentalPeriod): boolean {
    return this.startDateValue <= other.endDateValue && other.startDateValue <= this.endDateValue;
  }

  contains(date: Date): boolean {
    const normalizedDate = normalizeDate(date);

    return normalizedDate >= this.startDateValue && normalizedDate <= this.endDateValue;
  }
}
