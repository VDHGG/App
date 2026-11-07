import { RentalStatus } from '@domain/RentalStatus.enum';
import type { RentalPeriod } from '@domain/RentalPeriod.vo';
import { NotFoundError } from '@domain/errors/NotFoundError';
import type { RentalAvailabilityChecker } from '@port/RentalAvailabilityChecker.port';
import type { RentalRepository } from '@port/RentalRepository.port';
import type { ShoeRepository } from '@port/ShoeRepository.port';

export class InMemoryRentalAvailabilityChecker implements RentalAvailabilityChecker {
  private readonly rentalRepository: RentalRepository;
  private readonly shoeRepository: ShoeRepository;

  constructor(rentalRepository: RentalRepository, shoeRepository: ShoeRepository) {
    this.rentalRepository = rentalRepository;
    this.shoeRepository = shoeRepository;
  }

  async ensureVariantAvailable(
    variantId: string,
    requestedQuantity: number,
    period: RentalPeriod
  ): Promise<void> {
    const shoe = await this.shoeRepository.findByVariantId(variantId);
    if (!shoe) {
      throw new NotFoundError('Variant', variantId);
    }

    const variant = shoe.findVariantById(variantId);
    if (!variant) {
      throw new NotFoundError('Variant', variantId);
    }

    const alreadyDeactivatedQuantity = await this.getReservedQuantityForVariant(variantId, period);
    variant.ensureDeactivateForRental(alreadyDeactivatedQuantity, requestedQuantity);
  }

  async getReservedQuantityForVariant(
    variantId: string,
    period: RentalPeriod
  ): Promise<number> {
    const [reservedRentals, activeRentals] = await Promise.all([
      this.rentalRepository.findList({ status: RentalStatus.RESERVED }),
      this.rentalRepository.findList({ status: RentalStatus.ACTIVE }),
    ]);

    const overlappingRentals = [...reservedRentals.items, ...activeRentals.items].filter((rental) =>
      rental.period.overlaps(period)
    );

    return overlappingRentals.reduce(
      (sum, rental) => sum + rental.getQuantityForVariant(variantId),
      0
    );
  }
}
