import { ValidationError } from './errors/ValidationError';
import { ensureValidDate } from './errors/validation';

function normalizeToCalendarDate(value: Date): Date {
  ensureValidDate(value, 'date');
  return new Date(value.getFullYear(), value.getMonth(), value.getDate());
}

export class RentalPeriod {
  private readonly startDateValue: Date;
  private readonly endDateValue: Date;

  constructor(startDate: Date, endDate: Date) {
    const normalizedStartDate = normalizeToCalendarDate(startDate);
    const normalizedEndDate = normalizeToCalendarDate(endDate);

    if (normalizedEndDate < normalizedStartDate) {
      throw new ValidationError('Rental end date cannot be before start date.');
    }

    this.startDateValue = normalizedStartDate;
    this.endDateValue = normalizedEndDate;
  }

  get startDate(): Date {
    return new Date(this.startDateValue.getTime());
  }

  get endDate(): Date {
    return new Date(this.endDateValue.getTime());
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
    const normalizedDate = normalizeToCalendarDate(date);

    return normalizedDate >= this.startDateValue && normalizedDate <= this.endDateValue;
  }
}
