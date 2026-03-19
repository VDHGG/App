import { ValidationError } from './errors/ValidationError';

export type RentalItemProps = {
  shoeId: string;
  variantId: string;
  shoeName: string;
  size: number;
  color: string;
  pricePerDay: number;
  quantity: number;
};

function ensureValidRentalItemId(id: string, label: string): void {
  if (!id || id.trim().length === 0 || id.length > 10) {
    throw new ValidationError(`Rental item ${label} is invalid.`);
  }
}

function ensureValidRentalItemName(shoeName: string): void {
  if (!shoeName || shoeName.trim().length === 0 || shoeName.trim().length > 100) {
    throw new ValidationError('Rental item shoe name is invalid.');
  }
}

function ensureValidRentalItemSize(size: number): void {
  if (!Number.isInteger(size) || size < 1 || size > 60) {
    throw new ValidationError('Rental item size must be an integer between 1 and 60.');
  }
}

function ensureValidRentalItemColor(color: string): void {
  if (!color || color.trim().length === 0 || color.trim().length > 100) {
    throw new ValidationError('Rental item color is invalid.');
  }
}

function ensureValidRentalItemPrice(pricePerDay: number): void {
  if (typeof pricePerDay !== 'number' || Number.isNaN(pricePerDay) || pricePerDay <= 0) {
    throw new ValidationError('Rental item price per day must be greater than 0.');
  }
}

function ensureValidRentalItemQuantity(quantity: number): void {
  if (!Number.isInteger(quantity) || quantity <= 0) {
    throw new ValidationError('Rental item quantity must be a positive integer.');
  }
}

export class RentalItem {
  readonly shoeId: string;
  readonly variantId: string;
  readonly shoeName: string;
  readonly size: number;
  readonly color: string;
  readonly pricePerDay: number;
  readonly quantity: number;

  constructor(props: RentalItemProps) {
    ensureValidRentalItemId(props.shoeId, 'shoe id');
    ensureValidRentalItemId(props.variantId, 'variant id');
    ensureValidRentalItemName(props.shoeName);
    ensureValidRentalItemSize(props.size);
    ensureValidRentalItemColor(props.color);
    ensureValidRentalItemPrice(props.pricePerDay);
    ensureValidRentalItemQuantity(props.quantity);

    this.shoeId = props.shoeId.trim();
    this.variantId = props.variantId.trim();
    this.shoeName = props.shoeName.trim();
    this.size = props.size;
    this.color = props.color.trim();
    this.pricePerDay = props.pricePerDay;
    this.quantity = props.quantity;
  }

  subtotalFor(days: number): number {
    if (!Number.isInteger(days) || days <= 0) {
      throw new ValidationError('Rental days must be a positive integer.');
    }

    return this.pricePerDay * this.quantity * days;
  }
}
