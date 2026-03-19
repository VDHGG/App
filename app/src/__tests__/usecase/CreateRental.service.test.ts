import { describe, it, expect, beforeEach } from 'vitest';
import { Container } from '@infra/Container';
import { Customer } from '@domain/Customer.aggregate';
import { CustomerRank } from '@domain/CustomerRank.enum';
import { RentalStatus } from '@domain/RentalStatus.enum';

let container: Container;
let registerCustomer: ReturnType<Container['getRegisterCustomerUseCase']>;
let addShoe: ReturnType<Container['getAddShoeUseCase']>;
let createRental: ReturnType<Container['getCreateRentalUseCase']>;

beforeEach(() => {
  container = new Container();
  registerCustomer = container.getRegisterCustomerUseCase();
  addShoe = container.getAddShoeUseCase();
  createRental = container.getCreateRentalUseCase();
});

async function setupCustomerAndShoe() {
  const customer = await registerCustomer.execute({
    fullName: 'Nguyen Van A',
    email: `a+${Date.now()}@example.com`,
  });
  const shoe = await addShoe.execute({
    name: 'Nike Air Max',
    brand: 'Nike',
    category: 'Sneakers',
    pricePerDay: 50000,
    variants: [
      { size: 41, color: 'Black', totalQuantity: 5 },
      { size: 42, color: 'White', totalQuantity: 3 },
    ],
  });
  return { customer, shoe };
}

describe('CreateRentalService - happy path', () => {
  it('creates and persists a rental with one item', async () => {
    const { customer, shoe } = await setupCustomerAndShoe();
    const variantId = shoe.variantIds[0];
    const today = new Date();
    const in5Days = new Date(today);
    in5Days.setDate(today.getDate() + 5);

    const result = await createRental.execute({
      customerId: customer.customerId,
      items: [{ variantId, quantity: 1 }],
      startDate: today,
      endDate: in5Days,
    });

    expect(result.rentalId).toBeTruthy();
    expect(result.customerId).toBe(customer.customerId);
    expect(result.status).toBe(RentalStatus.RESERVED);
    expect(result.totalItems).toBe(1);
    expect(result.basePrice).toBeGreaterThan(0);
    expect(result.totalAmount).toBeGreaterThan(0);
    expect(result.startDate.toDateString()).toBe(today.toDateString());
    expect(result.endDate.toDateString()).toBe(in5Days.toDateString());

    const rentalRepo = container.getRentalRepository();
    const saved = await rentalRepo.findById(result.rentalId);
    expect(saved).not.toBeNull();
    expect(saved?.status).toBe(RentalStatus.RESERVED);
  });

  it('creates a rental with multiple items from different variants', async () => {
    const { customer, shoe } = await setupCustomerAndShoe();
    const today = new Date();
    const in3Days = new Date(today);
    in3Days.setDate(today.getDate() + 3);

    const result = await createRental.execute({
      customerId: customer.customerId,
      items: [
        { variantId: shoe.variantIds[0], quantity: 2 },
        { variantId: shoe.variantIds[1], quantity: 1 },
      ],
      startDate: today,
      endDate: in3Days,
    });

    expect(result.totalItems).toBe(3);
    expect(result.rentalId).toBeTruthy();
  });

  it('updates customer currentRentedItems after creating rental', async () => {
    const { customer, shoe } = await setupCustomerAndShoe();
    const customerRepo = container.getCustomerRepository();
    const today = new Date();
    const in2Days = new Date(today);
    in2Days.setDate(today.getDate() + 2);

    await createRental.execute({
      customerId: customer.customerId,
      items: [{ variantId: shoe.variantIds[0], quantity: 2 }],
      startDate: today,
      endDate: in2Days,
    });

    const updated = await customerRepo.findById(customer.customerId);
    expect(updated?.currentRentedItems).toBe(2);
  });
});

