import { RentalItem } from './RentalItem.vo';
import { RentalPeriod } from './RentalPeriod.vo';
import { RentalStatus } from './RentalStatus.enum';
import { ValidationError } from './errors/ValidationError';
import { BusinessRuleError } from './errors/BusinessRuleError';

export type RentalProps = {
  id: string;
  customerId: string;
  items: RentalItem[];
  period: RentalPeriod;   
  status?: RentalStatus;
  lateFee?: number;
  note?: string | null;
  createdAt?: Date;
  activatedAt?: Date | null;
  returnedAt?: Date | null;
  cancelledAt?: Date | null;
};

function ensureValidRentalId(id: string, label: string): void {
  if (!id || id.trim().length === 0 || id.length > 10) {
    throw new ValidationError(`${label} id must be between 1 and 10 characters.`);
  }
}

function ensureValidRentalDate(value: Date, fieldName: string): void {
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) {
    throw new ValidationError(`${fieldName} is invalid.`);
  }
}

function ensureValidRentalLateFee(lateFee: number): void {
  if (typeof lateFee !== 'number' || Number.isNaN(lateFee) || lateFee < 0) {
    throw new ValidationError('Late fee must be a non-negative number.');
  }
}

function ensureValidRentalNote(note: string | null): void {
  if (note !== null && note.trim().length > 255) {
    throw new ValidationError('Note must be 255 characters or fewer.');
  }
}

function ensureValidRentalItems(items: RentalItem[]): void {
  if (!items || items.length === 0) {
    throw new ValidationError('Rental must contain at least one item.');
  }

  const variantIds = new Set<string>();

  for (const item of items) {
    if (variantIds.has(item.variantId)) {
      throw new ValidationError(
        `Duplicate variant ${item.variantId} in the same rental is not allowed.`
      );
    }

    variantIds.add(item.variantId);
  }
}

function normalizeDateToTime(value: Date): number {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate()).getTime();
}

function calculateLateFee(
  basePrice: number,
  durationInDays: number,
  expectedReturnDate: Date,
  actualReturnDate: Date
): number {
  const expectedTime = normalizeDateToTime(expectedReturnDate);
  const actualTime = normalizeDateToTime(actualReturnDate);

  if (actualTime <= expectedTime) return 0;

  const overdueDays = Math.floor((actualTime - expectedTime) / (24 * 60 * 60 * 1000));
  if (overdueDays <= 0) return 0;

  const dailyRate = basePrice / durationInDays;
  const lateFeePerDay = dailyRate * 0.5;

  return Math.round(overdueDays * lateFeePerDay);
}

export class Rental {
  private readonly idValue: string;
  private readonly customerIdValue: string;
  private readonly itemsValue: RentalItem[];
  private readonly periodValue: RentalPeriod;
  private statusValue: RentalStatus;
  private lateFeeValue: number;
  private noteValue: string | null;
  private readonly createdAtValue: Date;
  private activatedAtValue: Date | null;
  private returnedAtValue: Date | null;
  private cancelledAtValue: Date | null;

  constructor(props: RentalProps) {
    const status = props.status ?? RentalStatus.RESERVED;
    const lateFee = props.lateFee ?? 0;
    const note = props.note ?? null;
    const createdAt = props.createdAt ?? new Date();
    const activatedAt = props.activatedAt ?? null;
    const returnedAt = props.returnedAt ?? null;
    const cancelledAt = props.cancelledAt ?? null;

    ensureValidRentalId(props.id, 'Rental');
    ensureValidRentalId(props.customerId, 'Customer');
    ensureValidRentalItems(props.items);
    ensureValidRentalLateFee(lateFee);
    ensureValidRentalNote(note);
    ensureValidRentalDate(createdAt, 'createdAt');

    if (activatedAt) {
      ensureValidRentalDate(activatedAt, 'activatedAt');
    }

    if (returnedAt) {
      ensureValidRentalDate(returnedAt, 'returnedAt');
    }

    if (cancelledAt) {
      ensureValidRentalDate(cancelledAt, 'cancelledAt');
    }

    this.idValue = props.id.trim();
    this.customerIdValue = props.customerId.trim();
    this.itemsValue = [...props.items];
    this.periodValue = props.period;
    this.statusValue = status;
    this.lateFeeValue = lateFee;
    this.noteValue = note ? note.trim() : null;
    this.createdAtValue = new Date(createdAt.getTime());
    this.activatedAtValue = activatedAt ? new Date(activatedAt.getTime()) : null;
    this.returnedAtValue = returnedAt ? new Date(returnedAt.getTime()) : null;
    this.cancelledAtValue = cancelledAt ? new Date(cancelledAt.getTime()) : null;

    this.ensureStateConsistency();
  }

  get id(): string {
    return this.idValue;
  }

