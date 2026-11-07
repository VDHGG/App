import { RentalItem } from './RentalItem.vo';
import { RentalPeriod } from './RentalPeriod.vo';
import { RentalStatus } from './RentalStatus.enum';
import { ValidationError } from './errors/ValidationError';
import { BusinessRuleError } from './errors/BusinessRuleError';
import { ForbiddenError } from './errors/ForbiddenError';
import {
  ensureValidDate,
  ensureValidEntityId,
  ensureValidNonNegativeNumber,
  ensureValidRentalNote,
  normalizeDateToCalendarTime,
} from './errors/validation';

const MS_PER_CALENDAR_DAY = 24 * 60 * 60 * 1000;

function mergeNotePreservingDiscountTag(
  existingNote: string | null,
  incomingNote: string | undefined,
  suffixTag?: string
): string | null {
  const discountMatch = existingNote?.match(/\[Ưu đãi:[^\]]+\]/);
  const discountTag = discountMatch ? discountMatch[0] : '';

  let base =
    incomingNote !== undefined
      ? incomingNote
        ? incomingNote.trim()
        : ''
      : (existingNote ?? '');

  if (discountTag && !base.includes(discountTag)) {
    base = base.length > 0 ? `${base} ${discountTag}` : discountTag;
  }

  if (suffixTag) {
    if (base.length > 0) {
      const maxPrefix = Math.max(0, 255 - suffixTag.length - 1);
      const trimmedPrefix = base.length > maxPrefix ? base.slice(0, maxPrefix).trimEnd() : base;
      return trimmedPrefix.length > 0 ? `${trimmedPrefix} ${suffixTag}` : suffixTag;
    }
    return suffixTag.slice(0, 255);
  }

  if (base.length === 0) {
    return null;
  }
  return base.slice(0, 255);
}

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

export class Rental {
  private readonly idValue: string;
  private readonly customerIdValue: string;
  private readonly itemsValue: RentalItem[];
  private periodValue: RentalPeriod;
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

    ensureValidEntityId(props.id, 'Rental');
    ensureValidEntityId(props.customerId, 'Customer');
    ensureValidRentalItems(props.items);
    ensureValidNonNegativeNumber(lateFee, 'Late fee must be a non-negative number.');
    ensureValidRentalNote(note);
    ensureValidDate(createdAt, 'createdAt');

    if (activatedAt) {
      ensureValidDate(activatedAt, 'activatedAt');
    }

    if (returnedAt) {
      ensureValidDate(returnedAt, 'returnedAt');
    }