describe('CreateRentalService - validation errors', () => {
  it('throws when customerId is empty', async () => {
    const { shoe } = await setupCustomerAndShoe();
    const today = new Date();
    const in5Days = new Date(today);
    in5Days.setDate(today.getDate() + 5);

    await expect(
      createRental.execute({
        customerId: '',
        items: [{ variantId: shoe.variantIds[0], quantity: 1 }],
        startDate: today,
        endDate: in5Days,
      })
    ).rejects.toThrow(/not found|required/i);
  });

  it('throws when items is empty', async () => {
    const { customer } = await setupCustomerAndShoe();
    const today = new Date();
    const in5Days = new Date(today);
    in5Days.setDate(today.getDate() + 5);

    await expect(
      createRental.execute({
        customerId: customer.customerId,
        items: [],
        startDate: today,
        endDate: in5Days,
      })
    ).rejects.toThrow(/at least one item/i);
  });

  it('throws when variantId is empty in item', async () => {
    const { customer } = await setupCustomerAndShoe();
    const today = new Date();
    const in5Days = new Date(today);
    in5Days.setDate(today.getDate() + 5);

    await expect(
      createRental.execute({
        customerId: customer.customerId,
        items: [{ variantId: '', quantity: 1 }],
        startDate: today,
        endDate: in5Days,
      })
    ).rejects.toThrow(/not found|required/i);
  });

  it('throws when quantity is zero', async () => {
    const { customer, shoe } = await setupCustomerAndShoe();
    const today = new Date();
    const in5Days = new Date(today);
    in5Days.setDate(today.getDate() + 5);

    await expect(
      createRental.execute({
        customerId: customer.customerId,
        items: [{ variantId: shoe.variantIds[0], quantity: 0 }],
        startDate: today,
        endDate: in5Days,
      })
    ).rejects.toThrow(/positive integer/i);
  });

  it('throws when quantity is not an integer', async () => {
    const { customer, shoe } = await setupCustomerAndShoe();
    const today = new Date();
    const in5Days = new Date(today);
    in5Days.setDate(today.getDate() + 5);

    await expect(
      createRental.execute({
        customerId: customer.customerId,
        items: [{ variantId: shoe.variantIds[0], quantity: 1.5 }],
        startDate: today,
        endDate: in5Days,
      })
    ).rejects.toThrow(/positive integer/i);
  });

  it('throws when duplicate variantId in items', async () => {
    const { customer, shoe } = await setupCustomerAndShoe();
    const variantId = shoe.variantIds[0];
    const today = new Date();
    const in5Days = new Date(today);
    in5Days.setDate(today.getDate() + 5);

    await expect(
      createRental.execute({
        customerId: customer.customerId,
        items: [
          { variantId, quantity: 1 },
          { variantId, quantity: 1 },
        ],
        startDate: today,
        endDate: in5Days,
      })
    ).rejects.toThrow(/duplicate variant/i);
  });

  it('throws when endDate is before startDate', async () => {
    const { customer, shoe } = await setupCustomerAndShoe();
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);

    await expect(
      createRental.execute({
        customerId: customer.customerId,
        items: [{ variantId: shoe.variantIds[0], quantity: 1 }],
        startDate: today,
        endDate: yesterday,
      })
    ).rejects.toThrow(/end date cannot be before start date/i);
  });
});

describe('CreateRentalService - not found errors', () => {
  it('throws when customer does not exist', async () => {
    const { shoe } = await setupCustomerAndShoe();
    const today = new Date();
    const in5Days = new Date(today);
    in5Days.setDate(today.getDate() + 5);

    await expect(
      createRental.execute({
        customerId: 'GHOST_CUSTOMER',
        items: [{ variantId: shoe.variantIds[0], quantity: 1 }],
        startDate: today,
        endDate: in5Days,
      })
    ).rejects.toThrow(/Customer.*GHOST_CUSTOMER.*not found/i);
  });

  it('throws when variant does not exist', async () => {
    const { customer } = await setupCustomerAndShoe();
    const today = new Date();
    const in5Days = new Date(today);
    in5Days.setDate(today.getDate() + 5);

    await expect(
      createRental.execute({
        customerId: customer.customerId,
        items: [{ variantId: 'GHOST_VARIANT', quantity: 1 }],
        startDate: today,
        endDate: in5Days,
      })
    ).rejects.toThrow(/Variant.*GHOST_VARIANT.*not found/i);
  });
});

describe('CreateRentalService - business rule errors', () => {
  it('throws when variant has insufficient stock (overlapping rental)', async () => {
    const { customer, shoe } = await setupCustomerAndShoe();
    const variantId = shoe.variantIds[0];
    const today = new Date();
    const in5Days = new Date(today);
    in5Days.setDate(today.getDate() + 5);

    await createRental.execute({
      customerId: customer.customerId,
      items: [{ variantId, quantity: 5 }],
      startDate: today,
      endDate: in5Days,
    });

    await expect(
      createRental.execute({
        customerId: customer.customerId,
        items: [{ variantId, quantity: 1 }],
        startDate: today,
        endDate: in5Days,
      })
    ).rejects.toThrow(/INSUFFICIENT_STOCK|not available/i);
  });

  it('throws when customer exceeds rental limit (BRONZE = 5)', async () => {
    const customerRepo = container.getCustomerRepository();
    await customerRepo.save(
      new Customer({
        id: 'U999',
        fullName: 'Bronze User',
        email: 'bronze@example.com',
        rank: CustomerRank.BRONZE,
        currentRentedItems: 5,
      })
    );

    const { shoe } = await setupCustomerAndShoe();
    const today = new Date();
    const in5Days = new Date(today);
    in5Days.setDate(today.getDate() + 5);

    await expect(
      createRental.execute({
        customerId: 'U999',
        items: [{ variantId: shoe.variantIds[0], quantity: 1 }],
        startDate: today,
        endDate: in5Days,
      })
    ).rejects.toThrow(/RENTAL_LIMIT_EXCEEDED|cannot rent/i);
  });

  it('throws when customer is inactive', async () => {
    const customerRepo = container.getCustomerRepository();
    await customerRepo.save(
      new Customer({
        id: 'U888',
        fullName: 'Inactive User',
        email: 'inactive@example.com',
        rank: CustomerRank.BRONZE,
        isActive: false,
      })
    );

    const { shoe } = await setupCustomerAndShoe();
    const today = new Date();
    const in5Days = new Date(today);
    in5Days.setDate(today.getDate() + 5);

    await expect(
      createRental.execute({
        customerId: 'U888',
        items: [{ variantId: shoe.variantIds[0], quantity: 1 }],
        startDate: today,
        endDate: in5Days,
      })
    ).rejects.toThrow(/CUSTOMER_INACTIVE|inactive/i);
  });
});
