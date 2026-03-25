import { describe, it, expect, beforeEach } from 'vitest';
import { Customer } from '@domain/Customer.aggregate';
import { CustomerRank } from '@domain/CustomerRank.enum';
import { Rental } from '@domain/Rental.aggregate';
import { RentalItem } from '@domain/RentalItem.vo';
import { RentalPeriod } from '@domain/RentalPeriod.vo';
import { RentalStatus } from '@domain/RentalStatus.enum';
import { Shoe } from '@domain/Shoe.aggregate';
import { ShoeVariant } from '@domain/ShoeVariant.entity';
import { InMemoryCustomerRepository } from '@adapter/persistence/InMemoryCustomerRepository.adapter';
import { InMemoryRentalAvailabilityChecker } from '@adapter/persistence/InMemoryRentalAvailabilityChecker.adapter';
import { InMemoryRentalRepository } from '@adapter/persistence/InMemoryRentalRepository.adapter';
import { InMemoryShoeRepository } from '@adapter/persistence/InMemoryShoeRepository.adapter';
import { ShortIdGenerator } from '@adapter/persistence/ShortIdGenerator.adapter';
import { CreateRentalService } from '@usecase/CreateRental.service';

const PERIOD = new RentalPeriod(new Date('2026-04-01'), new Date('2026-04-05'));

function seedCustomer(overrides?: Partial<{ id: string; fullName: string; email: string; rank: CustomerRank; currentRentedItems: number; isActive: boolean }>) {
  return new Customer({
    id: 'U001',
    fullName: 'Nguyen Van A',
    email: 'a@gmail.com',
    rank: CustomerRank.BRONZE,
    currentRentedItems: 0,
    isActive: true,
    ...overrides,
  });
}

function seedShoe() {
  const shoe = new Shoe({
    id: 'S001',
    name: 'Adidas Speed Run',
    brand: 'Adidas',
    category: 'Running',
    description: 'Lightweight',
    pricePerDay: 5,
  });
  shoe.addVariant(new ShoeVariant({ id: 'V001', size: 44, color: 'White', totalQuantity: 5 }));
  shoe.addVariant(new ShoeVariant({ id: 'V002', size: 44, color: 'Black', totalQuantity: 3 }));
  return shoe;
}

let customerRepo: InMemoryCustomerRepository;
let shoeRepo: InMemoryShoeRepository;
let rentalRepo: InMemoryRentalRepository;
let availabilityChecker: InMemoryRentalAvailabilityChecker;
let service: CreateRentalService;

beforeEach(async () => {
  customerRepo = new InMemoryCustomerRepository();
  shoeRepo = new InMemoryShoeRepository();
  rentalRepo = new InMemoryRentalRepository();
  availabilityChecker = new InMemoryRentalAvailabilityChecker(rentalRepo, shoeRepo);
  service = new CreateRentalService(
    customerRepo,
    shoeRepo,
    rentalRepo,
    availabilityChecker,
    new ShortIdGenerator('R')
  );

  await customerRepo.save(seedCustomer());
  await shoeRepo.save(seedShoe());
});

