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

    const totalStock = variant.totalQuantity;

    const [reservedRentals, activeRentals] = await Promise.all([
      this.rentalRepository.findByStatus(RentalStatus.RESERVED),
      this.rentalRepository.findByStatus(RentalStatus.ACTIVE),
    ]);

    const overlappingRentals = [...reservedRentals, ...activeRentals].filter((rental) =>
      rental.period.overlaps(period)
    );

    const reservedQuantity = overlappingRentals.reduce(
      (sum, rental) => sum + rental.getQuantityForVariant(variantId),
      0
    );

    variant.ensureAvailableForQuantity(reservedQuantity, requestedQuantity);
  }
}
