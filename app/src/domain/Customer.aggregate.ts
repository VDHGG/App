import { CustomerRank, getMaxRentalItemsByRank } from './CustomerRank.enum';
import { BusinessRuleError } from './errors/BusinessRuleError';
import {
  ensureValidBoundedString,
  ensureValidCustomerEmail,
  ensureValidCustomerPhone,
  ensureValidEntityId,
  ensureValidNonNegativeInteger,
  ensureValidPositiveInteger,
} from './errors/validation';

export type CustomerProps = {
  id: string;
  fullName: string;
  email: string;
  phone?: string | null;
  rank?: CustomerRank;
  isActive?: boolean;
  currentRentedItems?: number;
};

function ensureCurrentItemsWithinRankLimit(rank: CustomerRank, currentItems: number): void {
  const maxItems = getMaxRentalItemsByRank(rank);

  if (maxItems !== null && currentItems > maxItems) {
    throw new BusinessRuleError(
      'RENTAL_LIMIT_EXCEEDED',
      `Current rented items (${currentItems}) exceed rank limit (${maxItems}) for ${rank}.`
    );
  }
}

export class Customer {
  private readonly idValue: string;
  private fullNameValue: string;
  private emailValue: string;
  private phoneValue: string | null;
  private rankValue: CustomerRank;
  private activeValue: boolean;
  private currentRentedItemsValue: number;

  constructor(props: CustomerProps) {
    const rank = props.rank ?? CustomerRank.BRONZE;
    const isActive = props.isActive ?? true;
    const currentRentedItems = props.currentRentedItems ?? 0;
    const rawPhone = props.phone?.trim() ?? '';
    const phoneNorm = rawPhone.length > 0 ? rawPhone.replace(/[\s().-]/g, '') : null;

    ensureValidEntityId(props.id, 'Customer');
    ensureValidBoundedString(
      props.fullName,
      1,
      100,
      'Customer full name must be between 1 and 100 characters.'
    );
    ensureValidCustomerEmail(props.email);
    if (phoneNorm !== null) {
      ensureValidCustomerPhone(phoneNorm);
    }
    ensureValidNonNegativeInteger(
      currentRentedItems,
      'Current rented items must be a non-negative integer.'
    );
    ensureCurrentItemsWithinRankLimit(rank, currentRentedItems);

    this.idValue = props.id.trim();
    this.fullNameValue = props.fullName.trim();
    this.emailValue = props.email.trim().toLowerCase();
    this.phoneValue = phoneNorm;
    this.rankValue = rank;
    this.activeValue = isActive;
    this.currentRentedItemsValue = currentRentedItems;
  }

  get id(): string {
    return this.idValue;
  }

  get fullName(): string {
    return this.fullNameValue;
  }

  get email(): string {
    return this.emailValue;
  }

  get phone(): string | null {
    return this.phoneValue;
  }

  get rank(): CustomerRank {
    return this.rankValue;
  }

  get isActive(): boolean {
    return this.activeValue;
  }

  get currentRentedItems(): number {
    return this.currentRentedItemsValue;
  }

  canRent(quantity: number): boolean {
    if (!this.activeValue) {
      return false;
    }

    if (!Number.isInteger(quantity) || quantity <= 0) {
      return false;
    }

    const maxItems = getMaxRentalItemsByRank(this.rankValue);
    if (maxItems === null) {
      return true;
    }

    return this.currentRentedItemsValue + quantity <= maxItems;
  }

  registerRental(quantity: number): void {
    ensureValidPositiveInteger(quantity, 'Rental quantity must be a positive integer.');

    if (!this.activeValue) {
      throw new BusinessRuleError('CUSTOMER_INACTIVE', 'Inactive customer cannot rent shoes.');
    }

    if (!this.canRent(quantity)) {
      const maxItems = getMaxRentalItemsByRank(this.rankValue);

      throw new BusinessRuleError(
        'RENTAL_LIMIT_EXCEEDED',
        `Customer cannot rent ${quantity} more item(s). Current: ${this.currentRentedItemsValue}, limit: ${maxItems ?? 'unlimited'}.`
      );
    }

    this.currentRentedItemsValue += quantity;
  }

  completeRental(quantity: number): void {
    ensureValidPositiveInteger(quantity, 'Returned quantity must be a positive integer.');

    if (quantity > this.currentRentedItemsValue) {
      throw new BusinessRuleError(
        'STOCK_OVERFLOW',
        'Returned quantity cannot exceed current rented items.'
      );
    }

    this.currentRentedItemsValue -= quantity;
  }

  changeRank(newRank: CustomerRank): void {
    ensureCurrentItemsWithinRankLimit(newRank, this.currentRentedItemsValue);
    this.rankValue = newRank;
  }

  activate(): void {
    this.activeValue = true;
  }

  deactivate(): void {
    this.activeValue = false;
  }

  rename(fullName: string): void {
    ensureValidBoundedString(
      fullName,
      1,
      100,
      'Customer full name must be between 1 and 100 characters.'
    );
    this.fullNameValue = fullName.trim();
  }

  changeEmail(email: string): void {
    ensureValidCustomerEmail(email);
    this.emailValue = email.trim().toLowerCase();
  }

  changePhone(phone: string | null): void {
    const rawPhone = phone?.trim() ?? '';
    const phoneNorm = rawPhone.length > 0 ? rawPhone.replace(/[\s().-]/g, '') : null;
    if (phoneNorm !== null) {
      ensureValidCustomerPhone(phoneNorm);
    }
    this.phoneValue = phoneNorm;
  }
}