describe('CreateRentalService - happy path', () => {
  it('creates a rental with single item', async () => {
    const result = await service.execute({
      customerId: 'U001',
      items: [{ variantId: 'V001', quantity: 1 }],
      startDate: new Date('2026-04-01'),
      endDate: new Date('2026-04-05'),
    });

    expect(result.rentalId).toBeTruthy();
    expect(result.rentalId).toMatch(/^R\d+$/);
    expect(result.customerId).toBe('U001');
    expect(result.status).toBe(RentalStatus.RESERVED);
    expect(result.totalItems).toBe(1);
    expect(result.basePrice).toBe(25); // 1 × $5 × 5 days
    expect(result.totalAmount).toBe(25);
  });

  it('creates a rental with multiple items from same shoe', async () => {
    const result = await service.execute({
      customerId: 'U001',
      items: [
        { variantId: 'V001', quantity: 2 },
        { variantId: 'V002', quantity: 1 },
      ],
      startDate: new Date('2026-04-01'),
      endDate: new Date('2026-04-05'),
    });

    expect(result.totalItems).toBe(3);
    expect(result.basePrice).toBe(75); // (2×5 + 1×5) × 5 days
    expect(result.totalAmount).toBe(75);
  });

  it('persists rental to repository', async () => {
    const result = await service.execute({
      customerId: 'U001',
      items: [{ variantId: 'V001', quantity: 1 }],
      startDate: new Date('2026-04-01'),
      endDate: new Date('2026-04-05'),
    });

    const saved = await rentalRepo.findById(result.rentalId);
    expect(saved).not.toBeNull();
    expect(saved?.status).toBe(RentalStatus.RESERVED);
    expect(saved?.totalItems).toBe(1);
  });

  it('increments customer currentRentedItems', async () => {
    await service.execute({
      customerId: 'U001',
      items: [{ variantId: 'V001', quantity: 2 }],
      startDate: new Date('2026-04-01'),
      endDate: new Date('2026-04-05'),
    });

    const customer = await customerRepo.findById('U001');
    expect(customer?.currentRentedItems).toBe(2);
  });
});

describe('CreateRentalService - error cases', () => {
  it('throws when customer does not exist', async () => {
    await expect(
      service.execute({
        customerId: 'GHOST',
        items: [{ variantId: 'V001', quantity: 1 }],
        startDate: new Date('2026-04-01'),
        endDate: new Date('2026-04-05'),
      })
    ).rejects.toThrow(/Customer.*GHOST.*not found/);
  });

  it('throws when variant does not exist', async () => {
    await expect(
      service.execute({
        customerId: 'U001',
        items: [{ variantId: 'V999', quantity: 1 }],
        startDate: new Date('2026-04-01'),
        endDate: new Date('2026-04-05'),
      })
    ).rejects.toThrow(/Variant.*V999.*not found/);
  });

  it('throws when insufficient stock (overlapping rental)', async () => {
    const customer2 = seedCustomer({
      id: 'U002',
      email: 'b@gmail.com',
      currentRentedItems: 0,
    });
    await customerRepo.save(customer2);

    const existingRental = new Rental({
      id: 'R0',
      customerId: 'U001',
      items: [
        new RentalItem({
          shoeId: 'S001',
          variantId: 'V001',
          shoeName: 'Adidas Speed Run',
          size: 44,
          color: 'White',
          pricePerDay: 5,
          quantity: 5,
        }),
      ],
      period: PERIOD,
    });
    await rentalRepo.save(existingRental);
    await customerRepo.save(seedCustomer({ currentRentedItems: 5 }));

    await expect(
      service.execute({
        customerId: 'U002',
        items: [{ variantId: 'V001', quantity: 1 }],
        startDate: new Date('2026-04-01'),
        endDate: new Date('2026-04-05'),
      })
    ).rejects.toThrow(/INSUFFICIENT_STOCK|not available/);
  });

  it('throws when customer rank limit exceeded', async () => {
    await customerRepo.save(seedCustomer({ rank: CustomerRank.BRONZE, currentRentedItems: 5 }));

    await expect(
      service.execute({
        customerId: 'U001',
        items: [{ variantId: 'V001', quantity: 1 }],
        startDate: new Date('2026-04-01'),
        endDate: new Date('2026-04-05'),
      })
    ).rejects.toThrow(/RENTAL_LIMIT_EXCEEDED|cannot rent/);
  });

  it('throws when customer is inactive', async () => {
    await customerRepo.save(seedCustomer({ isActive: false }));

    await expect(
      service.execute({
        customerId: 'U001',
        items: [{ variantId: 'V001', quantity: 1 }],
        startDate: new Date('2026-04-01'),
        endDate: new Date('2026-04-05'),
      })
    ).rejects.toThrow(/CUSTOMER_INACTIVE|Inactive/);
  });
});
