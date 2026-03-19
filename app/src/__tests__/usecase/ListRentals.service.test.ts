import { describe, it, expect, beforeEach } from 'vitest';
import { InMemoryRentalRepository } from '@adapter/persistence/InMemoryRentalRepository.adapter';
import { Rental } from '@domain/Rental.aggregate';
import { RentalItem } from '@domain/RentalItem.vo';
import { RentalPeriod } from '@domain/RentalPeriod.vo';
import { RentalStatus } from '@domain/RentalStatus.enum';
import { ListRentalsService } from '@usecase/ListRentals.service';

const PERIOD = new RentalPeriod(new Date('2026-04-01'), new Date('2026-04-05'));

let rentalRepo: InMemoryRentalRepository;
let listRentals: ListRentalsService;

beforeEach(() => {
  rentalRepo = new InMemoryRentalRepository();
  listRentals = new ListRentalsService(rentalRepo);
});

describe('ListRentalsService', () => {
  it('returns empty list when no rentals', async () => {
    const result = await listRentals.execute();

    expect(result.rentals).toEqual([]);
  });

  it('returns all rentals', async () => {
    await rentalRepo.save(
      new Rental({
        id: 'R001',
        customerId: 'U001',
        items: [
          new RentalItem({
            shoeId: 'S001',
            variantId: 'V001',
            shoeName: 'Shoe',
            size: 42,
            color: 'Black',
            pricePerDay: 10,
            quantity: 1,
          }),
        ],
        period: PERIOD,
      })
    );

    const result = await listRentals.execute();

    expect(result.rentals).toHaveLength(1);
    expect(result.rentals[0]).toMatchObject({
      rentalId: 'R001',
      customerId: 'U001',
      status: RentalStatus.RESERVED,
      totalItems: 1,
    });
  });

  it('filters by status when provided', async () => {
    await rentalRepo.save(
      new Rental({
        id: 'R1',
        customerId: 'U001',
        items: [
          new RentalItem({
            shoeId: 'S1',
            variantId: 'V1',
            shoeName: 'S',
            size: 42,
            color: 'B',
            pricePerDay: 10,
            quantity: 1,
          }),
        ],
        period: PERIOD,
        status: RentalStatus.RESERVED,
      })
    );
    const active = new Rental({
      id: 'R2',
      customerId: 'U001',
      items: [
        new RentalItem({
          shoeId: 'S1',
          variantId: 'V1',
          shoeName: 'S',
          size: 42,
          color: 'B',
          pricePerDay: 10,
          quantity: 1,
        }),
      ],
      period: PERIOD,
      status: RentalStatus.ACTIVE,
      activatedAt: new Date(),
    });
    await rentalRepo.save(active);

    const result = await listRentals.execute({ status: RentalStatus.ACTIVE });

    expect(result.rentals).toHaveLength(1);
    expect(result.rentals[0].status).toBe(RentalStatus.ACTIVE);
  });
});
