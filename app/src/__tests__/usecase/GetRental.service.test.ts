import { describe, it, expect, beforeEach } from 'vitest';
import { InMemoryRentalRepository } from '@adapter/persistence/InMemoryRentalRepository.adapter';
import { Rental } from '@domain/Rental.aggregate';
import { RentalItem } from '@domain/RentalItem.vo';
import { RentalPeriod } from '@domain/RentalPeriod.vo';
import { RentalStatus } from '@domain/RentalStatus.enum';
import { GetRentalService } from '@usecase/GetRental.service';

const PERIOD = new RentalPeriod(new Date('2026-04-01'), new Date('2026-04-05'));

function seedRental() {
  return new Rental({
    id: 'R001',
    customerId: 'U001',
    items: [
      new RentalItem({
        shoeId: 'S001',
        variantId: 'V001',
        shoeName: 'Adidas Speed',
        size: 42,
        color: 'Black',
        pricePerDay: 10,
        quantity: 2,
      }),
    ],
    period: PERIOD,
  });
}

let rentalRepo: InMemoryRentalRepository;
let getRental: GetRentalService;

beforeEach(async () => {
  rentalRepo = new InMemoryRentalRepository();
  await rentalRepo.save(seedRental());
  getRental = new GetRentalService(rentalRepo);
});

describe('GetRentalService', () => {
  it('returns rental detail by id', async () => {
    const result = await getRental.execute({ rentalId: 'R001' });

    expect(result.rentalId).toBe('R001');
    expect(result.customerId).toBe('U001');
    expect(result.status).toBe(RentalStatus.RESERVED);
    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({
      shoeName: 'Adidas Speed',
      size: 42,
      color: 'Black',
      quantity: 2,
    });
  });

  it('throws when rentalId is empty', async () => {
    await expect(getRental.execute({ rentalId: '' })).rejects.toThrow('Rental id is required');
  });

  it('throws when rental not found', async () => {
    await expect(getRental.execute({ rentalId: 'GHOST' })).rejects.toThrow(
      /Rental.*GHOST.*not found/
    );
  });

  it('throws when requestingCustomerId does not own the rental', async () => {
    await expect(
      getRental.execute({ rentalId: 'R001', requestingCustomerId: 'OTHER' })
    ).rejects.toThrow(/Rental.*R001.*not found/);
  });

  it('returns rental when requestingCustomerId matches', async () => {
    const result = await getRental.execute({
      rentalId: 'R001',
      requestingCustomerId: 'U001',
    });
    expect(result.rentalId).toBe('R001');
  });
});
