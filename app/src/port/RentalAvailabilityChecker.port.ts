import type { RentalPeriod } from '@domain/RentalPeriod.vo';

export interface RentalAvailabilityChecker {
  ensureVariantAvailable(
    variantId: string,
    requestedQuantity: number,
    period: RentalPeriod
  ): Promise<void>;
}
