import 'dotenv/config';
import type { Pool } from 'mysql2/promise';
import { VariantAvailabilityPolicy } from '@domain/ShoeVariant.entity';
import { MysqlCustomerRepository } from '@adapter/persistence/MysqlCustomerRepository.adapter';
import { MysqlShoeRepository } from '@adapter/persistence/MysqlShoeRepository.adapter';
import { MysqlRentalRepository } from '@adapter/persistence/MysqlRentalRepository.adapter';
import { MysqlRentalAvailabilityChecker } from '@adapter/persistence/MysqlRentalAvailabilityChecker.adapter';
import { MysqlTransactionManager } from '@adapter/persistence/MysqlTransactionManager.adapter';
import { UuidGenerator } from '@adapter/persistence/UuidGenerator.adapter';
import type { TransactionManager } from '@port/TransactionManager.port';
import type { ActivateRentalUseCase } from '@usecase/ActivateRentalUseCase.port';
import type { AddShoeUseCase } from '@usecase/AddShoeUseCase.port';
import type { GetCustomerUseCase } from '@usecase/GetCustomerUseCase.port';
import type { GetRentalUseCase } from '@usecase/GetRentalUseCase.port';
import type { GetShoeUseCase } from '@usecase/GetShoeUseCase.port';
import type { ListCustomersUseCase } from '@usecase/ListCustomersUseCase.port';
import type { ListRentalsUseCase } from '@usecase/ListRentalsUseCase.port';
import type { ListShoesUseCase } from '@usecase/ListShoesUseCase.port';
import type { CancelRentalUseCase } from '@usecase/CancelRentalUseCase.port';
import type { CreateRentalUseCase } from '@usecase/CreateRentalUseCase.port';
import type { RegisterCustomerUseCase } from '@usecase/RegisterCustomerUseCase.port';
import type { ReturnRentalUseCase } from '@usecase/ReturnRentalUseCase.port';
import { ActivateRentalService } from '@usecase/ActivateRental.service';
import { AddShoeService } from '@usecase/AddShoe.service';
import { GetCustomerService } from '@usecase/GetCustomer.service';
import { GetRentalService } from '@usecase/GetRental.service';
import { GetShoeService } from '@usecase/GetShoe.service';
import { ListCustomersService } from '@usecase/ListCustomers.service';
import { ListRentalsService } from '@usecase/ListRentals.service';
import { ListShoesService } from '@usecase/ListShoes.service';
import { CancelRentalService } from '@usecase/CancelRental.service';
import { CreateRentalService } from '@usecase/CreateRental.service';
import { RegisterCustomerService } from '@usecase/RegisterCustomer.service';
import { ReturnRentalService } from '@usecase/ReturnRental.service';
import { createPool } from './db/MysqlConnection';

export class MysqlContainer {
  private readonly pool: Pool;
  private readonly customerRepository: MysqlCustomerRepository;
  private readonly shoeRepository: MysqlShoeRepository;
  private readonly rentalRepository: MysqlRentalRepository;
  private readonly transactionManager: MysqlTransactionManager;

  constructor() {
    this.pool = createPool();
    this.customerRepository = new MysqlCustomerRepository(this.pool);
    this.shoeRepository = new MysqlShoeRepository(this.pool);
    this.rentalRepository = new MysqlRentalRepository(this.pool);
    this.transactionManager = new MysqlTransactionManager(this.pool);
  }

  getTransactionManager(): TransactionManager {
    return this.transactionManager;
  }

  getCreateRentalUseCase(): CreateRentalUseCase {
    return new CreateRentalService(
      this.customerRepository,
      this.shoeRepository,
      this.rentalRepository,
      new MysqlRentalAvailabilityChecker(this.pool, new VariantAvailabilityPolicy()),
      new UuidGenerator('R')
    );
  }

  getReturnRentalUseCase(): ReturnRentalUseCase {
    return new ReturnRentalService(this.rentalRepository, this.customerRepository);
  }

  getActivateRentalUseCase(): ActivateRentalUseCase {
    return new ActivateRentalService(this.rentalRepository);
  }

  getCancelRentalUseCase(): CancelRentalUseCase {
    return new CancelRentalService(this.rentalRepository, this.customerRepository);
  }

  getRegisterCustomerUseCase(): RegisterCustomerUseCase {
    return new RegisterCustomerService(this.customerRepository, new UuidGenerator('C'));
  }

  getAddShoeUseCase(): AddShoeUseCase {
    return new AddShoeService(this.shoeRepository, new UuidGenerator('S'));
  }

  getListShoesUseCase(): ListShoesUseCase {
    return new ListShoesService(this.shoeRepository);
  }

  getGetShoeUseCase(): GetShoeUseCase {
    return new GetShoeService(this.shoeRepository);
  }

  getListCustomersUseCase(): ListCustomersUseCase {
    return new ListCustomersService(this.customerRepository);
  }

  getGetCustomerUseCase(): GetCustomerUseCase {
    return new GetCustomerService(this.customerRepository);
  }

  getListRentalsUseCase(): ListRentalsUseCase {
    return new ListRentalsService(this.rentalRepository);
  }

  getGetRentalUseCase(): GetRentalUseCase {
    return new GetRentalService(this.rentalRepository);
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}
