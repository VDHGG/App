import { describe, it, expect, beforeEach } from 'vitest';
import {
  CustomerRank,
  getDiscountPercentByRank,
  resolveRankByTotalSpentVnd,
  upgradeRankIfHigher,
} from '@domain/CustomerRank.enum';
import { resolveVoucher } from '@domain/Voucher.vo';
import { Customer } from '@domain/Customer.aggregate';
import { Shoe } from '@domain/Shoe.aggregate';
import { ShoeVariant } from '@domain/ShoeVariant.entity';
import { Rental } from '@domain/Rental.aggregate';
import { RentalItem } from '@domain/RentalItem.vo';
import { RentalPeriod } from '@domain/RentalPeriod.vo';
import { RentalStatus } from '@domain/RentalStatus.enum';
import { InMemoryCustomerRepository } from '@adapter/persistence/InMemoryCustomerRepository.adapter';
import { InMemoryRentalRepository } from '@adapter/persistence/InMemoryRentalRepository.adapter';
import { InMemoryShoeRepository } from '@adapter/persistence/InMemoryShoeRepository.adapter';
import { InMemoryRentalAvailabilityChecker } from '@adapter/persistence/InMemoryRentalAvailabilityChecker.adapter';
import { InMemoryVoucherRepository } from '@adapter/persistence/InMemoryVoucherRepository.adapter';
import { ShortIdGenerator } from '@adapter/persistence/ShortIdGenerator.adapter';
import { CreateRentalService } from '@usecase/CreateRental.service';
import { ReturnRentalService } from '@usecase/ReturnRental.service';
import { CancelRentalService } from '@usecase/CancelRental.service';
import { DeleteRentalAdminService } from '@usecase/DeleteRentalAdmin.service';
import { ExtendRentalService } from '@usecase/ExtendRental.service';
import { ListRentalsService } from '@usecase/ListRentals.service';
import { GetRentalService } from '@usecase/GetRental.service';
import { transactionalRoute } from '@adapter/http/middleware/routeMiddleware';
import type { TransactionManager } from '@port/TransactionManager.port';
import type { Request, Response, NextFunction } from 'express';

