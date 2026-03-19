export const RentalStatus = {
  RESERVED: 'RESERVED',
  ACTIVE: 'ACTIVE',
  RETURNED: 'RETURNED',
  CANCELLED: 'CANCELLED',
} as const;

export type RentalStatus = (typeof RentalStatus)[keyof typeof RentalStatus];
