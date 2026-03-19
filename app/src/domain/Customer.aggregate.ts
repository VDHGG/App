import { CustomerRank, getMaxRentalItemsByRank } from './CustomerRank.enum';
import { ValidationError } from './errors/ValidationError';
import { BusinessRuleError } from './errors/BusinessRuleError';


export type CustomerProps = {
  id: string;
  fullName: string;
  email: string;
  rank?: CustomerRank;
  isActive?: boolean;
  currentRentedItems?: number;
};


function ensureValidCustomerId(id: string): void {
  if (!id || id.trim().length === 0 || id.length > 10) {
    throw new ValidationError('Customer id must be between 1 and 10 characters.');
  }
}

function ensureValidCustomerName(fullName: string): void {
  if (!fullName || fullName.trim().length === 0 || fullName.trim().length > 100) {
    throw new ValidationError('Customer full name must be between 1 and 100 characters.');
  }
}

function ensureValidCustomerEmail(email: string): void {
  if (!email || email.trim().length === 0 || email.length > 255 || !email.includes('@')) {
    throw new ValidationError('Customer email is invalid.');
  }
}

function ensureValidCurrentRentedItems(currentRentedItems: number): void {
  if (!Number.isInteger(currentRentedItems) || currentRentedItems < 0) {
    throw new ValidationError('Current rented items must be a non-negative integer.');
  }
}

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
  private rankValue: CustomerRank;
  private activeValue: boolean;
  private currentRentedItemsValue: number;

  constructor(props: CustomerProps) {
    const rank = props.rank ?? CustomerRank.BRONZE;
    const isActive = props.isActive ?? true;
    const currentRentedItems = props.currentRentedItems ?? 0;

    ensureValidCustomerId(props.id);
    ensureValidCustomerName(props.fullName);
    ensureValidCustomerEmail(props.email);
    ensureValidCurrentRentedItems(currentRentedItems);
    ensureCurrentItemsWithinRankLimit(rank, currentRentedItems);

    this.idValue = props.id.trim();
    this.fullNameValue = props.fullName.trim();
    this.emailValue = props.email.trim().toLowerCase();
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
    if (!Number.isInteger(quantity) || quantity <= 0) {
      throw new ValidationError('Rental quantity must be a positive integer.');
    }

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
    if (!Number.isInteger(quantity) || quantity <= 0) {
      throw new ValidationError('Returned quantity must be a positive integer.');
    }

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

  block(): void {
    this.activeValue = false;
  }

  unblock(): void {
    this.activeValue = true;
  }

  rename(fullName: string): void {
    ensureValidCustomerName(fullName);
    this.fullNameValue = fullName.trim();
  }

  changeEmail(email: string): void {
    ensureValidCustomerEmail(email);
    this.emailValue = email.trim().toLowerCase();
  }
}