describe('New Features - Unit Tests', () => {
  describe('CustomerRank & Voucher domain rules', () => {
    it('returns correct discount percent by rank', () => {
      expect(getDiscountPercentByRank(CustomerRank.BRONZE)).toBe(0);
      expect(getDiscountPercentByRank(CustomerRank.SILVER)).toBe(5);
      expect(getDiscountPercentByRank(CustomerRank.GOLD)).toBe(10);
      expect(getDiscountPercentByRank(CustomerRank.DIAMOND)).toBe(15);
    });

    it('resolves customer rank by total spent VND', () => {
      expect(resolveRankByTotalSpentVnd(1_999_999)).toBe(CustomerRank.BRONZE);
      expect(resolveRankByTotalSpentVnd(2_000_000)).toBe(CustomerRank.SILVER);
      expect(resolveRankByTotalSpentVnd(4_999_999)).toBe(CustomerRank.SILVER);
      expect(resolveRankByTotalSpentVnd(5_000_000)).toBe(CustomerRank.GOLD);
      expect(resolveRankByTotalSpentVnd(9_999_999)).toBe(CustomerRank.GOLD);
      expect(resolveRankByTotalSpentVnd(10_000_000)).toBe(CustomerRank.DIAMOND);
      expect(resolveRankByTotalSpentVnd(25_000_000)).toBe(CustomerRank.DIAMOND);
    });

    it('upgrades rank only if higher rank', () => {
      expect(upgradeRankIfHigher(CustomerRank.BRONZE, CustomerRank.SILVER)).toBe(CustomerRank.SILVER);
      expect(upgradeRankIfHigher(CustomerRank.SILVER, CustomerRank.GOLD)).toBe(CustomerRank.GOLD);
      expect(upgradeRankIfHigher(CustomerRank.GOLD, CustomerRank.DIAMOND)).toBe(CustomerRank.DIAMOND);
      expect(upgradeRankIfHigher(CustomerRank.GOLD, CustomerRank.SILVER)).toBe(CustomerRank.GOLD);
      expect(upgradeRankIfHigher(CustomerRank.DIAMOND, CustomerRank.BRONZE)).toBe(CustomerRank.DIAMOND);
    });

    it('resolves valid vouchers case-insensitively and throws on invalid codes', () => {
      const v1 = resolveVoucher('WELCOME10');
      expect(v1).toMatchObject({ code: 'WELCOME10', discountPercent: 10 });

      const v2 = resolveVoucher(' shoe20 ');
      expect(v2).toMatchObject({ code: 'SHOE20', discountPercent: 20 });

      const v3 = resolveVoucher('GIAM5');
      expect(v3).toMatchObject({ code: 'GIAM5', discountPercent: 5 });

      expect(resolveVoucher('')).toBeNull();
      expect(resolveVoucher(null)).toBeNull();
      expect(() => resolveVoucher('NON_EXISTENT')).toThrow(/Mã giảm giá không hợp lệ/);
    });
  });

  describe('CreateRentalService with Rank & Voucher discounts', () => {
    let customerRepo: InMemoryCustomerRepository;
    let shoeRepo: InMemoryShoeRepository;
    let rentalRepo: InMemoryRentalRepository;
    let checker: InMemoryRentalAvailabilityChecker;
    let service: CreateRentalService;

    beforeEach(async () => {
      customerRepo = new InMemoryCustomerRepository();
      shoeRepo = new InMemoryShoeRepository();
      rentalRepo = new InMemoryRentalRepository();
      checker = new InMemoryRentalAvailabilityChecker(rentalRepo, shoeRepo);
      service = new CreateRentalService(
        customerRepo,
        shoeRepo,
        rentalRepo,
        checker,
        new ShortIdGenerator('R')
      );

      // Seed Gold Customer (10% discount)
      await customerRepo.save(
        new Customer({
          id: 'C_GOLD',
          fullName: 'Gold Customer',
          email: 'gold@example.com',
          rank: CustomerRank.GOLD,
        })
      );

      // Seed Diamond Customer (15% discount)
      await customerRepo.save(
        new Customer({
          id: 'C_DIAMOND',
          fullName: 'Diamond Customer',
          email: 'diamond@example.com',
          rank: CustomerRank.DIAMOND,
        })
      );

      // Seed Shoe: price 200,000 VND/day
      const shoe = new Shoe({
        id: 'S001',
        name: 'Runner Pro',
        brand: 'Nike',
        category: 'Running',
        pricePerDay: 200000,
      });
      shoe.addVariant(
        new ShoeVariant({
          id: 'V001',
          size: 42,
          color: 'Black',
          totalQuantity: 10,
          availableQuantity: 10,
        })
      );
      await shoeRepo.save(shoe);
    });

    it('applies rank discount (GOLD = 10%) automatically', async () => {
      const res = await service.execute({
        customerId: 'C_GOLD',
        items: [{ variantId: 'V001', quantity: 1 }],
        startDate: new Date('2026-06-01'),
        endDate: new Date('2026-06-01'), // 1 day
      });

      expect(res.originalBasePrice).toBe(200000);
      expect(res.discountPercent).toBe(10);
      expect(res.basePrice).toBe(180000);
      expect(res.discountAmount).toBe(20000);
      expect(res.customerRank).toBe(CustomerRank.GOLD);
      expect(res.appliedVoucher).toBeNull();
    });

    it('combines rank discount (10%) and voucher WELCOME10 (10%) to 20%', async () => {
      const res = await service.execute({
        customerId: 'C_GOLD',
        items: [{ variantId: 'V001', quantity: 1 }],
        startDate: new Date('2026-06-01'),
        endDate: new Date('2026-06-01'),
        voucherCode: 'WELCOME10',
      });

      expect(res.originalBasePrice).toBe(200000);
      expect(res.discountPercent).toBe(20);
      expect(res.basePrice).toBe(160000);
      expect(res.discountAmount).toBe(40000);
      expect(res.appliedVoucher).toBe('WELCOME10');
    });

    it('combines DIAMOND (15%) and SHOE20 (20%) to 35% discount capped at <= 50%', async () => {
      const res = await service.execute({
        customerId: 'C_DIAMOND',
        items: [{ variantId: 'V001', quantity: 1 }],
        startDate: new Date('2026-06-01'),
        endDate: new Date('2026-06-01'),
        voucherCode: 'SHOE20',
      });

      expect(res.originalBasePrice).toBe(200000);
      expect(res.discountPercent).toBe(35);
      expect(res.basePrice).toBe(130000); // 200k * 0.65
      expect(res.discountAmount).toBe(70000);
      expect(res.customerRank).toBe(CustomerRank.DIAMOND);
      expect(res.appliedVoucher).toBe('SHOE20');
      expect(res.discountPercent).toBeLessThanOrEqual(50);
    });

    it('normalizes whitespace and lowercase voucher codes', async () => {
      const res = await service.execute({
        customerId: 'C_GOLD',
        items: [{ variantId: 'V001', quantity: 1 }],
        startDate: new Date('2026-06-01'),
        endDate: new Date('2026-06-01'),
        voucherCode: '  welcome10  ',
      });

      expect(res.discountPercent).toBe(20);
      expect(res.appliedVoucher).toBe('WELCOME10');
    });

    it('rejects invalid voucher code during checkout', async () => {
      await expect(
        service.execute({
          customerId: 'C_GOLD',
          items: [{ variantId: 'V001', quantity: 1 }],
          startDate: new Date('2026-06-01'),
          endDate: new Date('2026-06-01'),
          voucherCode: 'FAKE_CODE',
        })
      ).rejects.toThrow(/Mã giảm giá không hợp lệ/);
    });
  });

  describe('ReturnRentalService with Auto-Upgrade', () => {
    let customerRepo: InMemoryCustomerRepository;
    let rentalRepo: InMemoryRentalRepository;
    let service: ReturnRentalService;

    beforeEach(async () => {
      customerRepo = new InMemoryCustomerRepository();
      rentalRepo = new InMemoryRentalRepository();
      service = new ReturnRentalService(rentalRepo, customerRepo);

      // Customer starts at BRONZE
      await customerRepo.save(
        new Customer({
          id: 'C001',
          fullName: 'Test Customer',
          email: 'test@example.com',
          rank: CustomerRank.BRONZE,
          currentRentedItems: 1,
        })
      );
    });

    it('auto-upgrades customer to SILVER after cumulative returned total reaches 2M VND', async () => {
      const period = new RentalPeriod(new Date('2026-05-01'), new Date('2026-05-05'));
      const rental = new Rental({
        id: 'R001',
        customerId: 'C001',
        items: [
          new RentalItem({
            shoeId: 'S001',
            variantId: 'V001',
            shoeName: 'Nike',
            size: 42,
            color: 'Black',
            pricePerDay: 500000,
            quantity: 1,
          }),
        ],
        period, // 5 days * 500,000 = 2,500,000 VND
        status: RentalStatus.ACTIVE,
        activatedAt: new Date('2026-05-01'),
      });
      await rentalRepo.save(rental);

      await service.execute({
        rentalId: 'R001',
        returnedAt: new Date('2026-05-05'),
      });

      const updatedCustomer = await customerRepo.findById('C001');
      expect(updatedCustomer?.rank).toBe(CustomerRank.SILVER);
      expect(updatedCustomer?.currentRentedItems).toBe(0);
    });

    it('progresses through BRONZE -> SILVER -> GOLD -> DIAMOND across multiple returns', async () => {
      await customerRepo.save(
        new Customer({
          id: 'C_MULTI',
          fullName: 'Multi Customer',
          email: 'multi@example.com',
          rank: CustomerRank.BRONZE,
          currentRentedItems: 5,
        })
      );

      // 1. Return R001: 2,500,000 VND -> SILVER (>= 2M)
      const rental1 = new Rental({
        id: 'R001',
        customerId: 'C_MULTI',
        items: [
          new RentalItem({
            shoeId: 'S001',
            variantId: 'V001',
            shoeName: 'Nike',
            size: 42,
            color: 'Black',
            pricePerDay: 500000,
            quantity: 1,
          }),
        ],
        period: new RentalPeriod(new Date('2026-05-01'), new Date('2026-05-05')),
        status: RentalStatus.ACTIVE,
        activatedAt: new Date('2026-05-01'),
      });
      await rentalRepo.save(rental1);
      await service.execute({ rentalId: 'R001', returnedAt: new Date('2026-05-05') });

      let customer = await customerRepo.findById('C_MULTI');
      expect(customer?.rank).toBe(CustomerRank.SILVER);

      // 2. Return R002: 3,000,000 VND (cumulative 5.5M) -> GOLD (>= 5M)
      const rental2 = new Rental({
        id: 'R002',
        customerId: 'C_MULTI',
        items: [
          new RentalItem({
            shoeId: 'S001',
            variantId: 'V001',
            shoeName: 'Nike',
            size: 42,
            color: 'Black',
            pricePerDay: 600000,
            quantity: 1,
          }),
        ],
        period: new RentalPeriod(new Date('2026-05-10'), new Date('2026-05-14')), // 5 days * 600k = 3M
        status: RentalStatus.ACTIVE,
        activatedAt: new Date('2026-05-10'),
      });
      await rentalRepo.save(rental2);
      await service.execute({ rentalId: 'R002', returnedAt: new Date('2026-05-14') });

      customer = await customerRepo.findById('C_MULTI');
      expect(customer?.rank).toBe(CustomerRank.GOLD);

      // 3. Return R003: 5,000,000 VND (cumulative 10.5M) -> DIAMOND (>= 10M)
      const rental3 = new Rental({
        id: 'R003',
        customerId: 'C_MULTI',
        items: [
          new RentalItem({
            shoeId: 'S001',
            variantId: 'V001',
            shoeName: 'Nike',
            size: 42,
            color: 'Black',
            pricePerDay: 1000000,
            quantity: 1,
          }),
        ],
        period: new RentalPeriod(new Date('2026-05-20'), new Date('2026-05-24')), // 5 days * 1M = 5M
        status: RentalStatus.ACTIVE,
        activatedAt: new Date('2026-05-20'),
      });
      await rentalRepo.save(rental3);
      await service.execute({ rentalId: 'R003', returnedAt: new Date('2026-05-24') });

      customer = await customerRepo.findById('C_MULTI');
      expect(customer?.rank).toBe(CustomerRank.DIAMOND);
    });

    it('does not downgrade DIAMOND customer if returned total is small', async () => {
      await customerRepo.save(
        new Customer({
          id: 'C_DIAMOND',
          fullName: 'Diamond User',
          email: 'diamond@test.com',
          rank: CustomerRank.DIAMOND,
          currentRentedItems: 1,
        })
      );

      const rental = new Rental({
        id: 'R_SMALL',
        customerId: 'C_DIAMOND',
        items: [
          new RentalItem({
            shoeId: 'S001',
            variantId: 'V001',
            shoeName: 'Nike',
            size: 42,
            color: 'Black',
            pricePerDay: 100000,
            quantity: 1,
          }),
        ],
        period: new RentalPeriod(new Date('2026-05-01'), new Date('2026-05-01')), // 1 day = 100,000 VND (< 2M)
        status: RentalStatus.ACTIVE,
        activatedAt: new Date('2026-05-01'),
      });
      await rentalRepo.save(rental);

      await service.execute({
        rentalId: 'R_SMALL',
        returnedAt: new Date('2026-05-01'),
      });

      const customer = await customerRepo.findById('C_DIAMOND');
      expect(customer?.rank).toBe(CustomerRank.DIAMOND);
    });

    it('succeeds with dynamic SQL-style currentRentedItems load and auto-upgrades rank', async () => {
      const baseCustomer = new Customer({
        id: 'C_SQL',
        fullName: 'Sql Customer',
        email: 'sql@test.com',
        rank: CustomerRank.BRONZE,
        currentRentedItems: 0,
      });

      let storedCustomer = baseCustomer;

      const dynamicCustomerRepo = {
        save: async (c: Customer): Promise<void> => {
          storedCustomer = c;
        },
        findById: async (id: string): Promise<Customer | null> => {
          if (id !== 'C_SQL') return null;
          const allRentals = await rentalRepo.findList({ customerId: 'C_SQL' });
          const activeRentals = allRentals.items.filter(
            (r) => r.status === RentalStatus.RESERVED || r.status === RentalStatus.ACTIVE
          );
          const currentRentedItems = activeRentals.reduce((sum, r) => sum + r.totalItems, 0);

          return new Customer({
            id: storedCustomer.id,
            fullName: storedCustomer.fullName,
            email: storedCustomer.email,
            rank: storedCustomer.rank,
            currentRentedItems,
          });
        },
      } as unknown as InMemoryCustomerRepository;

      const dynService = new ReturnRentalService(rentalRepo, dynamicCustomerRepo);

      const rental = new Rental({
        id: 'R_SQL_01',
        customerId: 'C_SQL',
        items: [
          new RentalItem({
            shoeId: 'S001',
            variantId: 'V001',
            shoeName: 'Nike',
            size: 42,
            color: 'Black',
            pricePerDay: 500000,
            quantity: 2,
          }),
        ],
        period: new RentalPeriod(new Date('2026-05-01'), new Date('2026-05-03')), // 3 days * 500k * 2 = 3,000,000 VND
        status: RentalStatus.ACTIVE,
        activatedAt: new Date('2026-05-01'),
      });
      await rentalRepo.save(rental);

      const res = await dynService.execute({
        rentalId: 'R_SQL_01',
        returnedAt: new Date('2026-05-03'),
      });

      expect(res.status).toBe(RentalStatus.RETURNED);
      expect(storedCustomer.rank).toBe(CustomerRank.SILVER); // 3M VND >= 2M threshold
      const afterCustomer = await dynamicCustomerRepo.findById('C_SQL');
      expect(afterCustomer?.currentRentedItems).toBe(0);
    });
  });

  describe('ExtendRentalService', () => {
    let rentalRepo: InMemoryRentalRepository;
    let shoeRepo: InMemoryShoeRepository;
    let checker: InMemoryRentalAvailabilityChecker;
    let extendService: ExtendRentalService;

    beforeEach(async () => {
      rentalRepo = new InMemoryRentalRepository();
      shoeRepo = new InMemoryShoeRepository();
      checker = new InMemoryRentalAvailabilityChecker(rentalRepo, shoeRepo);
      extendService = new ExtendRentalService(rentalRepo, checker);

      const shoe = new Shoe({
        id: 'S001',
        name: 'Runner',
        brand: 'Nike',
        category: 'Running',
        pricePerDay: 100000,
      });
      shoe.addVariant(
        new ShoeVariant({
          id: 'V001',
          size: 42,
          color: 'Black',
          totalQuantity: 2,
          availableQuantity: 2,
        })
      );
      await shoeRepo.save(shoe);

      const period = new RentalPeriod(new Date('2026-06-01'), new Date('2026-06-03')); // 3 days
      const rental = new Rental({
        id: 'R001',
        customerId: 'C001',
        items: [
          new RentalItem({
            shoeId: 'S001',
            variantId: 'V001',
            shoeName: 'Runner',
            size: 42,
            color: 'Black',
            pricePerDay: 100000,
            quantity: 1,
          }),
        ],
        period,
        status: RentalStatus.ACTIVE,
        activatedAt: new Date('2026-06-01'),
      });
      await rentalRepo.save(rental);
    });

    it('successfully extends rental period and recalculates totalAmount', async () => {
      const res = await extendService.execute({
        rentalId: 'R001',
        newEndDate: new Date('2026-06-05'), // 5 days total
        note: 'Customer extended via app',
        requestingCustomerId: 'C001',
      });

      expect(res.endDate).toEqual(new Date(2026, 5, 5));
      expect(res.basePrice).toBe(500000); // 5 days * 100k
      expect(res.totalAmount).toBe(500000);

      const saved = await rentalRepo.findById('R001');
      expect(saved?.period.durationInDays).toBe(5);
    });

    it('rejects extension if new return date is not after current end date', async () => {
      await expect(
        extendService.execute({
          rentalId: 'R001',
          newEndDate: new Date('2026-06-02'),
          requestingCustomerId: 'C001',
        })
      ).rejects.toThrow(/New return date must be after/);
    });

    it('rejects extension if requestingCustomerId does not match rental customerId', async () => {
      await expect(
        extendService.execute({
          rentalId: 'R001',
          newEndDate: new Date('2026-06-05'),
          requestingCustomerId: 'OTHER_USER',
        })
      ).rejects.toThrow(/permission/);
    });

    it('rejects extension when rental status is RETURNED', async () => {
      const returnedRental = new Rental({
        id: 'R_RET',
        customerId: 'C001',
        items: [
          new RentalItem({
            shoeId: 'S001',
            variantId: 'V001',
            shoeName: 'Runner',
            size: 42,
            color: 'Black',
            pricePerDay: 100000,
            quantity: 1,
          }),
        ],
        period: new RentalPeriod(new Date('2026-06-01'), new Date('2026-06-03')),
        status: RentalStatus.RETURNED,
        activatedAt: new Date('2026-06-01'),
        returnedAt: new Date('2026-06-03'),
      });
      await rentalRepo.save(returnedRental);

      await expect(
        extendService.execute({
          rentalId: 'R_RET',
          newEndDate: new Date('2026-06-05'),
          requestingCustomerId: 'C001',
        })
      ).rejects.toThrow(/Only RESERVED or ACTIVE rental can be extended/);
    });

    it('rejects extension when rental status is CANCELLED', async () => {
      const cancelledRental = new Rental({
        id: 'R_CAN',
        customerId: 'C001',
        items: [
          new RentalItem({
            shoeId: 'S001',
            variantId: 'V001',
            shoeName: 'Runner',
            size: 42,
            color: 'Black',
            pricePerDay: 100000,
            quantity: 1,
          }),
        ],
        period: new RentalPeriod(new Date('2026-06-01'), new Date('2026-06-03')),
        status: RentalStatus.CANCELLED,
        cancelledAt: new Date('2026-05-30'),
      });
      await rentalRepo.save(cancelledRental);

      await expect(
        extendService.execute({
          rentalId: 'R_CAN',
          newEndDate: new Date('2026-06-05'),
          requestingCustomerId: 'C001',
        })
      ).rejects.toThrow(/Only RESERVED or ACTIVE rental can be extended/);
    });

    it('rejects extension if new return date equals current end date', async () => {
      await expect(
        extendService.execute({
          rentalId: 'R001',
          newEndDate: new Date('2026-06-03'),
          requestingCustomerId: 'C001',
        })
      ).rejects.toThrow(/New return date must be after/);
    });

    it('rejects extension when another overlapping rental exhausts variant stock during extension window', async () => {
      // V001 total quantity is 2. R001 holds 1 until June 3.
      // Another rental R_BLOCK holds 2 units of V001 from June 4 to June 6.
      const blockingRental = new Rental({
        id: 'R_BLOCK',
        customerId: 'C002',
        items: [
          new RentalItem({
            shoeId: 'S001',
            variantId: 'V001',
            shoeName: 'Runner',
            size: 42,
            color: 'Black',
            pricePerDay: 100000,
            quantity: 2,
          }),
        ],
        period: new RentalPeriod(new Date('2026-06-04'), new Date('2026-06-06')),
        status: RentalStatus.RESERVED,
      });
      await rentalRepo.save(blockingRental);

      // Now R001 tries to extend from June 3 to June 5 (extension window June 4-5)
      await expect(
        extendService.execute({
          rentalId: 'R001',
          newEndDate: new Date('2026-06-05'),
          requestingCustomerId: 'C001',
        })
      ).rejects.toThrow(/INSUFFICIENT_STOCK|not available/);
    });

    it('rejects extension when rental ID does not exist', async () => {
      await expect(
        extendService.execute({
          rentalId: 'NON_EXISTENT_RENTAL',
          newEndDate: new Date('2026-06-05'),
        })
      ).rejects.toThrow(/Rental.*NON_EXISTENT_RENTAL/);
    });

    it('rejects extension if note exceeds 255 chars', async () => {
      await expect(
        extendService.execute({
          rentalId: 'R001',
          newEndDate: new Date('2026-06-05'),
          note: 'a'.repeat(256),
          requestingCustomerId: 'C001',
        })
      ).rejects.toThrow(/Note must be 255 characters or fewer/);
    });
  });

  describe('Date-range availability checker', () => {
    let rentalRepo: InMemoryRentalRepository;
    let shoeRepo: InMemoryShoeRepository;
    let checker: InMemoryRentalAvailabilityChecker;

    beforeEach(async () => {
      rentalRepo = new InMemoryRentalRepository();
      shoeRepo = new InMemoryShoeRepository();
      checker = new InMemoryRentalAvailabilityChecker(rentalRepo, shoeRepo);

      // Rental 1: June 1 to June 5, quantity 2
      await rentalRepo.save(
        new Rental({
          id: 'R001',
          customerId: 'C1',
          items: [
            new RentalItem({
              shoeId: 'S1',
              variantId: 'V1',
              shoeName: 'S',
              size: 42,
              color: 'B',
              pricePerDay: 10,
              quantity: 2,
            }),
          ],
          period: new RentalPeriod(new Date('2026-06-01'), new Date('2026-06-05')),
          status: RentalStatus.RESERVED,
        })
      );

      // Rental 2: June 4 to June 10, quantity 1
      await rentalRepo.save(
        new Rental({
          id: 'R002',
          customerId: 'C2',
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
          period: new RentalPeriod(new Date('2026-06-04'), new Date('2026-06-10')),
          status: RentalStatus.ACTIVE,
          activatedAt: new Date('2026-06-04'),
        })
      );

      // Rental 3: July 1 to July 5 (non-overlapping)
      await rentalRepo.save(
        new Rental({
          id: 'R003',
          customerId: 'C3',
          items: [
            new RentalItem({
              shoeId: 'S1',
              variantId: 'V1',
              shoeName: 'S',
              size: 42,
              color: 'B',
              pricePerDay: 10,
              quantity: 5,
            }),
          ],
          period: new RentalPeriod(new Date('2026-07-01'), new Date('2026-07-05')),
          status: RentalStatus.RESERVED,
        })
      );
    });

    it('returns combined reserved quantity for overlapping period', async () => {
      // Overlaps with both R001 (June 1-5, qty 2) and R002 (June 4-10, qty 1) on June 4-5
      const period = new RentalPeriod(new Date('2026-06-04'), new Date('2026-06-06'));
      const reserved = await checker.getReservedQuantityForVariant('V1', period);
      expect(reserved).toBe(3); // 2 + 1
    });

    it('returns only R001 quantity when period only overlaps R001', async () => {
      const period = new RentalPeriod(new Date('2026-06-01'), new Date('2026-06-02'));
      const reserved = await checker.getReservedQuantityForVariant('V1', period);
      expect(reserved).toBe(2);
    });

    it('returns 0 when period has no overlapping rentals', async () => {
      const period = new RentalPeriod(new Date('2026-06-15'), new Date('2026-06-20'));
      const reserved = await checker.getReservedQuantityForVariant('V1', period);
      expect(reserved).toBe(0);
    });
  });

  describe('transactionalRoute commit-before-response race condition', () => {
    it('buffers res.json until transactionManager.runInTransaction commits', async () => {
      const timeline: string[] = [];
      const mockTxManager: TransactionManager = {
        runInTransaction: async <T>(work: () => Promise<T>): Promise<T> => {
          timeline.push('tx:start');
          const res = await work();
          timeline.push('tx:commit');
          return res;
        },
      };

      const req = {} as Request;
      const res = {
        json: (_body?: unknown) => {
          timeline.push('res:json');
          return res;
        },
        end: () => res,
      } as unknown as Response;

      const middleware = transactionalRoute(mockTxManager, async (_req, r) => {
        timeline.push('handler:call-json');
        r.json({ ok: true });
        timeline.push('handler:done');
      });

      await new Promise<void>((resolve) => {
        middleware(req, res, (err) => {
          if (err) throw err;
        });
        setTimeout(resolve, 30);
      });

      expect(timeline).toEqual([
        'tx:start',
        'handler:call-json',
        'handler:done',
        'tx:commit',
        'res:json',
      ]);
    });

    it('does not send response and forwards error if transaction fails', async () => {
      const mockTxManager: TransactionManager = {
        runInTransaction: async <T>(work: () => Promise<T>): Promise<T> => {
          await work();
          throw new Error('Database commit failure');
        },
      };

      let sent = false;
      let caughtError: unknown = null;
      const req = {} as Request;
      const res = {
        json: () => {
          sent = true;
          return res;
        },
        end: () => res,
      } as unknown as Response;

      const middleware = transactionalRoute(mockTxManager, async (_req, r) => {
        r.json({ ok: true });
      });

      await new Promise<void>((resolve) => {
        middleware(req, res, ((err?: unknown) => {
          caughtError = err;
          resolve();
        }) as NextFunction);
      });

      expect(sent).toBe(false);
      expect(caughtError).toBeInstanceOf(Error);
      expect((caughtError as Error).message).toBe('Database commit failure');
    });
  });

  describe('Phase D: DB-backed Voucher Management & CreateRentalService', () => {
    let customerRepo: InMemoryCustomerRepository;
    let shoeRepo: InMemoryShoeRepository;
    let rentalRepo: InMemoryRentalRepository;
    let checker: InMemoryRentalAvailabilityChecker;
    let voucherRepo: InMemoryVoucherRepository;
    let service: CreateRentalService;

    beforeEach(async () => {
      customerRepo = new InMemoryCustomerRepository();
      shoeRepo = new InMemoryShoeRepository();
      rentalRepo = new InMemoryRentalRepository();
      checker = new InMemoryRentalAvailabilityChecker(rentalRepo, shoeRepo);
      voucherRepo = new InMemoryVoucherRepository();
      service = new CreateRentalService(
        customerRepo,
        shoeRepo,
        rentalRepo,
        checker,
        new ShortIdGenerator('R'),
        voucherRepo
      );

      await customerRepo.save(
        new Customer({
          id: 'C_BRONZE',
          fullName: 'Bronze User',
          email: 'bronze@test.com',
          rank: CustomerRank.BRONZE,
        })
      );

      const shoe = new Shoe({
        id: 'S001',
        name: 'Runner',
        brand: 'Nike',
        category: 'Running',
        pricePerDay: 100000,
      });
      shoe.addVariant(
        new ShoeVariant({
          id: 'V001',
          size: 42,
          color: 'Black',
          totalQuantity: 20,
          availableQuantity: 20,
        })
      );
      await shoeRepo.save(shoe);
    });

    it('applies dynamically created active voucher and increments usedCount', async () => {
      await voucherRepo.save({
        code: 'FLASH30',
        discountPercent: 30,
        description: 'Flash sale 30%',
        isActive: true,
        maxUses: 10,
        expiresAt: '2099-12-31',
      });

      const res = await service.execute({
        customerId: 'C_BRONZE',
        items: [{ variantId: 'V001', quantity: 1 }],
        startDate: new Date('2026-06-01'),
        endDate: new Date('2026-06-01'),
        voucherCode: 'flash30',
      });

      expect(res.discountPercent).toBe(30);
      expect(res.appliedVoucher).toBe('FLASH30');
      expect(res.basePrice).toBe(70000);

      const stored = await voucherRepo.findByCode('FLASH30');
      expect(stored?.usedCount).toBe(1);
    });

    it('rejects expired voucher', async () => {
      await voucherRepo.save({
        code: 'EXPIRED10',
        discountPercent: 10,
        description: 'Expired voucher',
        isActive: true,
        maxUses: null,
        expiresAt: '2020-01-01',
      });

      await expect(
        service.execute({
          customerId: 'C_BRONZE',
          items: [{ variantId: 'V001', quantity: 1 }],
          startDate: new Date('2026-06-01'),
          endDate: new Date('2026-06-01'),
          voucherCode: 'EXPIRED10',
        })
      ).rejects.toThrow(/Mã giảm giá không hợp lệ hoặc đã hết hạn/);
    });

    it('rejects voucher when maxUses is exhausted', async () => {
      await voucherRepo.save({
        code: 'ONCE20',
        discountPercent: 20,
        description: 'Single use voucher',
        isActive: true,
        maxUses: 1,
        expiresAt: null,
      });

      // 1st use succeeds
      const first = await service.execute({
        customerId: 'C_BRONZE',
        items: [{ variantId: 'V001', quantity: 1 }],
        startDate: new Date('2026-06-01'),
        endDate: new Date('2026-06-01'),
        voucherCode: 'ONCE20',
      });
      expect(first.appliedVoucher).toBe('ONCE20');

      // 2nd use rejected
      await expect(
        service.execute({
          customerId: 'C_BRONZE',
          items: [{ variantId: 'V001', quantity: 1 }],
          startDate: new Date('2026-06-02'),
          endDate: new Date('2026-06-02'),
          voucherCode: 'ONCE20',
        })
      ).rejects.toThrow(/Mã giảm giá không hợp lệ hoặc đã hết hạn/);
    });

    it('rejects inactive voucher', async () => {
      await voucherRepo.save({
        code: 'DISABLED15',
        discountPercent: 15,
        description: 'Disabled voucher',
        isActive: false,
        maxUses: null,
        expiresAt: null,
      });

      await expect(
        service.execute({
          customerId: 'C_BRONZE',
          items: [{ variantId: 'V001', quantity: 1 }],
          startDate: new Date('2026-06-01'),
          endDate: new Date('2026-06-01'),
          voucherCode: 'DISABLED15',
        })
      ).rejects.toThrow(/Mã giảm giá không hợp lệ hoặc đã hết hạn/);
    });

    it('throws ValidationError when incrementUsedCount is called after maxUses is reached', async () => {
      await voucherRepo.save({
        code: 'LIMIT1',
        discountPercent: 15,
        description: '1 use only',
        isActive: true,
        maxUses: 1,
        expiresAt: null,
      });

      await voucherRepo.incrementUsedCount('LIMIT1');
      await expect(voucherRepo.incrementUsedCount('LIMIT1')).rejects.toThrow(
        /Mã giảm giá đã hết lượt sử dụng hoặc không còn hiệu lực/
      );
    });

    it('restores voucher usedCount when a RESERVED rental is cancelled or deleted so maxUses: 1 voucher can be reused', async () => {
      await voucherRepo.save({
        code: 'REUSE25',
        discountPercent: 25,
        description: 'Reusable after cancel',
        isActive: true,
        maxUses: 1,
        expiresAt: null,
      });

      // 1. Create rental using REUSE25 -> usedCount becomes 1
      const first = await service.execute({
        customerId: 'C_BRONZE',
        items: [{ variantId: 'V001', quantity: 1 }],
        startDate: new Date('2099-06-10'),
        endDate: new Date('2099-06-11'),
        voucherCode: 'REUSE25',
      });
      expect((await voucherRepo.findByCode('REUSE25'))?.usedCount).toBe(1);

      // 2. Cancel the rental -> usedCount decrements back to 0
      const cancelService = new CancelRentalService(rentalRepo, customerRepo, voucherRepo);
      await cancelService.execute({
        rentalId: first.rentalId,
        cancelledAt: new Date('2099-06-01'),
        note: 'Changed mind',
      });
      expect((await voucherRepo.findByCode('REUSE25'))?.usedCount).toBe(0);

      // 3. Reuse REUSE25 on a new rental -> succeeds!
      const second = await service.execute({
        customerId: 'C_BRONZE',
        items: [{ variantId: 'V001', quantity: 1 }],
        startDate: new Date('2099-06-15'),
        endDate: new Date('2099-06-16'),
        voucherCode: 'REUSE25',
      });
      expect(second.appliedVoucher).toBe('REUSE25');
      expect((await voucherRepo.findByCode('REUSE25'))?.usedCount).toBe(1);

      // 4. Admin deletes the active/reserved rental -> usedCount decrements back to 0
      const deleteService = new DeleteRentalAdminService(rentalRepo, voucherRepo);
      await deleteService.execute({ rentalId: second.rentalId });
      expect((await voucherRepo.findByCode('REUSE25'))?.usedCount).toBe(0);
    });

    it('truncates long customer note cleanly to <= 255 characters when appending discount tag', async () => {
      await customerRepo.save(
        new Customer({
          id: 'C_GOLD_NT',
          fullName: 'Gold Note User',
          email: 'goldnote@test.com',
          rank: CustomerRank.GOLD,
        })
      );

      const longNote = 'Ghi chú của khách hàng rất dài '.repeat(9).slice(0, 250);
      expect(longNote.length).toBe(250);

      const res = await service.execute({
        customerId: 'C_GOLD_NT',
        items: [{ variantId: 'V001', quantity: 1 }],
        startDate: new Date('2026-06-01'),
        endDate: new Date('2026-06-01'),
        voucherCode: 'WELCOME10',
        note: longNote,
      });

      const savedRental = await rentalRepo.findById(res.rentalId);
      expect(savedRental?.note).toBeTruthy();
      expect(savedRental!.note!.length).toBeLessThanOrEqual(255);
      expect(savedRental!.note).toContain('[Ưu đãi: Hạng GOLD -10%, Voucher WELCOME10 -10%]');
    });
  });

  describe('Phase C: Overdue Late-Fee Preview in ListRentals & GetRental', () => {
    let rentalRepo: InMemoryRentalRepository;
    let listService: ListRentalsService;
    let getService: GetRentalService;

    beforeEach(async () => {
      rentalRepo = new InMemoryRentalRepository();
      listService = new ListRentalsService(rentalRepo);
      getService = new GetRentalService(rentalRepo);

      // Overdue rental (Jan 1-5, 2020)
      await rentalRepo.save(
        new Rental({
          id: 'R_OVERDUE',
          customerId: 'C001',
          items: [
            new RentalItem({
              shoeId: 'S001',
              variantId: 'V001',
              shoeName: 'Nike',
              size: 42,
              color: 'Black',
              pricePerDay: 100000,
              quantity: 1,
            }),
          ],
          period: new RentalPeriod(new Date('2020-01-01'), new Date('2020-01-05')),
          status: RentalStatus.ACTIVE,
          activatedAt: new Date('2020-01-01'),
        })
      );

      // Current/future rental (non-overdue)
      await rentalRepo.save(
        new Rental({
          id: 'R_FUTURE',
          customerId: 'C001',
          items: [
            new RentalItem({
              shoeId: 'S001',
              variantId: 'V001',
              shoeName: 'Nike',
              size: 42,
              color: 'Black',
              pricePerDay: 100000,
              quantity: 1,
            }),
          ],
          period: new RentalPeriod(new Date('2099-01-01'), new Date('2099-01-05')),
          status: RentalStatus.ACTIVE,
          activatedAt: new Date('2099-01-01'),
        })
      );
    });

    it('returns isOverdue, overdueDays, and estimatedLateFee in ListRentalsService', async () => {
      const res = await listService.execute();
      const overdue = res.rentals.find((r) => r.rentalId === 'R_OVERDUE');
      const future = res.rentals.find((r) => r.rentalId === 'R_FUTURE');

      expect(overdue?.isOverdue).toBe(true);
      expect(overdue?.overdueDays).toBeGreaterThan(0);
      expect(overdue?.estimatedLateFee).toBeGreaterThan(0);

      expect(future?.isOverdue).toBe(false);
      expect(future?.overdueDays).toBe(0);
      expect(future?.estimatedLateFee).toBe(0);
    });

    it('returns isOverdue, overdueDays, and estimatedLateFee in GetRentalService', async () => {
      const overdue = await getService.execute({ rentalId: 'R_OVERDUE' });
      expect(overdue.isOverdue).toBe(true);
      expect(overdue.overdueDays).toBeGreaterThan(0);
      expect(overdue.estimatedLateFee).toBeGreaterThan(0);

      const future = await getService.execute({ rentalId: 'R_FUTURE' });
      expect(future.isOverdue).toBe(false);
      expect(future.overdueDays).toBe(0);
      expect(future.estimatedLateFee).toBe(0);
    });
  });
});
