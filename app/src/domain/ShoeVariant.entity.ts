import { ValidationError } from './errors/ValidationError';
import { BusinessRuleError } from './errors/BusinessRuleError';

export type ShoeVariantProps = {
  id: string;
  size: number;
  color: string;
  totalQuantity: number;
  availableQuantity?: number;
};

function ensureValidVariantId(id: string): void {
  if (!id || id.trim().length === 0 || id.length > 10) {
    throw new ValidationError('Variant id must be between 1 and 10 characters.');
  }
}

function ensureValidVariantSize(size: number): void {
  if (!Number.isInteger(size) || size < 1 || size > 60) {
    throw new ValidationError('Variant size must be an integer between 1 and 60.');
  }
}

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

function ensureValidAvailableQuantity(availableQuantity: number, totalQuantity: number): void {
  if (
    !Number.isInteger(availableQuantity) ||
    availableQuantity < 0 ||
    availableQuantity > totalQuantity
  ) {
    throw new ValidationError('Available quantity must be between 0 and total quantity.');
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

    ensureValidVariantId(props.id);
    ensureValidVariantSize(props.size);
    ensureValidVariantColor(props.color);
    ensureValidTotalQuantity(props.totalQuantity);
    ensureValidAvailableQuantity(availableQuantity, props.totalQuantity);

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

  ensureAvailableForQuantity(reservedQuantity: number, requestedQuantity: number): void {
    const available = this.totalQuantityValue - reservedQuantity;

    if (available < requestedQuantity) {
      throw new BusinessRuleError(
        'INSUFFICIENT_STOCK',
        `Variant ${this.idValue} is not available for the requested period. ` +
          `Available: ${available}, requested: ${requestedQuantity}.`
      );
    }
  }
}


export class VariantAvailabilityPolicy {
  ensureAvailableForQuantity(
    variantId: string,
    totalStock: number,
    reservedQuantity: number,
    requestedQuantity: number
  ): void {
    const available = totalStock - reservedQuantity;

    if (available < requestedQuantity) {
      throw new BusinessRuleError(
        'INSUFFICIENT_STOCK',
        `Variant ${variantId} is not available for the requested period. ` +
          `Available: ${available}, requested: ${requestedQuantity}.`
      );
    }
  }
}
