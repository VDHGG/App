import { describe, it, expect, beforeEach } from 'vitest';
import { InMemoryRentalRepository } from '@adapter/persistence/InMemoryRentalRepository.adapter';
import { Rental } from '@domain/Rental.aggregate';
import { RentalItem } from '@domain/RentalItem.vo';
import { RentalPeriod } from '@domain/RentalPeriod.vo';
import { RentalStatus } from '@domain/RentalStatus.enum';
import { ActivateRentalService } from '@usecase/ActivateRental.service';

function makeReservedRental(id = 'R001') {
  return new Rental({
    id,
    customerId: 'U001',
    items: [
      new RentalItem({
        shoeId: 'S001', variantId: 'V001', shoeName: 'Test Shoe',
        size: 42, color: 'Black', pricePerDay: 10, quantity: 1,
      }),
    ],
    period: new RentalPeriod(new Date('2026-04-01'), new Date('2026-04-05')),
  });
}

let rentalRepo: InMemoryRentalRepository;
let service: ActivateRentalService;

beforeEach(() => {
  rentalRepo = new InMemoryRentalRepository();
  service = new ActivateRentalService(rentalRepo);
});


describe('ActivateRentalService - happy path', () => {
  it('transitions RESERVED → ACTIVE', async () => {
    await rentalRepo.save(makeReservedRental());

    const result = await service.execute({ rentalId: 'R001' });

    expect(result.status).toBe(RentalStatus.ACTIVE);
    expect(result.activatedAt).toBeInstanceOf(Date);
  });

  it('uses the provided activatedAt timestamp', async () => {
    await rentalRepo.save(makeReservedRental());
    const ts = new Date('2026-04-02T10:00:00');

    const result = await service.execute({ rentalId: 'R001', activatedAt: ts });

    expect(result.activatedAt.toDateString()).toBe(ts.toDateString());
  });

  it('persists the ACTIVE status to the repository', async () => {
    await rentalRepo.save(makeReservedRental());

    await service.execute({ rentalId: 'R001' });

    const saved = await rentalRepo.findById('R001');
    expect(saved?.status).toBe(RentalStatus.ACTIVE);
    expect(saved?.activatedAt).toBeInstanceOf(Date);
  });
});


describe('ActivateRentalService - error cases', () => {
  it('throws when rentalId is empty', async () => {
    await expect(service.execute({ rentalId: '' })).rejects.toThrow('Rental id is required');
  });

  it('throws when rental does not exist', async () => {
    await expect(service.execute({ rentalId: 'GHOST' })).rejects.toThrow(
      /Rental.*GHOST.*not found/
    );
  });

  it('throws when rental is already ACTIVE (domain rule)', async () => {
    const rental = makeReservedRental();
    rental.activate();
    await rentalRepo.save(rental);

    await expect(service.execute({ rentalId: 'R001' })).rejects.toThrow(/RESERVED/);
  });

  it('throws when rental is already RETURNED (domain rule)', async () => {
    const rental = makeReservedRental();
    rental.completeReturn();
    await rentalRepo.save(rental);

    await expect(service.execute({ rentalId: 'R001' })).rejects.toThrow(/RESERVED/);
  });
});