    if (cancelledAt) {
      ensureValidDate(cancelledAt, 'cancelledAt');
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

  get depositAmount(): number {
    return this.totalItems * 500000;
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

    ensureValidDate(at, 'at');

    return (
      normalizeDateToCalendarTime(at) > normalizeDateToCalendarTime(this.periodValue.endDate)
    );
  }

  activate(at: Date = new Date()): void {
    if (this.statusValue !== RentalStatus.RESERVED) {
      throw new BusinessRuleError(
        'INVALID_RENTAL_STATE',
        `Only RESERVED rental can be activated. Current status: ${this.statusValue}.`
      );
    }

    ensureValidDate(at, 'activatedAt');

    this.statusValue = RentalStatus.ACTIVE;
    this.activatedAtValue = new Date(at.getTime());
  }

  completeReturn(returnedAt: Date = new Date(), note?: string, damageFee: number = 0): void {
    if (
      this.statusValue !== RentalStatus.RESERVED &&
      this.statusValue !== RentalStatus.ACTIVE
    ) {
      throw new BusinessRuleError(
        'INVALID_RENTAL_STATE',
        `Only RESERVED or ACTIVE rental can be returned. Current status: ${this.statusValue}.`
      );
    }

    ensureValidDate(returnedAt, 'returnedAt');
    ensureValidRentalNote(note ?? null);

    if (!Number.isFinite(damageFee) || damageFee < 0) {
      throw new ValidationError('Damage fee cannot be negative.');
    }

    const cleanDamageFee = Math.round(damageFee);

    const lateFee = this.calculateLateFeeForReturn(
      this.basePrice,
      this.periodValue.durationInDays,
      this.periodValue.endDate,
      returnedAt
    );

    this.statusValue = RentalStatus.RETURNED;
    this.returnedAtValue = new Date(returnedAt.getTime());
    this.lateFeeValue = lateFee + cleanDamageFee;

    if (cleanDamageFee > 0) {
      const tag = `[Phụ phí kiểm định/vệ sinh: +${cleanDamageFee}₫]`;
      this.noteValue = mergeNotePreservingDiscountTag(this.noteValue, note, tag);
    } else if (note !== undefined) {
      this.noteValue = mergeNotePreservingDiscountTag(this.noteValue, note);
    }
  }

  extendPeriod(newEndDate: Date, note?: string): void {
    if (
      this.statusValue !== RentalStatus.RESERVED &&
      this.statusValue !== RentalStatus.ACTIVE
    ) {
      throw new BusinessRuleError(
        'INVALID_RENTAL_STATE',
        'Only RESERVED or ACTIVE rental can be extended.'
      );
    }

    ensureValidDate(newEndDate, 'newEndDate');
    ensureValidRentalNote(note ?? null);
    const oldEnd = normalizeDateToCalendarTime(this.periodValue.endDate);
    const nextEnd = normalizeDateToCalendarTime(newEndDate);
    if (nextEnd <= oldEnd) {
      throw new ValidationError('New return date must be after the current expected return date.');
    }

    this.periodValue = new RentalPeriod(this.periodValue.startDate, newEndDate);
    if (note !== undefined && note.trim().length > 0) {
      this.noteValue = mergeNotePreservingDiscountTag(this.noteValue, note);
    }
  }

  assertOwnedBy(
    customerId: string,
    message: string = 'You do not have permission to access or modify this rental.'
  ): void {
    const cid = customerId?.trim() ?? '';
    if (!cid) {
      throw new ValidationError('Customer id is required for this operation.');
    }
    if (this.customerIdValue !== cid) {
      throw new ForbiddenError('FORBIDDEN', message);
    }
  }

  buildExtensionPeriod(newEndDate: Date): RentalPeriod {
    if (
      this.statusValue !== RentalStatus.RESERVED &&
      this.statusValue !== RentalStatus.ACTIVE
    ) {
      throw new BusinessRuleError(
        'INVALID_RENTAL_STATE',
        `Only RESERVED or ACTIVE rental can be extended. Current status: ${this.statusValue}.`
      );
    }
    ensureValidDate(newEndDate, 'newEndDate');
    const oldEnd = this.periodValue.endDate;
    const oldEndNorm = new Date(oldEnd.getFullYear(), oldEnd.getMonth(), oldEnd.getDate());
    const newEndNorm = new Date(
      newEndDate.getFullYear(),
      newEndDate.getMonth(),
      newEndDate.getDate()
    );
    if (newEndNorm.getTime() <= oldEndNorm.getTime()) {
      throw new ValidationError('New return date must be after current return date.');
    }
    const extStart = new Date(
      oldEndNorm.getFullYear(),
      oldEndNorm.getMonth(),
      oldEndNorm.getDate() + 1
    );
    return new RentalPeriod(extStart, newEndNorm);
  }

  static formatDiscountNote(
    rawNote: string | undefined,
    customerRank: string,
    rankDiscountPercent: number,
    appliedVoucherCode: string | null,
    voucherDiscountPercent: number
  ): string | null {
    let noteText = rawNote?.trim() || '';
    const totalDiscount = Math.min(50, rankDiscountPercent + voucherDiscountPercent);
    if (totalDiscount > 0) {
      const tagParts: string[] = [];
      if (rankDiscountPercent > 0) {
        tagParts.push(`Hạng ${customerRank} -${rankDiscountPercent}%`);
      }
      if (appliedVoucherCode) {
        tagParts.push(`Voucher ${appliedVoucherCode} -${voucherDiscountPercent}%`);
      }
      const tag = `[Ưu đãi: ${tagParts.join(', ')}]`;
      if (noteText) {
        const maxPrefixLen = Math.max(0, 255 - tag.length - 1);
        const safePrefix =
          noteText.length > maxPrefixLen ? noteText.slice(0, maxPrefixLen).trimEnd() : noteText;
        noteText = safePrefix ? `${safePrefix} ${tag}` : tag;
      } else {
        noteText = tag;
      }
    }
    return noteText || null;
  }
  
  
  assertCustomerCancellationAllowed(at: Date): void {
    if (this.statusValue !== RentalStatus.RESERVED) {
      throw new BusinessRuleError(
        'INVALID_RENTAL_STATE',
        `Only RESERVED rental can be cancelled. Current status: ${this.statusValue}.`
      );
    }

    ensureValidDate(at, 'at');
    const startDay = normalizeDateToCalendarTime(this.periodValue.startDate);
    const atDay = normalizeDateToCalendarTime(at);
    if (startDay - atDay < MS_PER_CALENDAR_DAY) {
      throw new BusinessRuleError(
        'CANCEL_TOO_LATE',
        'You can only cancel at least one full day before the rental start date.'
      );
    }
  }

  cancel(at: Date = new Date(), note?: string): void {
    if (this.statusValue !== RentalStatus.RESERVED) {
      throw new BusinessRuleError(
        'INVALID_RENTAL_STATE',
        `Only RESERVED rental can be cancelled. Current status: ${this.statusValue}.`
      );
    }

    ensureValidDate(at, 'cancelledAt');
    ensureValidRentalNote(note ?? null);

    this.statusValue = RentalStatus.CANCELLED;
    this.cancelledAtValue = new Date(at.getTime());

    if (note !== undefined) {
      this.noteValue = mergeNotePreservingDiscountTag(this.noteValue, note);
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

  private calculateLateFeeForReturn(
    basePrice: number,
    durationInDays: number,
    expectedReturnDate: Date,
    actualReturnDate: Date
  ): number {
    const expectedTime = normalizeDateToCalendarTime(expectedReturnDate);
    const actualTime = normalizeDateToCalendarTime(actualReturnDate);

    if (actualTime <= expectedTime) return 0;

    const overdueDays = Math.floor((actualTime - expectedTime) / (24 * 60 * 60 * 1000));
    if (overdueDays <= 0) return 0;

    const dailyRate = basePrice / durationInDays;
    const lateFeePerDay = dailyRate * 0.5;

    return Math.round(overdueDays * lateFeePerDay);
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