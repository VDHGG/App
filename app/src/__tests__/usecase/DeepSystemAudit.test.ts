import { describe, it, expect, vi, afterEach } from 'vitest';
import { Customer } from '../../domain/Customer.aggregate';
import { CustomerRank } from '../../domain/CustomerRank.enum';
import { Rental } from '../../domain/Rental.aggregate';
import { RentalItem } from '../../domain/RentalItem.vo';
import { RentalPeriod } from '../../domain/RentalPeriod.vo';
import { Shoe } from '../../domain/Shoe.aggregate';
import { ShoeVariant } from '../../domain/ShoeVariant.entity';
import { RentalStatus } from '../../domain/RentalStatus.enum';
import { ValidationError } from '../../domain/errors/ValidationError';
import { BusinessRuleError } from '../../domain/errors/BusinessRuleError';
import { ForbiddenError } from '../../domain/errors/ForbiddenError';
import {
  ensureValidPositiveNumber,
  ensureValidNonNegativeNumber,
  ensureValidEntityId,
} from '../../domain/errors/validation';
import { CreateRentalService } from '../../usecase/CreateRental.service';
import { CancelRentalService } from '../../usecase/CancelRental.service';
import { DeleteRentalAdminService } from '../../usecase/DeleteRentalAdmin.service';
import { RegisterUserService } from '../../usecase/RegisterUser.service';
import { MomoPaymentController } from '../../adapter/http/MomoPaymentController.adapter';
import { AuthController } from '../../adapter/http/AuthController.adapter';
import type { CustomerRepository as CustomerRepositoryPort } from '../../port/CustomerRepository.port';
import type { ShoeRepository as ShoeRepositoryPort } from '../../port/ShoeRepository.port';
import type { RentalRepository as RentalRepositoryPort } from '../../port/RentalRepository.port';
import type { SystemUserRepository as SystemUserRepositoryPort, SystemUserRecord } from '../../port/SystemUserRepository.port';
import type { VoucherRepository as VoucherRepositoryPort, VoucherRecord } from '../../port/VoucherRepository.port';
import type { RentalAvailabilityChecker } from '../../port/RentalAvailabilityChecker.port';

// Helper mutex to simulate row-level FOR UPDATE locking in concurrent tests
class AsyncMutex {
  private queue: Promise<void> = Promise.resolve();

  async runExclusive<T>(fn: () => Promise<T>): Promise<T> {
    let release!: () => void;
    const prev = this.queue;
    this.queue = new Promise<void>((resolve) => {
      release = resolve;
    });
    await prev;
    try {
      return await fn();
    } finally {
      release();
    }
  }
}

