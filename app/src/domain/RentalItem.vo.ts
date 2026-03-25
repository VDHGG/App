import { ValidationError } from './errors/ValidationError';
import {
  ensureValidIntegerInRange,
  ensureValidPositiveInteger,
  ensureValidPositiveNumber,
  ensureValidRentalItemReferenceId,
} from './errors/validation';

export type RentalItemProps = {
  shoeId: string;
  variantId: string;
  shoeName: string;
  size: number;
  color: string;
  pricePerDay: number;
  quantity: number;
};

function ensureValidRentalItemName(shoeName: string): void {
  if (!shoeName || shoeName.trim().length === 0 || shoeName.trim().length > 100) {
    throw new ValidationError('Rental item shoe name is invalid.');
  }
}

function ensureValidRentalItemColor(color: string): void {
  if (!color || color.trim().length === 0 || color.trim().length > 100) {
    throw new ValidationError('Rental item color is invalid.');
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
    ensureValidRentalItemReferenceId(props.shoeId, 'shoe id');
    ensureValidRentalItemReferenceId(props.variantId, 'variant id');
    ensureValidRentalItemName(props.shoeName);
    ensureValidIntegerInRange(
      props.size,
      1,
      60,
      'Rental item size must be an integer between 1 and 60.'
    );
    ensureValidRentalItemColor(props.color);
    ensureValidPositiveNumber(
      props.pricePerDay,
      'Rental item price per day must be greater than 0.'
    );
    ensureValidPositiveInteger(
      props.quantity,
      'Rental item quantity must be a positive integer.'
    );

    this.shoeId = props.shoeId.trim();
    this.variantId = props.variantId.trim();
    this.shoeName = props.shoeName.trim();
    this.size = props.size;
    this.color = props.color.trim();
    this.pricePerDay = props.pricePerDay;
    this.quantity = props.quantity;
  }

  subtotalFor(days: number): number {
    ensureValidPositiveInteger(days, 'Rental days must be a positive integer.');

    return this.pricePerDay * this.quantity * days;
  }
}
