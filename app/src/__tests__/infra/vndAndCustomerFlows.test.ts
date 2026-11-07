import { describe, it, expect, beforeEach } from 'vitest';
import { formatCurrency } from '../../lib/format';
import { customerMayCancelReserved } from '../../lib/rentalCustomerUi';
import { ChatController } from '@adapter/http/ChatController.adapter';
import { ListRentalsService } from '@usecase/ListRentals.service';
import { GetRentalService } from '@usecase/GetRental.service';
import { ListShoesService } from '@usecase/ListShoes.service';
import { InMemoryRentalRepository } from '@adapter/persistence/InMemoryRentalRepository.adapter';
import { InMemoryShoeRepository } from '@adapter/persistence/InMemoryShoeRepository.adapter';
import { NoopShoeImageService } from '@adapter/persistence/NoopShoeImageService.adapter';
import { Shoe } from '@domain/Shoe.aggregate';
import { ShoeVariant } from '@domain/ShoeVariant.entity';
import { Rental } from '@domain/Rental.aggregate';
import { RentalItem } from '@domain/RentalItem.vo';
import { RentalPeriod } from '@domain/RentalPeriod.vo';
import { RentalStatus } from '@domain/RentalStatus.enum';

describe('vndAndCustomerFlows', () => {
  describe('formatCurrency', () => {
    it('formats 0 to 0₫', () => {
      expect(formatCurrency(0)).toBe('0₫');
    });

    it('formats 250000 containing 250 and 000₫', () => {
      const formatted = formatCurrency(250000);
      expect(formatted).toContain('250');
      expect(formatted).toContain('000₫');
    });

    it('rounds decimal VND like 1500000.4 to integer VND with ₫', () => {
      const formatted = formatCurrency(1500000.4);
      expect(formatted).toContain('1');
      expect(formatted).toContain('500');
      expect(formatted).toContain('000₫');
      expect(formatted.endsWith('₫')).toBe(true);
      expect(formatted).not.toContain(',4');
      expect(formatted).not.toContain('.4');
    });
  });

  describe('customerMayCancelReserved', () => {
    const fixedNow = new Date(2026, 5, 1, 10, 0, 0); // June 1, 2026 local time

    it('returns true when RESERVED with start date >= 1 calendar day ahead', () => {
      const tomorrow = new Date(2026, 5, 2, 0, 0, 0).toISOString();
      const nextWeek = new Date(2026, 5, 8, 0, 0, 0).toISOString();
      expect(customerMayCancelReserved(tomorrow, 'RESERVED', fixedNow)).toBe(true);
      expect(customerMayCancelReserved(nextWeek, 'RESERVED', fixedNow)).toBe(true);
    });

    it('returns false when RESERVED on the same calendar day', () => {
      const sameDay = new Date(2026, 5, 1, 18, 0, 0).toISOString();
      expect(customerMayCancelReserved(sameDay, 'RESERVED', fixedNow)).toBe(false);
    });

    it('returns false when RESERVED in the past', () => {
      const pastDay = new Date(2026, 4, 30, 0, 0, 0).toISOString();
      expect(customerMayCancelReserved(pastDay, 'RESERVED', fixedNow)).toBe(false);
    });

    it('returns false for ACTIVE, RETURNED, CANCELLED even with future start date', () => {
      const futureDay = new Date(2026, 5, 10, 0, 0, 0).toISOString();
      expect(customerMayCancelReserved(futureDay, 'ACTIVE', fixedNow)).toBe(false);
      expect(customerMayCancelReserved(futureDay, 'RETURNED', fixedNow)).toBe(false);
      expect(customerMayCancelReserved(futureDay, 'CANCELLED', fixedNow)).toBe(false);
    });
  });

  describe('ChatController VND tool execution', () => {
    let chatController: ChatController;
    let shoeRepo: InMemoryShoeRepository;
    let rentalRepo: InMemoryRentalRepository;

    beforeEach(async () => {
      shoeRepo = new InMemoryShoeRepository();
      rentalRepo = new InMemoryRentalRepository();

      const listRentals = new ListRentalsService(rentalRepo);
      const getRental = new GetRentalService(rentalRepo);
      const listShoes = new ListShoesService(shoeRepo, new NoopShoeImageService());

      chatController = new ChatController(listRentals, getRental, listShoes);

      // Seed shoes with VND prices
      const shoeA = new Shoe({
        id: 'S001',
        name: 'Shoe 200k',
        brand: 'Nike',
        category: 'Running',
        pricePerDay: 200000,
      });
      shoeA.addVariant(new ShoeVariant({ id: 'V001', size: 42, color: 'Black', totalQuantity: 5, availableQuantity: 5 }));

      const shoeB = new Shoe({
        id: 'S002',
        name: 'Shoe 300k',
        brand: 'Adidas',
        category: 'Sport',
        pricePerDay: 300000,
      });
      shoeB.addVariant(new ShoeVariant({ id: 'V002', size: 42, color: 'White', totalQuantity: 3, availableQuantity: 3 }));

      const shoeC = new Shoe({
        id: 'S003',
        name: 'Shoe 500k',
        brand: 'Puma',
        category: 'Casual',
        pricePerDay: 500000,
      });
      shoeC.addVariant(new ShoeVariant({ id: 'V003', size: 42, color: 'Red', totalQuantity: 2, availableQuantity: 2 }));

      await shoeRepo.save(shoeA);
      await shoeRepo.save(shoeB);
      await shoeRepo.save(shoeC);

      // Seed rental for customer U001
      const period = new RentalPeriod(new Date('2026-06-01'), new Date('2026-06-03'));
      const rental = new Rental({
        id: 'R001',
        customerId: 'U001',
        items: [
          new RentalItem({
            shoeId: 'S001',
            variantId: 'V001',
            shoeName: 'Shoe 200k',
            size: 42,
            color: 'Black',
            pricePerDay: 200000,
            quantity: 1,
          }),
        ],
        period,
        status: RentalStatus.RESERVED,
      });
      await rentalRepo.save(rental);
    });

    it('search_shoes with max_price_vnd: 250000 returns only shoes <= 250000', async () => {
      const res = (await (chatController as any).runTool(
        'search_shoes',
        { max_price_vnd: 250000 },
        undefined
      )) as { ok: boolean; shoes: Array<{ shoeId: string; pricePerDay: number }> };

      expect(res.ok).toBe(true);
      expect(res.shoes).toHaveLength(1);
      expect(res.shoes[0].shoeId).toBe('S001');
      expect(res.shoes[0].pricePerDay).toBe(200000);
    });

    it('search_shoes with shorthand max_price_usd: 300 normalizes to 300,000 VND', async () => {
      const res = (await (chatController as any).runTool(
        'search_shoes',
        { max_price_usd: 300 },
        undefined
      )) as { ok: boolean; shoes: Array<{ shoeId: string; pricePerDay: number }> };

      expect(res.ok).toBe(true);
      expect(res.shoes).toHaveLength(2);
      const ids = res.shoes.map((s) => s.shoeId).sort();
      expect(ids).toEqual(['S001', 'S002']);
    });

    it('search_shoes with max_price_vnd: -10 returns { ok: false }', async () => {
      const res = (await (chatController as any).runTool(
        'search_shoes',
        { max_price_vnd: -10 },
        undefined
      )) as { ok: boolean };

      expect(res.ok).toBe(false);
    });

    it('list_my_rentals without customerId returns { ok: false }', async () => {
      const res = (await (chatController as any).runTool(
        'list_my_rentals',
        {},
        undefined
      )) as { ok: boolean };

      expect(res.ok).toBe(false);
    });

    it('list_my_rentals with customerId returns the customer rentals', async () => {
      const res = (await (chatController as any).runTool(
        'list_my_rentals',
        {},
        'U001'
      )) as { ok: boolean; rentals: Array<{ rentalId: string }>; total: number };

      expect(res.ok).toBe(true);
      expect(res.total).toBe(1);
      expect(res.rentals[0].rentalId).toBe('R001');
    });
  });
});
