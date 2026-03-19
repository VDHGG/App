import { InMemoryCustomerRepository } from '@adapter/persistence/InMemoryCustomerRepository.adapter';
import { InMemoryRentalAvailabilityChecker } from '@adapter/persistence/InMemoryRentalAvailabilityChecker.adapter';
import { InMemoryRentalRepository } from '@adapter/persistence/InMemoryRentalRepository.adapter';
import { InMemoryShoeRepository } from '@adapter/persistence/InMemoryShoeRepository.adapter';
import { NoopTransactionManager } from '@adapter/persistence/NoopTransactionManager.adapter';
import { ShortIdGenerator } from '@adapter/persistence/ShortIdGenerator.adapter';
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

export class Container {
  private readonly customerRepository: InMemoryCustomerRepository;
  private readonly shoeRepository: InMemoryShoeRepository;
  private readonly rentalRepository: InMemoryRentalRepository;
  private readonly transactionManager: NoopTransactionManager;

  constructor() {
    this.customerRepository = new InMemoryCustomerRepository();
    this.shoeRepository = new InMemoryShoeRepository();
    this.rentalRepository = new InMemoryRentalRepository();
    this.transactionManager = new NoopTransactionManager();
  }

  getTransactionManager(): TransactionManager {
    return this.transactionManager;
  }

  getCreateRentalUseCase(): CreateRentalUseCase {
    return new CreateRentalService(
      this.customerRepository,
      this.shoeRepository,
      this.rentalRepository,
      new InMemoryRentalAvailabilityChecker(this.rentalRepository, this.shoeRepository),
      new ShortIdGenerator('R')
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
    return new RegisterCustomerService(this.customerRepository, new ShortIdGenerator('U'));
  }

  getAddShoeUseCase(): AddShoeUseCase {
    return new AddShoeService(this.shoeRepository, new ShortIdGenerator('S'));
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

  getCustomerRepository(): InMemoryCustomerRepository {
    return this.customerRepository;
  }

  getShoeRepository(): InMemoryShoeRepository {
    return this.shoeRepository;
  }

  getRentalRepository(): InMemoryRentalRepository {
    return this.rentalRepository;
  }
}