describe('Full System Deep Audit & Adversarial Test Suite (Phases A → P)', () => {
  describe('1. Smart Domain Entities & Boundary Validation', () => {
    it('rejects Infinity, -Infinity, NaN, 0 (for positive), and -1 on numeric validators and domain entities', () => {
      for (const bad of [Infinity, -Infinity, Number.NaN, 0, -1]) {
        expect(() => ensureValidPositiveNumber(bad, 'Price')).toThrow(ValidationError);
      }
      for (const bad of [Infinity, -Infinity, Number.NaN, -1]) {
        expect(() => ensureValidNonNegativeNumber(bad, 'Fee')).toThrow(ValidationError);
      }
      expect(() => ensureValidNonNegativeNumber(0, 'Fee')).not.toThrow();

      // Shoe pricePerDay validation
      expect(() =>
        new Shoe({
          id: 'SH001',
          name: 'Nike Air',
          brand: 'Nike',
          category: 'Sport',
          description: 'Desc',
          pricePerDay: Number.POSITIVE_INFINITY,
        })
      ).toThrow(ValidationError);

      // RentalItem validation
      expect(() =>
        new RentalItem({
          variantId: 'V001',
          shoeId: 'SH001',
          shoeName: 'Nike Air',
          size: 42,
          color: 'White',
          pricePerDay: Number.NaN,
          quantity: 1,
        })
      ).toThrow(ValidationError);

      expect(() =>
        new RentalItem({
          variantId: 'V001',
          shoeId: 'SH001',
          shoeName: 'Nike Air',
          size: 42,
          color: 'White',
          pricePerDay: 0,
          quantity: 1,
        })
      ).toThrow(ValidationError);

      // Rental and Rental.completeReturn damageFee validation
      const item = new RentalItem({
        variantId: 'V001',
        shoeId: 'SH001',
        shoeName: 'Nike Air',
        size: 42,
        color: 'White',
        pricePerDay: 100_000,
        quantity: 1,
      });
      const period = new RentalPeriod(new Date('2026-06-01'), new Date('2026-06-03'));

      expect(() =>
        new Rental({
          id: 'RNT001',
          customerId: 'CUS001',
          items: [item],
          period,
          lateFee: Infinity,
        })
      ).toThrow(ValidationError);

      const rental = new Rental({
        id: 'RNT001',
        customerId: 'CUS001',
        items: [item],
        period,
      });
      rental.activate(new Date('2026-06-01'));
      expect(() => rental.completeReturn(new Date('2026-06-02'), undefined, Infinity)).toThrow(ValidationError);
      expect(() => rental.completeReturn(new Date('2026-06-02'), undefined, Number.NaN)).toThrow(ValidationError);
      expect(() => rental.completeReturn(new Date('2026-06-02'), undefined, -1)).toThrow(ValidationError);
    });

    it('validates Customer email strictly (rejecting "@", "a@", "@b", "user @example.com", empty string)', () => {
      for (const badEmail of ['', '   ', '@', 'a@', '@b', 'user @example.com']) {
        expect(() =>
          new Customer({
            id: 'CUS001',
            fullName: 'Test User',
            email: badEmail,
            phone: '0901234567',
          })
        ).toThrow(ValidationError);
      }

      const validCustomer = new Customer({
        id: 'CUS001',
        fullName: 'Test User',
        email: 'valid.user@example.com',
        phone: '0901234567',
      });
      expect(validCustomer.email).toBe('valid.user@example.com');
    });

    it('rejects entity IDs whose trimmed length exceeds 10 characters', () => {
      expect(() => ensureValidEntityId('A'.repeat(11), 'Customer ID')).toThrow(ValidationError);
      expect(() => ensureValidEntityId('   ', 'Customer ID')).toThrow(ValidationError);
      expect(() => ensureValidEntityId('  CUS0000001  ', 'Customer ID')).not.toThrow();
    });

    it('correctly evaluates Customer.upgradeRankForTotalSpent thresholds and never downgrades', () => {
      const customer = new Customer({
        id: 'CUS001',
        fullName: 'Loyalty Tester',
        email: 'loyalty@example.com',
        phone: '0901234567',
        rank: CustomerRank.BRONZE,
      });

      expect(customer.upgradeRankForTotalSpent(1_999_999)).toBe(false);
      expect(customer.rank).toBe(CustomerRank.BRONZE);

      expect(customer.upgradeRankForTotalSpent(2_000_000)).toBe(true);
      expect(customer.rank).toBe(CustomerRank.SILVER);

      expect(customer.upgradeRankForTotalSpent(5_500_000)).toBe(true);
      expect(customer.rank).toBe(CustomerRank.GOLD);

      expect(customer.upgradeRankForTotalSpent(12_000_000)).toBe(true);
      expect(customer.rank).toBe(CustomerRank.DIAMOND);

      // Never downgrades when already DIAMOND
      expect(customer.upgradeRankForTotalSpent(100_000)).toBe(false);
      expect(customer.rank).toBe(CustomerRank.DIAMOND);
    });

    it('applies RentalItem.withDiscountPercent with 1₫ floor and rejects invalid percentages', () => {
      const item = new RentalItem({
        variantId: 'V001',
        shoeId: 'SH001',
        shoeName: 'Air Jordan 1',
        size: 42,
        color: 'Red',
        pricePerDay: 250_000,
        quantity: 2,
      });

      const zeroDiscount = item.withDiscountPercent(0);
      expect(zeroDiscount.pricePerDay).toBe(250_000);

      const quarterDiscount = item.withDiscountPercent(25);
      expect(quarterDiscount.pricePerDay).toBe(187_500);
      expect(quarterDiscount.quantity).toBe(2);

      const fullDiscount = item.withDiscountPercent(100);
      expect(fullDiscount.pricePerDay).toBe(1);

      for (const invalidPct of [-1, 101, Number.NaN, Number.POSITIVE_INFINITY]) {
        expect(() => item.withDiscountPercent(invalidPct)).toThrow(ValidationError);
      }
    });

    it('supports Rental.assertOwnedBy, Rental.buildExtensionPeriod, and Rental.formatDiscountNote with 255-char safe truncation', () => {
      const item = new RentalItem({
        variantId: 'V001',
        shoeId: 'SH001',
        shoeName: 'Air Jordan 1',
        size: 42,
        color: 'Red',
        pricePerDay: 200_000,
        quantity: 1,
      });
      const rental = new Rental({
        id: 'RNT001',
        customerId: 'CUS001',
        items: [item],
        period: new RentalPeriod(new Date('2026-06-01T00:00:00.000Z'), new Date('2026-06-03T00:00:00.000Z')),
      });

      expect(() => rental.assertOwnedBy('CUS001')).not.toThrow();
      expect(() => rental.assertOwnedBy('CUS999')).toThrow(ForbiddenError);

      const extendedPeriod = rental.buildExtensionPeriod(new Date('2026-06-07T00:00:00.000Z'));
      expect(extendedPeriod.endDate.getTime()).toBeGreaterThan(rental.period.endDate.getTime());
      expect(extendedPeriod.startDate.getTime()).toBeGreaterThan(rental.period.endDate.getTime());
      expect(() => rental.buildExtensionPeriod(new Date('2026-06-03T00:00:00.000Z'))).toThrow(ValidationError);

      // Cancel rental and verify buildExtensionPeriod rejects non-active/non-reserved
      rental.cancel(new Date('2026-06-01T00:00:00.000Z'));
      expect(() => rental.buildExtensionPeriod(new Date('2026-06-07T00:00:00.000Z'))).toThrow(BusinessRuleError);

      // formatDiscountNote preserving [Ưu đãi: ...] within 255 chars
      const longUserNote = 'Ghi chú rất dài '.repeat(25);
      const formatted = Rental.formatDiscountNote(longUserNote, CustomerRank.GOLD, 10, 'SUMMER15', 15);
      expect(formatted).toBeDefined();
      expect(formatted!.length).toBeLessThanOrEqual(255);
      expect(formatted!.endsWith('[Ưu đãi: Hạng GOLD -10%, Voucher SUMMER15 -15%]')).toBe(true);
    });
  });

  describe('2. Concurrency & Race Conditions', () => {
    it('Race Condition 1: prevents concurrent rentals from exceeding Customer Rank item limit via row lock serialization', async () => {
      const customerMutex = new AsyncMutex();
      let storedCustomer = new Customer({
        id: 'CUS001',
        fullName: 'Bronze Customer',
        email: 'bronze@example.com',
        phone: '0901112223',
        rank: CustomerRank.BRONZE, // max 5 items
        currentRentedItems: 0,
      });

      const shoe = new Shoe({
        id: 'SH001',
        name: 'Ultraboost',
        brand: 'Adidas',
        category: 'Running',
        description: 'Comfy',
        pricePerDay: 100_000,
        variants: [
          new ShoeVariant({ id: 'V001', size: 41, color: 'Black', totalQuantity: 10 }),
          new ShoeVariant({ id: 'V002', size: 42, color: 'White', totalQuantity: 10 }),
        ],
      });

      const customerRepo: CustomerRepositoryPort = {
        findById: vi.fn(async (id: string) => {
          if (id !== 'CUS001') return null;
          return new Customer({
            id: storedCustomer.id,
            fullName: storedCustomer.fullName,
            email: storedCustomer.email,
            phone: storedCustomer.phone,
            rank: storedCustomer.rank,
            currentRentedItems: storedCustomer.currentRentedItems,
            isActive: storedCustomer.isActive,
          });
        }),
        findByEmail: vi.fn(async () => null),
        findAll: vi.fn(async () => ({ items: [storedCustomer], total: 1, page: 1, pageSize: 10, totalPages: 1 })),
        save: vi.fn(async (c: Customer) => {
          storedCustomer = c;
        }),
        deleteById: vi.fn(async () => {}),
      };

      const shoeRepo: ShoeRepositoryPort = {
        findById: vi.fn(async () => shoe),
        findByVariantId: vi.fn(async () => shoe),
        findAll: vi.fn(async () => ({ items: [shoe], total: 1, page: 1, pageSize: 10, totalPages: 1 })),
        save: vi.fn(async () => {}),
      };

      const rentalRepo: RentalRepositoryPort = {
        findById: vi.fn(async () => null),
        findList: vi.fn(async () => ({ items: [], total: 0 })),
        save: vi.fn(async () => {}),
        deleteById: vi.fn(async () => {}),
        deleteByCustomerId: vi.fn(async () => {}),
      };

      const availabilityChecker = {
        ensureVariantAvailable: vi.fn(async () => {}),
      } as unknown as RentalAvailabilityChecker;

      let rentalCounter = 0;
      const idGen = { next: vi.fn(() => `RNT00${++rentalCounter}`) };
      const service = new CreateRentalService(customerRepo, shoeRepo, rentalRepo, availabilityChecker, idGen);

      // Run two concurrent requests for 3 items each serialized through customerMutex (simulating FOR UPDATE on customers)
      const [res1, res2] = await Promise.allSettled([
        customerMutex.runExclusive(() =>
          service.execute({
            customerId: 'CUS001',
            startDate: new Date('2026-07-01'),
            endDate: new Date('2026-07-03'),
            items: [{ variantId: 'V001', quantity: 3 }],
          })
        ),
        customerMutex.runExclusive(() =>
          service.execute({
            customerId: 'CUS001',
            startDate: new Date('2026-07-01'),
            endDate: new Date('2026-07-03'),
            items: [{ variantId: 'V002', quantity: 3 }],
          })
        ),
      ]);

      const fulfilled = [res1, res2].filter((r): r is PromiseFulfilledResult<any> => r.status === 'fulfilled');
      const rejected = [res1, res2].filter((r): r is PromiseRejectedResult => r.status === 'rejected');

      expect(fulfilled).toHaveLength(1);
      expect(fulfilled[0].value.totalItems).toBe(3);
      expect(rejected).toHaveLength(1);
      expect(rejected[0].reason).toBeInstanceOf(BusinessRuleError);
      expect(rejected[0].reason.code).toBe('RENTAL_LIMIT_EXCEEDED');
      expect(storedCustomer.currentRentedItems).toBe(3);
    });

    it('Race Condition 2: prevents concurrent last-unit stock double-booking between two customers', async () => {
      const variantMutex = new AsyncMutex();
      const customers = new Map<string, Customer>([
        [
          'CUS001',
          new Customer({ id: 'CUS001', fullName: 'Customer One', email: 'c1@example.com', phone: '0900000001' }),
        ],
        [
          'CUS002',
          new Customer({ id: 'CUS002', fullName: 'Customer Two', email: 'c2@example.com', phone: '0900000002' }),
        ],
      ]);

      const shoe = new Shoe({
        id: 'SH001',
        name: 'Limited Dunk',
        brand: 'Nike',
        category: 'Street',
        description: 'Only 1 unit in stock',
        pricePerDay: 300_000,
        variants: [
          new ShoeVariant({ id: 'V001', size: 42, color: 'Panda', totalQuantity: 1 }),
        ],
      });

      const savedRentals: Rental[] = [];

      const customerRepo: CustomerRepositoryPort = {
        findById: vi.fn(async (id: string) => customers.get(id) ?? null),
        findByEmail: vi.fn(async () => null),
        findAll: vi.fn(async () => ({ items: [], total: 0, page: 1, pageSize: 10, totalPages: 1 })),
        save: vi.fn(async (c: Customer) => {
          customers.set(c.id, c);
        }),
        deleteById: vi.fn(async () => {}),
      };

      const shoeRepo: ShoeRepositoryPort = {
        findById: vi.fn(async () => shoe),
        findByVariantId: vi.fn(async () => shoe),
        findAll: vi.fn(async () => ({ items: [shoe], total: 1, page: 1, pageSize: 10, totalPages: 1 })),
        save: vi.fn(async () => {}),
      };

      const rentalRepo: RentalRepositoryPort = {
        findById: vi.fn(async () => null),
        findList: vi.fn(async () => ({ items: savedRentals, total: savedRentals.length })),
        save: vi.fn(async (r: Rental) => {
          savedRentals.push(r);
        }),
        deleteById: vi.fn(async () => {}),
        deleteByCustomerId: vi.fn(async () => {}),
      };

      const availabilityChecker = {
        ensureVariantAvailable: vi.fn(async (_variantId: string, arg2: unknown, arg3?: unknown) => {
          const requestedQty = typeof arg2 === 'number' ? arg2 : (typeof arg3 === 'number' ? arg3 : 1);
          const alreadyBooked = savedRentals.reduce((sum, r) => sum + r.totalItems, 0);
          if (alreadyBooked + requestedQty > 1) {
            throw new BusinessRuleError('INSUFFICIENT_STOCK', 'Not enough stock for V001');
          }
        }),
      } as unknown as RentalAvailabilityChecker;

      let rentalCounter = 0;
      const idGen = { next: vi.fn(() => `RNT00${++rentalCounter}`) };
      const service = new CreateRentalService(customerRepo, shoeRepo, rentalRepo, availabilityChecker, idGen);

      const [res1, res2] = await Promise.allSettled([
        variantMutex.runExclusive(() =>
          service.execute({
            customerId: 'CUS001',
            startDate: new Date('2026-07-10'),
            endDate: new Date('2026-07-12'),
            items: [{ variantId: 'V001', quantity: 1 }],
          })
        ),
        variantMutex.runExclusive(() =>
          service.execute({
            customerId: 'CUS002',
            startDate: new Date('2026-07-10'),
            endDate: new Date('2026-07-12'),
            items: [{ variantId: 'V001', quantity: 1 }],
          })
        ),
      ]);

      const fulfilled = [res1, res2].filter((r) => r.status === 'fulfilled');
      const rejected = [res1, res2].filter((r): r is PromiseRejectedResult => r.status === 'rejected');

      expect(fulfilled).toHaveLength(1);
      expect(rejected).toHaveLength(1);
      expect(rejected[0].reason.code).toBe('INSUFFICIENT_STOCK');
      expect(savedRentals).toHaveLength(1);
    });

    it('Race Condition 3: enforces deterministic ascending variantId lock order (V001 before V002) and rejects duplicate variantIds', async () => {
      const customer = new Customer({
        id: 'CUS001',
        fullName: 'Deadlock Tester',
        email: 'deadlock@example.com',
        phone: '0901234567',
      });
      const shoe = new Shoe({
        id: 'SH001',
        name: 'Jordan 4',
        brand: 'Nike',
        category: 'Basketball',
        description: 'Classic',
        pricePerDay: 200_000,
        variants: [
          new ShoeVariant({ id: 'V001', size: 41, color: 'White', totalQuantity: 5 }),
          new ShoeVariant({ id: 'V002', size: 42, color: 'Black', totalQuantity: 5 }),
        ],
      });

      const customerRepo: CustomerRepositoryPort = {
        findById: vi.fn(async () => customer),
        findByEmail: vi.fn(async () => null),
        findAll: vi.fn(async () => ({ items: [customer], total: 1, page: 1, pageSize: 10, totalPages: 1 })),
        save: vi.fn(async () => {}),
        deleteById: vi.fn(async () => {}),
      };
      const shoeRepo: ShoeRepositoryPort = {
        findById: vi.fn(async () => shoe),
        findByVariantId: vi.fn(async () => shoe),
        findAll: vi.fn(async () => ({ items: [shoe], total: 1, page: 1, pageSize: 10, totalPages: 1 })),
        save: vi.fn(async () => {}),
      };
      const rentalRepo: RentalRepositoryPort = {
        findById: vi.fn(async () => null),
        findList: vi.fn(async () => ({ items: [], total: 0 })),
        save: vi.fn(async () => {}),
        deleteById: vi.fn(async () => {}),
        deleteByCustomerId: vi.fn(async () => {}),
      };

      const lockedOrder: string[] = [];
      const availabilityChecker = {
        ensureVariantAvailable: vi.fn(async (variantId: string) => {
          lockedOrder.push(variantId);
        }),
      } as unknown as RentalAvailabilityChecker;

      let rentalCounter = 0;
      const idGen = { next: vi.fn(() => `RNT00${++rentalCounter}`) };
      const service = new CreateRentalService(customerRepo, shoeRepo, rentalRepo, availabilityChecker, idGen);

      // Pass V002 before V001
      await service.execute({
        customerId: 'CUS001',
        startDate: new Date('2026-08-01'),
        endDate: new Date('2026-08-03'),
        items: [
          { variantId: 'V002', quantity: 1 },
          { variantId: 'V001', quantity: 1 },
        ],
      });

      expect(lockedOrder).toEqual(['V001', 'V002']);

      // Reject duplicate variantId items immediately
      await expect(
        service.execute({
          customerId: 'CUS001',
          startDate: new Date('2026-08-01'),
          endDate: new Date('2026-08-03'),
          items: [
            { variantId: 'V001', quantity: 1 },
            { variantId: 'V001', quantity: 1 },
          ],
        })
      ).rejects.toThrow(ValidationError);
    });

    it('Race Condition 4: prevents concurrent double-cancel from refunding voucher or decrementing customer items twice', async () => {
      const cancelMutex = new AsyncMutex();
      let storedCustomer = new Customer({
        id: 'CUS001',
        fullName: 'Cancel Tester',
        email: 'cancel@example.com',
        phone: '0901234567',
        currentRentedItems: 2,
      });

      const discountNote = Rental.formatDiscountNote(undefined, CustomerRank.BRONZE, 0, 'VIPONE', 20) ?? undefined;

      let storedRental = new Rental({
        id: 'RNT001',
        customerId: 'CUS001',
        items: [
          new RentalItem({
            variantId: 'V001',
            shoeId: 'SH001',
            shoeName: 'Air Force 1',
            size: 42,
            color: 'White',
            pricePerDay: 150_000,
            quantity: 2,
          }),
        ],
        period: new RentalPeriod(new Date('2026-08-01'), new Date('2026-08-03')),
        status: RentalStatus.RESERVED,
        note: discountNote,
      });

      let storedVoucher: VoucherRecord = {
        code: 'VIPONE',
        discountPercent: 20,
        maxUses: 1,
        usedCount: 1,
        isActive: true,
        expiresAt: null,
        description: 'Single use voucher',
        createdAt: '2026-08-01T00:00:00.000Z',
      };

      const rentalRepo: RentalRepositoryPort = {
        findById: vi.fn(async (id: string) => (id === 'RNT001' ? storedRental : null)),
        findList: vi.fn(async () => ({ items: [storedRental], total: 1 })),
        save: vi.fn(async (r: Rental) => {
          storedRental = r;
        }),
        deleteById: vi.fn(async () => {}),
        deleteByCustomerId: vi.fn(async () => {}),
      };

      const customerRepo: CustomerRepositoryPort = {
        findById: vi.fn(async () =>
          new Customer({
            id: storedCustomer.id,
            fullName: storedCustomer.fullName,
            email: storedCustomer.email,
            phone: storedCustomer.phone,
            rank: storedCustomer.rank,
            currentRentedItems: storedCustomer.currentRentedItems,
            isActive: storedCustomer.isActive,
          })
        ),
        findByEmail: vi.fn(async () => null),
        findAll: vi.fn(async () => ({ items: [storedCustomer], total: 1, page: 1, pageSize: 10, totalPages: 1 })),
        save: vi.fn(async (c: Customer) => {
          storedCustomer = c;
        }),
        deleteById: vi.fn(async () => {}),
      };

      const voucherRepo = {
        findByCode: vi.fn(async () => storedVoucher),
        findAll: vi.fn(async () => [storedVoucher]),
        save: vi.fn(async () => {}),
        deleteByCode: vi.fn(async () => {}),
        tryIncrementUsedCount: vi.fn(async () => true),
        decrementUsedCount: vi.fn(async (code: string) => {
          if (code === 'VIPONE' && storedVoucher.usedCount > 0) {
            storedVoucher = { ...storedVoucher, usedCount: storedVoucher.usedCount - 1 };
          }
        }),
      } as unknown as VoucherRepositoryPort;

      const cancelService = new CancelRentalService(rentalRepo, customerRepo, voucherRepo);

      const [res1, res2] = await Promise.allSettled([
        cancelMutex.runExclusive(() => cancelService.execute({ rentalId: 'RNT001' })),
        cancelMutex.runExclusive(() => cancelService.execute({ rentalId: 'RNT001' })),
      ]);

      const fulfilled = [res1, res2].filter((r) => r.status === 'fulfilled');
      const rejected = [res1, res2].filter((r): r is PromiseRejectedResult => r.status === 'rejected');

      expect(fulfilled).toHaveLength(1);
      expect(rejected).toHaveLength(1);
      expect(rejected[0].reason).toBeInstanceOf(BusinessRuleError);
      expect(rejected[0].reason.code).toBe('INVALID_RENTAL_STATE');
      expect(storedVoucher.usedCount).toBe(0);
      expect(voucherRepo.decrementUsedCount).toHaveBeenCalledTimes(1);
      expect(storedCustomer.currentRentedItems).toBe(0);
    });

    it('restores customer currentRentedItems and voucher usedCount when DeleteRentalAdminService deletes a RESERVED rental', async () => {
      let storedCustomer = new Customer({
        id: 'CUS001',
        fullName: 'Delete Admin Tester',
        email: 'deladmin@example.com',
        phone: '0901234567',
        currentRentedItems: 2,
      });

      const discountNote = Rental.formatDiscountNote(undefined, CustomerRank.BRONZE, 0, 'ONCE10', 10) ?? undefined;

      const storedRental = new Rental({
        id: 'RNT009',
        customerId: 'CUS001',
        items: [
          new RentalItem({
            variantId: 'V001',
            shoeId: 'SH001',
            shoeName: 'NB 550',
            size: 42,
            color: 'Grey',
            pricePerDay: 150_000,
            quantity: 2,
          }),
        ],
        period: new RentalPeriod(new Date('2026-08-10'), new Date('2026-08-12')),
        status: RentalStatus.RESERVED,
        note: discountNote,
      });

      let storedVoucher: VoucherRecord = {
        code: 'ONCE10',
        discountPercent: 10,
        maxUses: 1,
        usedCount: 1,
        isActive: true,
        expiresAt: null,
        description: 'One use',
        createdAt: '2026-08-01T00:00:00.000Z',
      };

      const rentalRepo: RentalRepositoryPort = {
        findById: vi.fn(async (id: string) => (id === 'RNT009' ? storedRental : null)),
        findList: vi.fn(async () => ({ items: [storedRental], total: 1 })),
        save: vi.fn(async () => {}),
        deleteById: vi.fn(async () => {}),
        deleteByCustomerId: vi.fn(async () => {}),
      };

      const customerRepo: CustomerRepositoryPort = {
        findById: vi.fn(async (id: string) => (id === 'CUS001' ? storedCustomer : null)),
        findByEmail: vi.fn(async () => null),
        findAll: vi.fn(async () => ({ items: [storedCustomer], total: 1, page: 1, pageSize: 10, totalPages: 1 })),
        save: vi.fn(async (c: Customer) => {
          storedCustomer = c;
        }),
        deleteById: vi.fn(async () => {}),
      };

      const voucherRepo = {
        findByCode: vi.fn(async () => storedVoucher),
        findAll: vi.fn(async () => [storedVoucher]),
        save: vi.fn(async () => {}),
        deleteByCode: vi.fn(async () => {}),
        tryIncrementUsedCount: vi.fn(async () => true),
        decrementUsedCount: vi.fn(async (code: string) => {
          if (code === 'ONCE10' && storedVoucher.usedCount > 0) {
            storedVoucher = { ...storedVoucher, usedCount: storedVoucher.usedCount - 1 };
          }
        }),
      } as unknown as VoucherRepositoryPort;

      expect(storedCustomer.currentRentedItems).toBe(2);
      expect(storedVoucher.usedCount).toBe(1);

      const deleteService = new DeleteRentalAdminService(rentalRepo, voucherRepo, customerRepo);
      await deleteService.execute({ rentalId: 'RNT009' });

      expect(storedCustomer.currentRentedItems).toBe(0);
      expect(storedVoucher.usedCount).toBe(0);
      expect(rentalRepo.deleteById).toHaveBeenCalledWith('RNT009');
    });
  });

  describe('3. Security & Abuse Protection (RegisterUserService, MomoPaymentController, AuthController)', () => {
    it('blocks registration when matching walk-in customer is deactivated (isActive: false)', async () => {
      const inactiveWalkIn = new Customer({
        id: 'CUS_BAN',
        fullName: 'Banned Walk-in',
        email: 'banned@example.com',
        phone: '0909999999',
        isActive: false,
      });

      const systemUsers = {
        findById: vi.fn(async () => null),
        findByEmail: vi.fn(async () => null),
        findByCustomerId: vi.fn(async () => null),
        save: vi.fn(async () => {}),
      } as unknown as SystemUserRepositoryPort;

      const customerRepo: CustomerRepositoryPort = {
        findById: vi.fn(async () => inactiveWalkIn),
        findByEmail: vi.fn(async (email: string) =>
          email.toLowerCase() === 'banned@example.com' ? inactiveWalkIn : null
        ),
        findAll: vi.fn(async () => ({ items: [inactiveWalkIn], total: 1, page: 1, pageSize: 10, totalPages: 1 })),
        save: vi.fn(async () => {}),
        deleteById: vi.fn(async () => {}),
      };

      const txManager = {
        runInTransaction: vi.fn(async <T>(fn: () => Promise<T>) => fn()),
      };
      const registerCustomer = {
        execute: vi.fn(async () => ({ customerId: 'CUS_NEW' })),
      };
      const userIdGen = {
        next: vi.fn(() => 'USR001'),
      };
      const tokenService = {
        createAccessToken: vi.fn(async () => 'jwt_token'),
      };

      const registerService = new RegisterUserService(
        txManager as any,
        customerRepo,
        registerCustomer as any,
        systemUsers,
        userIdGen as any,
        tokenService as any
      );

      await expect(
        registerService.execute({
          fullName: 'Banned Walk-in',
          email: 'banned@example.com',
          phone: '0909999999',
          password: 'Password123!',
        })
      ).rejects.toThrow(ForbiddenError);

      try {
        await registerService.execute({
          fullName: 'Banned Walk-in',
          email: 'banned@example.com',
          phone: '0909999999',
          password: 'Password123!',
        });
      } catch (err: any) {
        expect(err).toBeInstanceOf(ForbiddenError);
        expect(err.code).toBe('CUSTOMER_INACTIVE');
      }

      expect(systemUsers.save).not.toHaveBeenCalled();
    });

    describe('Fail-Closed MoMo IPN Verification (MomoPaymentController)', () => {
      const originalSecret = process.env.MOMO_SECRET_KEY;

      afterEach(() => {
        if (originalSecret === undefined) {
          delete process.env.MOMO_SECRET_KEY;
        } else {
          process.env.MOMO_SECRET_KEY = originalSecret;
        }
      });

      it('responds with 503 and does NOT mark payment PAID when MOMO_SECRET_KEY is unset/empty', async () => {
        delete process.env.MOMO_SECRET_KEY;

        const paymentRepo = {
          updateFromIpn: vi.fn(async () => {}),
          findByRentalId: vi.fn(async () => []),
          findByOrderId: vi.fn(async () => null),
          save: vi.fn(async () => {}),
        };
        const rentalRepo = {
          findById: vi.fn(async () => null),
        };
        const controller = new MomoPaymentController(rentalRepo as any, paymentRepo as any);

        const req: any = {
          body: {
            orderId: 'ORD_123',
            resultCode: 0,
            transId: 99999,
            message: 'Success',
            signature: 'forged_sig',
          },
        };
        const res: any = {
          status: vi.fn().mockReturnThis(),
          json: vi.fn().mockReturnThis(),
        };

        await (controller as any).ipn(req, res);

        expect(res.status).toHaveBeenCalledWith(503);
        expect(paymentRepo.updateFromIpn).not.toHaveBeenCalled();
      });

      it('responds with 400 and does NOT call updateFromIpn when MOMO_SECRET_KEY is set and signature is invalid or missing', async () => {
        process.env.MOMO_SECRET_KEY = 'super_secret_momo_key_for_test';

        const paymentRepo = {
          updateFromIpn: vi.fn(async () => {}),
          findByRentalId: vi.fn(async () => []),
          findByOrderId: vi.fn(async () => null),
          save: vi.fn(async () => {}),
        };
        const rentalRepo = {
          findById: vi.fn(async () => null),
        };
        const controller = new MomoPaymentController(rentalRepo as any, paymentRepo as any);

        const req: any = {
          body: {
            orderId: 'ORD_123',
            resultCode: 0,
            transId: 99999,
            message: 'Success',
            signature: 'invalid_signature_value',
          },
        };
        const res: any = {
          status: vi.fn().mockReturnThis(),
          json: vi.fn().mockReturnThis(),
        };

        await (controller as any).ipn(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(paymentRepo.updateFromIpn).not.toHaveBeenCalled();
      });
    });

    describe('Deactivated User Session Rejection (AuthController.me)', () => {
      it('responds with 401 UNAUTHORIZED when systemUser or linked customer has isActive: false', async () => {
        const inactiveUser: SystemUserRecord = {
          userId: 'USR001',
          fullName: 'Deactivated User',
          email: 'deactivated@example.com',
          phone: '0901112222',
          passwordHash: 'hash',
          roleId: 2,
          customerId: 'CUS001',
          isActive: false,
        };

        const systemUsers: Partial<SystemUserRepositoryPort> = {
          findById: vi.fn(async () => inactiveUser),
        };
        const customerRepo: Partial<CustomerRepositoryPort> = {
          findById: vi.fn(async () => null),
        };

        const controller = new AuthController(
          {} as any,
          {} as any,
          systemUsers as SystemUserRepositoryPort,
          {} as any,
          {} as any,
          {} as any,
          ((_req: any, _res: any, next: any) => next()) as any,
          customerRepo as CustomerRepositoryPort
        );

        const req: any = {
          user: { sub: 'USR001', role: 'customer', customerId: 'CUS001' },
        };
        const res: any = {
          status: vi.fn().mockReturnThis(),
          json: vi.fn().mockReturnThis(),
        };

        await (controller as any).me(req, res);

        expect(res.status).toHaveBeenCalledWith(401);

        // Also test when systemUser is active, but linked customer is inactive
        const activeUserWithInactiveCustomer: SystemUserRecord = {
          ...inactiveUser,
          isActive: true,
        };
        (systemUsers.findById as any).mockResolvedValueOnce(activeUserWithInactiveCustomer);
        (customerRepo.findById as any).mockResolvedValueOnce(
          new Customer({
            id: 'CUS001',
            fullName: 'Deactivated Customer',
            email: 'deactivated@example.com',
            phone: '0901112222',
            isActive: false,
          })
        );

        const res2: any = {
          status: vi.fn().mockReturnThis(),
          json: vi.fn().mockReturnThis(),
        };

        await (controller as any).me(req, res2);
        expect(res2.status).toHaveBeenCalledWith(401);
      });
    });
  });
});
