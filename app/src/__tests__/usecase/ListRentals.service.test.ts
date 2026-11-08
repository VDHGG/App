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
    expect(result.total).toBe(0);
    expect(result.page).toBe(1);
    expect(result.totalPages).toBe(1);
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
    expect(result.total).toBe(1);
    expect(result.page).toBe(1);
    expect(result.totalPages).toBe(1);
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
    expect(result.total).toBe(1);
    expect(result.rentals[0].status).toBe(RentalStatus.ACTIVE);
  });

  describe('VND amountBucket filters', () => {
    const singleDay = new RentalPeriod(new Date('2026-05-01'), new Date('2026-05-01'));

    function createRentalWithTotal(id: string, amount: number) {
      return new Rental({
        id,
        customerId: 'U001',
        items: [
          new RentalItem({
            shoeId: 'S1',
            variantId: 'V1',
            shoeName: 'Shoe',
            size: 42,
            color: 'Black',
            pricePerDay: amount,
            quantity: 1,
          }),
        ],
        period: singleDay,
        status: RentalStatus.RESERVED,
      });
    }

    beforeEach(async () => {
      await rentalRepo.save(createRentalWithTotal('R-999k', 999999));
      await rentalRepo.save(createRentalWithTotal('R-1m', 1000000));
      await rentalRepo.save(createRentalWithTotal('R-2m', 2000000));
      await rentalRepo.save(createRentalWithTotal('R-2m01', 2000001));
      await rentalRepo.save(createRentalWithTotal('R-3m5', 3500000));
      await rentalRepo.save(createRentalWithTotal('R-3m501', 3500001));
    });

    it('filters lt50 (< 1,000,000 VND)', async () => {
      const result = await listRentals.execute({ amountBucket: 'lt50' });
      expect(result.rentals.map((r) => r.rentalId)).toEqual(['R-999k']);
    });

    it('filters 50to150 (1,000,000 to 2,000,000 VND)', async () => {
      const result = await listRentals.execute({ amountBucket: '50to150' });
      expect(result.rentals.map((r) => r.rentalId).sort()).toEqual(['R-1m', 'R-2m']);
    });

    it('filters 150to300 (2,000,001 to 3,500,000 VND)', async () => {
      const result = await listRentals.execute({ amountBucket: '150to300' });
      expect(result.rentals.map((r) => r.rentalId).sort()).toEqual(['R-2m01', 'R-3m5']);
    });

    it('filters gt300 (> 3,500,000 VND)', async () => {
      const result = await listRentals.execute({ amountBucket: 'gt300' });
      expect(result.rentals.map((r) => r.rentalId)).toEqual(['R-3m501']);
    });
  });

  it('filters overdueOnly=true with accurate pagination', async () => {
    const pastPeriod = new RentalPeriod(new Date('2020-01-01'), new Date('2020-01-03'));
    const futurePeriod = new RentalPeriod(new Date('2099-01-01'), new Date('2099-01-03'));
    const item = new RentalItem({
      shoeId: 'S1',
      variantId: 'V1',
      shoeName: 'Shoe',
      size: 42,
      color: 'Black',
      pricePerDay: 200000,
      quantity: 1,
    });

    await rentalRepo.save(
      new Rental({
        id: 'R-OV-1',
        customerId: 'U001',
        items: [item],
        period: pastPeriod,
        status: RentalStatus.ACTIVE,
        activatedAt: new Date('2020-01-01'),
      })
    );
    await rentalRepo.save(
      new Rental({
        id: 'R-OV-2',
        customerId: 'U001',
        items: [item],
        period: pastPeriod,
        status: RentalStatus.ACTIVE,
        activatedAt: new Date('2020-01-01'),
      })
    );
    await rentalRepo.save(
      new Rental({
        id: 'R-ACT-FUT',
        customerId: 'U001',
        items: [item],
        period: futurePeriod,
        status: RentalStatus.ACTIVE,
        activatedAt: new Date('2099-01-01'),
      })
    );
    await rentalRepo.save(
      new Rental({
        id: 'R-RET-PST',
        customerId: 'U001',
        items: [item],
        period: pastPeriod,
        status: RentalStatus.RETURNED,
        returnedAt: new Date('2020-01-03'),
      })
    );

    const allOverdue = await listRentals.execute({ overdueOnly: true });
    expect(allOverdue.total).toBe(2);
    expect(allOverdue.rentals.every((r) => r.isOverdue === true)).toBe(true);

    const pagedOverdue = await listRentals.execute({ overdueOnly: true, page: 1, pageSize: 1 });
    expect(pagedOverdue.total).toBe(2);
    expect(pagedOverdue.totalPages).toBe(2);
    expect(pagedOverdue.rentals).toHaveLength(1);
  });
});
