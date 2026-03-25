import { Customer } from '@domain/Customer.aggregate';
import { CustomerRank } from '@domain/CustomerRank.enum';
import { Shoe } from '@domain/Shoe.aggregate';
import { ShoeVariant } from '@domain/ShoeVariant.entity';
import { Container } from '@infra/Container';

async function seed(container: ReturnType<typeof createContainer>) {
  const customerRepo = container.getCustomerRepository();
  const shoeRepo = container.getShoeRepository();

  await customerRepo.save(
    new Customer({ id: 'U001', fullName: 'Nguyen Van A', email: 'a@gmail.com', rank: CustomerRank.BRONZE })
  );
  await customerRepo.save(
    new Customer({ id: 'U002', fullName: 'Tran Thi B', email: 'b@gmail.com', rank: CustomerRank.SILVER })
  );
  await customerRepo.save(
    new Customer({ id: 'U003', fullName: 'Le Van C', email: 'c@gmail.com', rank: CustomerRank.GOLD })
  );

  const adidasSpeedRun = new Shoe({
    id: 'S001',
    name: 'Adidas Speed Run',
    brand: 'Adidas',
    category: 'Running',
    description: 'Lightweight running shoes',
    pricePerDay: 5,
  });
  adidasSpeedRun.addVariant(new ShoeVariant({ id: 'V001', size: 44, color: 'White', totalQuantity: 5 }));
  adidasSpeedRun.addVariant(new ShoeVariant({ id: 'V002', size: 44, color: 'Black', totalQuantity: 3 }));
  adidasSpeedRun.addVariant(new ShoeVariant({ id: 'V003', size: 42, color: 'Blue', totalQuantity: 4 }));
  await shoeRepo.save(adidasSpeedRun);

  const nikeAirZoom = new Shoe({
    id: 'S002',
    name: 'Nike Air Zoom',
    brand: 'Nike',
    category: 'Running',
    description: 'High performance running shoes',
    pricePerDay: 6,
  });
  nikeAirZoom.addVariant(new ShoeVariant({ id: 'V004', size: 43, color: 'White', totalQuantity: 6 }));
  nikeAirZoom.addVariant(new ShoeVariant({ id: 'V005', size: 44, color: 'Black', totalQuantity: 4 }));
  await shoeRepo.save(nikeAirZoom);

  const pumaSR = new Shoe({
    id: 'S003',
    name: 'Puma Street Rider',
    brand: 'Puma',
    category: 'Sport',
    description: 'Casual sport shoes',
    pricePerDay: 4,
  });
  pumaSR.addVariant(new ShoeVariant({ id: 'V006', size: 41, color: 'Brown', totalQuantity: 5 }));
  pumaSR.addVariant(new ShoeVariant({ id: 'V007', size: 42, color: 'White', totalQuantity: 7 }));
  await shoeRepo.save(pumaSR);
}

function createContainer() {
  return new Container();
}

function separator(title: string) {
  console.log(`\n${'─'.repeat(55)}`);
  console.log(`  ${title}`);
  console.log('─'.repeat(55));
}

async function runDemo() {
  const container = createContainer();
  await seed(container);

  const createRental = container.getCreateRentalUseCase();

  separator('Scenario 1: Normal rental (2 variants, 5 days)');
  try {
    const result = await createRental.execute({
      customerId: 'U001',
      items: [
        { variantId: 'V001', quantity: 1 },
        { variantId: 'V004', quantity: 2 },
      ],
      startDate: new Date('2026-04-01'),
      endDate: new Date('2026-04-05'),
    });

    console.log('  [OK] Rental created');
    console.log(`id        : ${result.rentalId}`);
    console.log(`status    : ${result.status}`);
    console.log(`items     : ${result.totalItems}`);
    console.log(`basePrice : $${result.basePrice}   (1 × $5 + 2 × $6) × 5 days`);
    console.log(`total     : $${result.totalAmount}`);

    const shoeAfter = await container.getShoeRepository().findByVariantId('V001');
    const v001 = shoeAfter?.findVariantById('V001');
    console.log(`\n  [STOCK] V001: ${v001?.availableQuantity}/${v001?.totalQuantity}`);

    const customerAfter = await container.getCustomerRepository().findById('U001');
    console.log(`  [CUSTOMER] U001 currentRentedItems: ${customerAfter?.currentRentedItems}`);
  } catch (err) {
    console.error(`  [FAIL] ${(err as Error).message}`);
  }


  separator('Scenario 2: Inactive customer → rejected');
  try {
    const customerRepo = container.getCustomerRepository();
    const u002 = await customerRepo.findById('U002');
    u002!.deactivate();
    await customerRepo.save(u002!);

    await createRental.execute({
      customerId: 'U002',
      items: [{ variantId: 'V003', quantity: 1 }],
      startDate: new Date('2026-04-10'),
      endDate: new Date('2026-04-12'),
    });

    console.log('  [UNEXPECTED] Should have been rejected.');
  } catch (err) {
    console.log(`  [OK] Correctly rejected: ${(err as Error).message}`);
  }


  separator('Scenario 3: Insufficient stock → rejected');
  try {
    await createRental.execute({
      customerId: 'U003',
      items: [{ variantId: 'V002', quantity: 99 }],
      startDate: new Date('2026-04-15'),
      endDate: new Date('2026-04-17'),
    });

    console.log('  [UNEXPECTED] Should have been rejected.');
  } catch (err) {
    console.log(`  [OK] Correctly rejected: ${(err as Error).message}`);
  }

  separator('Scenario 4: Period overlap → rejected');
  try {
    await createRental.execute({
      customerId: 'U003',
      items: [{ variantId: 'V001', quantity: 1 }],
      startDate: new Date('2026-04-03'),
      endDate: new Date('2026-04-07'),
    });

    console.log('  [UNEXPECTED] Should have been rejected.');
  } catch (err) {
    console.log(`  [OK] Correctly rejected: ${(err as Error).message}`);
  }

  
  separator('Scenario 5: BRONZE rank limit (max 5) → rejected');
  try {
    await createRental.execute({
      customerId: 'U001',
      items: [
        { variantId: 'V006', quantity: 3 },
        { variantId: 'V007', quantity: 3 },
      ],
      startDate: new Date('2026-05-01'),
      endDate: new Date('2026-05-03'),
    });

    console.log('  [UNEXPECTED] Should have been rejected.');
  } catch (err) {
    console.log(`  [OK] Correctly rejected: ${(err as Error).message}`);
  }
  console.log('Demo chạy ngon luônnnn');
}

runDemo().catch((err) => {
  console.error('Unhandled error in demo:', err);
  process.exit(1);
});
