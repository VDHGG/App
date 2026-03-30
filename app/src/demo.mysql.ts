import '@infra/loadEnv';
import { MysqlContainer } from '@infra/MysqlContainer';

const container = new MysqlContainer();

async function run(): Promise<void> {
  console.log('=== Shoe Rental — MySQL Smoke Test ===\n');

  const register = container.getRegisterCustomerUseCase();
  const addShoe = container.getAddShoeUseCase();
  const createRental = container.getCreateRentalUseCase();
  const activateRental = container.getActivateRentalUseCase();
  const returnRental = container.getReturnRentalUseCase();

  console.log('1. Registering customer...');
  const customer = await register.execute({
    fullName: 'Nguyen Van A',
    email: `vana+${Date.now()}@example.com`,
    phone: '0912345678',
  });
  console.log(` id: ${customer.customerId} | ${customer.fullName} | rank: ${customer.rank}\n`);

  console.log('2. Adding shoe...');
  const shoe = await addShoe.execute({
    name: 'Nike Air Max 270',
    brand: 'Nike',
    category: 'Sneakers',
    description: 'Lightweight daily runner',
    pricePerDay: 50000,
    variants: [
      { size: 41, color: 'Black', totalQuantity: 5 },
      { size: 42, color: 'White', totalQuantity: 3 },
    ],
  });
  console.log(`   id: ${shoe.shoeId} | ${shoe.name} | ${shoe.variantCount} variants`);
  console.log(`   variant IDs: ${shoe.variantIds.join(', ')}\n`);

  const variantId = shoe.variantIds[0];

  const today = new Date();
  const in5Days = new Date(today);
  in5Days.setDate(today.getDate() + 5);

  console.log('3. Creating rental...');
  const rental = await createRental.execute({
    customerId: customer.customerId,
    items: [{ variantId, quantity: 1 }],
    startDate: today,
    endDate: in5Days,
  });
  console.log(`   id: ${rental.rentalId} | status: ${rental.status}`);
  console.log(`   total: ${rental.totalAmount.toLocaleString('vi-VN')} đ\n`);

  console.log('4. Activating rental...');
  const activated = await activateRental.execute({ rentalId: rental.rentalId });
  console.log(`   id: ${activated.rentalId} | status: ${activated.status}\n`);

  console.log('5. Returning rental...');
  const returned = await returnRental.execute({ rentalId: rental.rentalId });
  console.log(`   id: ${returned.rentalId} | status: ${returned.status}`);
  console.log(`   base:  ${returned.basePrice.toLocaleString('vi-VN')} đ`);
  console.log(`   fee:   ${returned.lateFee.toLocaleString('vi-VN')} đ`);
  console.log(`   total: ${returned.totalAmount.toLocaleString('vi-VN')} đ\n`);

  console.log('=== All 5 steps completed successfully ===');
}

run()
  .catch((err: unknown) => {
    console.error('\n Demo failed:', err);
    process.exit(1);
  })
  .finally(() => container.close());
