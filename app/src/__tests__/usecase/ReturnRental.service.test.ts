import { describe, it, expect, beforeEach } from 'vitest';
import { InMemoryCustomerRepository } from '@adapter/persistence/InMemoryCustomerRepository.adapter';
import { InMemoryRentalRepository } from '@adapter/persistence/InMemoryRentalRepository.adapter';
import { Customer } from '@domain/Customer.aggregate';
import { Rental } from '@domain/Rental.aggregate';
import { RentalItem } from '@domain/RentalItem.vo';
import { RentalPeriod } from '@domain/RentalPeriod.vo';
import { RentalStatus } from '@domain/RentalStatus.enum';
import { ReturnRentalService } from '@usecase/ReturnRental.service';


const PERIOD = new RentalPeriod(new Date('2026-05-01'), new Date('2026-05-05'));

function seedCustomer() {
  return new Customer({
    id: 'U001',
    fullName: 'Nguyen Van A',
    email: 'a@gmail.com',
    currentRentedItems: 2,
  });
}


function seedRentalReserved() {
  return new Rental({
    id: 'R001',
    customerId: 'U001',
    items: [
      new RentalItem({ shoeId: 'S001', variantId: 'V001', shoeName: 'Adidas Speed Run', size: 42, color: 'Black', pricePerDay: 10, quantity: 2 }),
    ],
    period: PERIOD,
  });
}

function seedRentalActive() {
  return new Rental({
    id: 'R002',
    customerId: 'U001',
    items: [
      new RentalItem({ shoeId: 'S001', variantId: 'V001', shoeName: 'Adidas Speed Run', size: 42, color: 'Black', pricePerDay: 10, quantity: 2 }),
    ],
    period: PERIOD,
    status: RentalStatus.ACTIVE,
    activatedAt: new Date('2026-05-05'),
  });
}


let customerRepo: InMemoryCustomerRepository;
let rentalRepo: InMemoryRentalRepository;
let service: ReturnRentalService;

beforeEach(async () => {
  customerRepo = new InMemoryCustomerRepository();
  rentalRepo = new InMemoryRentalRepository();
  service = new ReturnRentalService(rentalRepo, customerRepo);

  await customerRepo.save(seedCustomer());
});


describe('ReturnRentalService - happy path', () => {
  it('returns a RESERVED rental successfully', async () => {
    await rentalRepo.save(seedRentalReserved());

    const result = await service.execute({ rentalId: 'R001' });

    expect(result.status).toBe(RentalStatus.RETURNED);
    expect(result.rentalId).toBe('R001');
    expect(result.returnedAt).toBeInstanceOf(Date);
    expect(result.lateFee).toBe(0);
    expect(result.totalItems).toBe(2);
  });

  it('returns an ACTIVE rental successfully', async () => {
    await rentalRepo.save(seedRentalActive());

    const result = await service.execute({ rentalId: 'R002' });

    expect(result.status).toBe(RentalStatus.RETURNED);
  });

  it('applies lateFee and note on return', async () => {
    await rentalRepo.save(seedRentalReserved());

    const result = await service.execute({
      rentalId: 'R001',
      returnedAt: new Date('2026-05-10'),
      note: 'left heel scuffed',
    });

    expect(result.lateFee).toBe(50);
    expect(result.totalAmount).toBe(result.basePrice + 50);

    const saved = await rentalRepo.findById('R001');
    expect(saved?.note).toBe('left heel scuffed');
  });

  it('decrements customer currentRentedItems after return', async () => {
    await rentalRepo.save(seedRentalReserved());

    await service.execute({ rentalId: 'R001' });

    const customer = await customerRepo.findById('U001');
    expect(customer?.currentRentedItems).toBe(0);
  });

  it('persists the returned rental to the repository', async () => {
    await rentalRepo.save(seedRentalReserved());

    await service.execute({ rentalId: 'R001' });

    const saved = await rentalRepo.findById('R001');
    expect(saved?.status).toBe(RentalStatus.RETURNED);
  });
});


describe('ReturnRentalService - error cases', () => {
  it('throws when rentalId is empty', async () => {
    await expect(service.execute({ rentalId: '' })).rejects.toThrow('Rental id is required');
  });

  it('throws when rental does not exist', async () => {
    await expect(service.execute({ rentalId: 'GHOST' })).rejects.toThrow(
      /Rental.*GHOST.*not found/
    );
  });

  it('throws when trying to return an already RETURNED rental', async () => {
    const returned = seedRentalReserved();
    returned.completeReturn();
    await rentalRepo.save(returned);

    await expect(service.execute({ rentalId: 'R001' })).rejects.toThrow(/RESERVED or ACTIVE/);
  });

  it('throws when trying to return a CANCELLED rental', async () => {
    const cancelled = seedRentalReserved();
    cancelled.cancel();
    await rentalRepo.save(cancelled);

    await expect(service.execute({ rentalId: 'R001' })).rejects.toThrow(/RESERVED or ACTIVE/);
  });
});
