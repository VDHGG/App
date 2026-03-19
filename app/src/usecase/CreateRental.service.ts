import { Rental } from '@domain/Rental.aggregate';
import { RentalPeriod } from '@domain/RentalPeriod.vo';
import type { CustomerRepository } from '@port/CustomerRepository.port';
import type { IdGenerator } from '@port/IdGenerator.port';
import type { RentalAvailabilityChecker } from '@port/RentalAvailabilityChecker.port';
import type { RentalRepository } from '@port/RentalRepository.port';
import type { ShoeRepository } from '@port/ShoeRepository.port';
import type { CreateRentalRequest } from './CreateRentalRequest.dto';
import type { CreateRentalResponse } from './CreateRentalResponse.dto';
import type { CreateRentalUseCase } from '@usecase/CreateRentalUseCase.port';
import { NotFoundError } from '@domain/errors/NotFoundError';

export class CreateRentalService implements CreateRentalUseCase {
  private readonly customerRepository: CustomerRepository;
  private readonly shoeRepository: ShoeRepository;
  private readonly rentalRepository: RentalRepository;
  private readonly availabilityChecker: RentalAvailabilityChecker;
  private readonly idGenerator: IdGenerator;

  constructor(
    customerRepository: CustomerRepository,
    shoeRepository: ShoeRepository,
    rentalRepository: RentalRepository,
    availabilityChecker: RentalAvailabilityChecker,
    idGenerator: IdGenerator
  ) {
    this.customerRepository = customerRepository;
    this.shoeRepository = shoeRepository;
    this.rentalRepository = rentalRepository;
    this.availabilityChecker = availabilityChecker;
    this.idGenerator = idGenerator;
  }

  async execute(request: CreateRentalRequest): Promise<CreateRentalResponse> {
    const rentalPeriod = new RentalPeriod(request.startDate, request.endDate);
    const totalRequestedQuantity = request.items.reduce((sum, item) => sum + item.quantity, 0);

    const customer = await this.customerRepository.findById(request.customerId);
    if (!customer) throw new NotFoundError('Customer', request.customerId);

    const loadedShoes = new Map<string, Awaited<ReturnType<ShoeRepository['findByVariantId']>>>();
    const rentalItems = [];

    for (const requestedItem of request.items) {
      const shoe = await this.loadShoeForVariant(requestedItem.variantId, loadedShoes);
      if (!shoe) throw new NotFoundError('Variant', requestedItem.variantId);

      await this.availabilityChecker.ensureVariantAvailable(
        requestedItem.variantId,
        requestedItem.quantity,
        rentalPeriod
      );

      // Check xem có thể active không + tạo snapshot tại thời điểm đó
      rentalItems.push(shoe.createRentalItem(requestedItem.variantId, requestedItem.quantity));
    }

    const rental = new Rental({
      id: this.idGenerator.next(),
      customerId: customer.id,
      items: rentalItems,
      period: rentalPeriod,
    });

    customer.registerRental(totalRequestedQuantity);

    await this.customerRepository.save(customer);
    await this.rentalRepository.save(rental);

    return {
      rentalId: rental.id,
      customerId: rental.customerId,
      status: rental.status,
      totalItems: rental.totalItems,
      basePrice: rental.basePrice,
      totalAmount: rental.totalAmount,
      startDate: rental.period.startDate,
      endDate: rental.period.endDate,
    };
  }

  private async loadShoeForVariant(
    variantId: string,
    loadedShoes: Map<string, Awaited<ReturnType<ShoeRepository['findByVariantId']>>>
  ) {
    for (const shoe of loadedShoes.values()) {
      if (shoe && shoe.findVariantById(variantId)) {
        return shoe;
      }
    }

    const shoe = await this.shoeRepository.findByVariantId(variantId);

    if (shoe) {
      loadedShoes.set(shoe.id, shoe);
    }

    return shoe;
  }
}
