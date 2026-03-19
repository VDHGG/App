import { describe, it, expect } from 'vitest';
import { Rental } from '@domain/Rental.aggregate';
import { RentalItem } from '@domain/RentalItem.vo';
import { RentalPeriod } from '@domain/RentalPeriod.vo';
import { RentalStatus } from '@domain/RentalStatus.enum';

function makeItem(overrides: Partial<ConstructorParameters<typeof RentalItem>[0]> = {}) {
  return new RentalItem({
    shoeId: 'S001',
    variantId: 'V001',
    shoeName: 'Test Shoe',
    size: 42,
    color: 'Black',
    pricePerDay: 10,
    quantity: 1,
    ...overrides,
  });
}

function makeRental(overrides: Partial<ConstructorParameters<typeof Rental>[0]> = {}) {
  return new Rental({
    id: 'R001',
    customerId: 'U001',
    items: [makeItem()],
    period: new RentalPeriod(new Date('2026-04-01'), new Date('2026-04-05')),
    ...overrides,
  });
}


describe('Rental.completeReturn', () => {
  it('transitions RESERVED → RETURNED', () => {
    const rental = makeRental();

    rental.completeReturn();

    expect(rental.status).toBe(RentalStatus.RETURNED);
    expect(rental.returnedAt).toBeInstanceOf(Date);
  });

  it('transitions ACTIVE → RETURNED', () => {
    const rental = makeRental();
    rental.activate();

    rental.completeReturn();

    expect(rental.status).toBe(RentalStatus.RETURNED);
  });

  it('sets lateFee and note on return', () => {
    const rental = makeRental();

    rental.completeReturn(new Date('2026-04-20'), 'scuffed sole');

    expect(rental.lateFee).toBe(75);
    expect(rental.note).toBe('scuffed sole');
    expect(rental.totalAmount).toBe(rental.basePrice + 75);
  });

  it('throws when already RETURNED', () => {
    const rental = makeRental();
    rental.completeReturn();

    expect(() => rental.completeReturn()).toThrow(/RESERVED or ACTIVE/);
  });

  it('throws when CANCELLED', () => {
    const rental = makeRental();
    rental.cancel();

    expect(() => rental.completeReturn()).toThrow(/RESERVED or ACTIVE/);
  });
});


describe('Rental.cancel', () => {
  it('transitions RESERVED → CANCELLED', () => {
    const rental = makeRental();

    rental.cancel();

    expect(rental.status).toBe(RentalStatus.CANCELLED);
    expect(rental.cancelledAt).toBeInstanceOf(Date);
  });

  it('stores note on cancel', () => {
    const rental = makeRental();

    rental.cancel(new Date(), 'customer changed mind');

    expect(rental.note).toBe('customer changed mind');
  });

  it('throws when ACTIVE (cannot cancel active rental)', () => {
    const rental = makeRental();
    rental.activate();

    expect(() => rental.cancel()).toThrow(/RESERVED/);
  });

  it('throws when already RETURNED', () => {
    const rental = makeRental();
    rental.completeReturn();

    expect(() => rental.cancel()).toThrow(/RESERVED/);
  });
});


describe('Rental.activate', () => {
  it('transitions RESERVED → ACTIVE', () => {
    const rental = makeRental();

    rental.activate();

    expect(rental.status).toBe(RentalStatus.ACTIVE);
    expect(rental.activatedAt).toBeInstanceOf(Date);
  });

  it('throws when already ACTIVE', () => {
    const rental = makeRental();
    rental.activate();

    expect(() => rental.activate()).toThrow(/RESERVED/);
  });
});


describe('Rental.isOverdue', () => {
  it('returns true for RESERVED rental past endDate', () => {
    const rental = makeRental();

    expect(rental.isOverdue(new Date('2026-04-10'))).toBe(true);
  });

  it('returns true for ACTIVE rental past endDate', () => {
    const rental = makeRental();
    rental.activate();

    expect(rental.isOverdue(new Date('2026-04-10'))).toBe(true);
  });

  it('returns false on the endDate itself', () => {
    const rental = makeRental();

    expect(rental.isOverdue(new Date('2026-04-05'))).toBe(false);
  });

  it('returns false when RETURNED regardless of date', () => {
    const rental = makeRental();
    rental.completeReturn();

    expect(rental.isOverdue(new Date('2026-12-31'))).toBe(false);
  });

  it('returns false when CANCELLED regardless of date', () => {
    const rental = makeRental();
    rental.cancel();

    expect(rental.isOverdue(new Date('2026-12-31'))).toBe(false);
  });
});


describe('Rental.pricing', () => {
  it('calculates basePrice correctly (quantity × pricePerDay × days)', () => {
    const rental = makeRental({
      items: [makeItem({ pricePerDay: 10, quantity: 2 })],
      period: new RentalPeriod(new Date('2026-04-01'), new Date('2026-04-03')),
    });


    expect(rental.basePrice).toBe(60);
  });

  it('totalAmount equals basePrice when no lateFee', () => {
    const rental = makeRental();

    expect(rental.totalAmount).toBe(rental.basePrice);
  });

  it('totalItems sums quantities across all rental items', () => {
    const rental = makeRental({
      items: [
        makeItem({ variantId: 'V001', quantity: 2 }),
        makeItem({ variantId: 'V002', quantity: 3 }),
      ],
    });

    expect(rental.totalItems).toBe(5);
  });
});