  get customerId(): string {
    return this.customerIdValue;
  }

  get items(): ReadonlyArray<RentalItem> {
    return Object.freeze([...this.itemsValue]);
  }

  get period(): RentalPeriod {
    return this.periodValue;
  }

  get status(): RentalStatus {
    return this.statusValue;
  }

  get lateFee(): number {
    return this.lateFeeValue;
  }

  get note(): string | null {
    return this.noteValue;
  }

  get createdAt(): Date {
    return new Date(this.createdAtValue.getTime());
  }

  get activatedAt(): Date | null {
    return this.activatedAtValue ? new Date(this.activatedAtValue.getTime()) : null;
  }

  get returnedAt(): Date | null {
    return this.returnedAtValue ? new Date(this.returnedAtValue.getTime()) : null;
  }

  get cancelledAt(): Date | null {
    return this.cancelledAtValue ? new Date(this.cancelledAtValue.getTime()) : null;
  }

  get totalItems(): number {
    return this.itemsValue.reduce((sum, item) => sum + item.quantity, 0);
  }

  get basePrice(): number {
    return this.itemsValue.reduce(
      (sum, item) => sum + item.subtotalFor(this.periodValue.durationInDays),
      0
    );
  }

  get totalAmount(): number {
    return this.basePrice + this.lateFeeValue;
  }

  isOverdue(at: Date = new Date()): boolean {
    if (
      this.statusValue === RentalStatus.RETURNED ||
      this.statusValue === RentalStatus.CANCELLED
    ) {
      return false;
    }

    ensureValidRentalDate(at, 'at');

    return normalizeDateToTime(at) > normalizeDateToTime(this.periodValue.endDate);
  }

  activate(at: Date = new Date()): void {
    if (this.statusValue !== RentalStatus.RESERVED) {
      throw new BusinessRuleError(
        'INVALID_RENTAL_STATE',
        `Only RESERVED rental can be activated. Current status: ${this.statusValue}.`
      );
    }

    ensureValidRentalDate(at, 'activatedAt');

    this.statusValue = RentalStatus.ACTIVE;
    this.activatedAtValue = new Date(at.getTime());
  }

  completeReturn(returnedAt: Date = new Date(), note?: string): void {
    if (
      this.statusValue !== RentalStatus.RESERVED &&
      this.statusValue !== RentalStatus.ACTIVE
    ) {
      throw new BusinessRuleError(
        'INVALID_RENTAL_STATE',
        `Only RESERVED or ACTIVE rental can be returned. Current status: ${this.statusValue}.`
      );
    }

    ensureValidRentalDate(returnedAt, 'returnedAt');
    ensureValidRentalNote(note ?? null);

    const lateFee = calculateLateFee(
      this.basePrice,
      this.periodValue.durationInDays,
      this.periodValue.endDate,
      returnedAt
    );

    this.statusValue = RentalStatus.RETURNED;
    this.returnedAtValue = new Date(returnedAt.getTime());
    this.lateFeeValue = lateFee;

    if (note !== undefined) {
      this.noteValue = note ? note.trim() : null;
    }
  }

  cancel(at: Date = new Date(), note?: string): void {
    if (this.statusValue !== RentalStatus.RESERVED) {
      throw new BusinessRuleError(
        'INVALID_RENTAL_STATE',
        `Only RESERVED rental can be cancelled. Current status: ${this.statusValue}.`
      );
    }

    ensureValidRentalDate(at, 'cancelledAt');
    ensureValidRentalNote(note ?? null);

    this.statusValue = RentalStatus.CANCELLED;
    this.cancelledAtValue = new Date(at.getTime());

    if (note !== undefined) {
      this.noteValue = note ? note.trim() : null;
    }
  }

  hasVariant(variantId: string): boolean {
    return this.itemsValue.some((item) => item.variantId === variantId);
  }

  getQuantityForVariant(variantId: string): number {
    return this.itemsValue
      .filter((item) => item.variantId === variantId)
      .reduce((sum, item) => sum + item.quantity, 0);
  }

  private ensureStateConsistency(): void {
    if (this.statusValue === RentalStatus.ACTIVE && this.activatedAtValue === null) {
      throw new ValidationError('ACTIVE rental must have activatedAt.');
    }

    if (this.statusValue === RentalStatus.RETURNED && this.returnedAtValue === null) {
      throw new ValidationError('RETURNED rental must have returnedAt.');
    }

    if (this.statusValue === RentalStatus.CANCELLED && this.cancelledAtValue === null) {
      throw new ValidationError('CANCELLED rental must have cancelledAt.');
    }

    if (this.statusValue !== RentalStatus.RETURNED && this.lateFeeValue !== 0) {
      throw new ValidationError('Late fee can only exist on RETURNED rental.');
    }
  }
}
