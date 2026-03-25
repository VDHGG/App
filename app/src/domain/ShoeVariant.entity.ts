import { ValidationError } from './errors/ValidationError';
import { BusinessRuleError } from './errors/BusinessRuleError';
import { ensureVariantDeactivationAllowed } from './errors/variantDeactivation';
import {
  ensureValidAvailableQuantityNotAboveTotal,
  ensureValidIntegerInRange,
  ensureValidEntityId,
} from './errors/validation';

export type ShoeVariantProps = {
  id: string;
  size: number;
  color: string;
  totalQuantity: number;
  availableQuantity?: number;
};

function ensureValidVariantColor(color: string): void {
  if (!color || color.trim().length === 0 || color.trim().length > 100) {
    throw new ValidationError('Variant color must be between 1 and 100 characters.');
  }
}

function ensureValidTotalQuantity(quantity: number): void {
  if (!Number.isInteger(quantity) || quantity < 0) {
    throw new ValidationError('Total quantity must be a non-negative integer.');
  }
}

export class ShoeVariant {
  private readonly idValue: string;
  private readonly sizeValue: number;
  private readonly colorValue: string;
  private totalQuantityValue: number;
  private availableQuantityValue: number;

  constructor(props: ShoeVariantProps) {
    const availableQuantity = props.availableQuantity ?? props.totalQuantity;

    ensureValidEntityId(props.id, 'Variant');
    ensureValidIntegerInRange(
      props.size,
      1,
      60,
      'Variant size must be an integer between 1 and 60.'
    );
    ensureValidVariantColor(props.color);
    ensureValidTotalQuantity(props.totalQuantity);
    ensureValidAvailableQuantityNotAboveTotal(availableQuantity, props.totalQuantity);

    this.idValue = props.id.trim();
    this.sizeValue = props.size;
    this.colorValue = props.color.trim();
    this.totalQuantityValue = props.totalQuantity;
    this.availableQuantityValue = availableQuantity;
  }

  get id(): string {
    return this.idValue;
  }

  get size(): number {
    return this.sizeValue;
  }

  get color(): string {
    return this.colorValue;
  }

  get totalQuantity(): number {
    return this.totalQuantityValue;
  }

  get availableQuantity(): number {
    return this.availableQuantityValue;
  }

  changeOnHandQuantity(newTotal: number): void {
    ensureValidTotalQuantity(newTotal);
    const reserved = this.totalQuantityValue - this.availableQuantityValue;
    if (newTotal < reserved) {
      throw new BusinessRuleError(
        'STOCK_REDUCTION_BLOCKED',
        `Cannot set on-hand to ${newTotal}: at least ${reserved} units are tied to active rentals.`
      );
    }
    this.totalQuantityValue = newTotal;
    this.availableQuantityValue = newTotal - reserved;
  }

  ensureDeactivateForRental(
    alreadyDeactivatedQuantity: number,
    requestedDeactivationQuantity: number
  ): void {
    ensureVariantDeactivationAllowed({
      variantId: this.idValue,
      totalStock: this.totalQuantityValue,
      alreadyDeactivatedQuantity,
      requestedDeactivationQuantity,
    });
  }
}

export class VariantDeactivationPolicy {
  ensureDeactivateForRental(
    variantId: string,
    totalStock: number,
    alreadyDeactivatedQuantity: number,
    requestedDeactivationQuantity: number
  ): void {
    ensureVariantDeactivationAllowed({
      variantId,
      totalStock,
      alreadyDeactivatedQuantity,
      requestedDeactivationQuantity,
    });
  }
}
