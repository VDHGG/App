import { describe, it, expect, beforeEach } from 'vitest';
import { InMemoryCustomerRepository } from '@adapter/persistence/InMemoryCustomerRepository.adapter';
import { InMemoryRentalRepository } from '@adapter/persistence/InMemoryRentalRepository.adapter';
import { Customer } from '@domain/Customer.aggregate';
import { Rental } from '@domain/Rental.aggregate';
import { RentalItem } from '@domain/RentalItem.vo';
import { RentalPeriod } from '@domain/RentalPeriod.vo';
import { RentalStatus } from '@domain/RentalStatus.enum';
import { ForbiddenError } from '@domain/errors/ForbiddenError';
import { CancelRentalService } from '@usecase/CancelRental.service';

const PERIOD = new RentalPeriod(new Date(2026, 3, 10), new Date(2026, 3, 14));

function seedCustomer() {
  return new Customer({
    id: 'U001',
    fullName: 'Nguyen Van A',
    email: 'a@gmail.com',
    currentRentedItems: 2,
  });
}


function seedRental() {
  return new Rental({
    id: 'R001',
    customerId: 'U001',
    items: [
      new RentalItem({
        shoeId: 'S001', variantId: 'V001', shoeName: 'Adidas Speed Run',
        size: 42, color: 'Black', pricePerDay: 10, quantity: 2,
      }),
    ],
    period: PERIOD,
  });
}

let customerRepo: InMemoryCustomerRepository;
let rentalRepo: InMemoryRentalRepository;
let service: CancelRentalService;

beforeEach(async () => {
  customerRepo = new InMemoryCustomerRepository();
  rentalRepo = new InMemoryRentalRepository();
  service = new CancelRentalService(rentalRepo, customerRepo);

  await customerRepo.save(seedCustomer());
  await rentalRepo.save(seedRental());
});


describe('CancelRentalService - happy path', () => {
  it('transitions RESERVED → CANCELLED', async () => {
    const result = await service.execute({ rentalId: 'R001' });

    expect(result.status).toBe(RentalStatus.CANCELLED);
    expect(result.cancelledAt).toBeInstanceOf(Date);
    expect(result.totalItems).toBe(2);
  });

  it('stores the cancellation note', async () => {
    await service.execute({ rentalId: 'R001', note: 'customer changed mind' });

    const saved = await rentalRepo.findById('R001');
    expect(saved?.note).toBe('customer changed mind');
  });

  it('decrements customer currentRentedItems', async () => {
    await service.execute({ rentalId: 'R001' });

    const customer = await customerRepo.findById('U001');
    expect(customer?.currentRentedItems).toBe(0);
  });

  it('persists the CANCELLED rental to the repository', async () => {
    await service.execute({ rentalId: 'R001' });

    const saved = await rentalRepo.findById('R001');
    expect(saved?.status).toBe(RentalStatus.CANCELLED);
  });
});


describe('CancelRentalService - error cases', () => {
  it('throws when rentalId is empty', async () => {
    await expect(service.execute({ rentalId: '' })).rejects.toThrow('Rental id is required');
  });

  it('throws when rental does not exist', async () => {
    await expect(service.execute({ rentalId: 'GHOST' })).rejects.toThrow(
      /Rental.*GHOST.*not found/
    );
  });

  it('throws when trying to cancel an ACTIVE rental (domain rule)', async () => {
    const rental = seedRental();
    rental.activate();
    await rentalRepo.save(rental);

    await expect(service.execute({ rentalId: 'R001' })).rejects.toThrow(/RESERVED/);
  });

  it('throws when trying to cancel an already RETURNED rental (domain rule)', async () => {
    const rental = seedRental();
    rental.completeReturn();
    await rentalRepo.save(rental);

    await expect(service.execute({ rentalId: 'R001' })).rejects.toThrow(/RESERVED/);
  });

  it('throws when trying to cancel an already CANCELLED rental (domain rule)', async () => {
    const rental = seedRental();
    rental.cancel();
    await rentalRepo.save(rental);

    await expect(service.execute({ rentalId: 'R001' })).rejects.toThrow(/RESERVED/);
  });

  it('rejects customer cancel when customer id does not match (forbidden)', async () => {
    await expect(
      service.execute({
        rentalId: 'R001',
        requestingCustomerId: 'OTHER',
      })
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it('rejects customer cancel when less than one day before start', async () => {
    const sameDayAsStart = new Date(2026, 3, 10, 12, 0, 0);
    await expect(
      service.execute({
        rentalId: 'R001',
        requestingCustomerId: 'U001',
        cancelledAt: sameDayAsStart,
      })
    ).rejects.toThrow(/one full day/);
  });

  it('allows customer cancel when at least one calendar day before start', async () => {
    const dayBeforeStart = new Date(2026, 3, 9, 12, 0, 0);
    const result = await service.execute({
      rentalId: 'R001',
      requestingCustomerId: 'U001',
      cancelledAt: dayBeforeStart,
    });
    expect(result.status).toBe(RentalStatus.CANCELLED);
  });
});
