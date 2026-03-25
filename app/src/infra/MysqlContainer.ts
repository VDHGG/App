import type { Pool } from 'mysql2/promise';
import { VariantDeactivationPolicy } from '@domain/ShoeVariant.entity';
import { MysqlCustomerRepository } from '@adapter/persistence/MysqlCustomerRepository.adapter';
import { MysqlShoeRepository } from '@adapter/persistence/MysqlShoeRepository.adapter';
import { MysqlRentalRepository } from '@adapter/persistence/MysqlRentalRepository.adapter';
import { MysqlRentalAvailabilityChecker } from '@adapter/persistence/MysqlRentalAvailabilityChecker.adapter';
import { MysqlTransactionManager } from '@adapter/persistence/MysqlTransactionManager.adapter';
import { UuidGenerator } from '@adapter/persistence/UuidGenerator.adapter';
import { CloudinaryShoeImageService } from '@adapter/cloudinary/CloudinaryShoeImageService.adapter';
import { JoseAccessTokenService } from '@adapter/auth/JoseAccessTokenService.adapter';
import { EnvAdminAuthenticator } from '@adapter/auth/EnvAdminAuthenticator.adapter';
import type { TransactionManager } from '@port/TransactionManager.port';
import type { AccessTokenService } from '@port/AccessTokenService.port';
import type { LoginAdminUseCase } from '@usecase/LoginAdminUseCase.port';
import type { ActivateRentalUseCase } from '@usecase/ActivateRentalUseCase.port';
import type { AddShoeUseCase } from '@usecase/AddShoeUseCase.port';
import type { DeactivateShoeUseCase } from '@usecase/DeactivateShoeUseCase.port';
import type { UpdateShoeUseCase } from '@usecase/UpdateShoeUseCase.port';
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
import type { UploadShoeImageUseCase } from '@usecase/UploadShoeImageUseCase.port';
import { ActivateRentalService } from '@usecase/ActivateRental.service';
import { AddShoeService } from '@usecase/AddShoe.service';
import { DeactivateShoeService } from '@usecase/DeactivateShoe.service';
import { UpdateShoeService } from '@usecase/UpdateShoe.service';
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
import { LoginAdminService } from '@usecase/LoginAdmin.service';
import { UploadShoeImageService } from '@usecase/UploadShoeImage.service';
import { createPool } from './db/MysqlConnection';

export class MysqlContainer {
  private readonly pool: Pool;
  private readonly customerRepository: MysqlCustomerRepository;
  private readonly shoeRepository: MysqlShoeRepository;
  private readonly rentalRepository: MysqlRentalRepository;
  private readonly transactionManager: MysqlTransactionManager;
  private readonly accessTokenService: JoseAccessTokenService;
  private readonly loginAdmin: LoginAdminService;
  private readonly shoeImageService: CloudinaryShoeImageService;

  constructor() {
    this.pool = createPool();
    this.customerRepository = new MysqlCustomerRepository(this.pool);
    this.shoeRepository = new MysqlShoeRepository(this.pool);
    this.rentalRepository = new MysqlRentalRepository(this.pool);
    this.transactionManager = new MysqlTransactionManager(this.pool);

    this.accessTokenService = new JoseAccessTokenService(
      process.env.JWT_SECRET ?? '',
      process.env.JWT_EXPIRES_IN ?? '8h'
    );

    const adminAuthenticator = new EnvAdminAuthenticator({
      email: process.env.ADMIN_EMAIL ?? '',
      passwordHash: process.env.ADMIN_PASSWORD_HASH ?? '',
    });

    this.loginAdmin = new LoginAdminService(adminAuthenticator, this.accessTokenService);
    this.shoeImageService = new CloudinaryShoeImageService();
  }

  getTransactionManager(): TransactionManager {
    return this.transactionManager;
  }

  getAccessTokenService(): AccessTokenService {
    return this.accessTokenService;
  }

  getLoginAdminUseCase(): LoginAdminUseCase {
    return this.loginAdmin;
  }

  getCreateRentalUseCase(): CreateRentalUseCase {
    return new CreateRentalService(
      this.customerRepository,
      this.shoeRepository,
      this.rentalRepository,
      new MysqlRentalAvailabilityChecker(this.pool, new VariantDeactivationPolicy()),
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

  getUpdateShoeUseCase(): UpdateShoeUseCase {
    return new UpdateShoeService(this.shoeRepository, new UuidGenerator('S'), this.shoeImageService);
  }

  getDeactivateShoeUseCase(): DeactivateShoeUseCase {
    return new DeactivateShoeService(this.shoeRepository);
  }

  getListShoesUseCase(): ListShoesUseCase {
    return new ListShoesService(this.shoeRepository, this.shoeImageService);
  }

  getGetShoeUseCase(): GetShoeUseCase {
    return new GetShoeService(this.shoeRepository, this.shoeImageService);
  }

  getUploadShoeImageUseCase(): UploadShoeImageUseCase {
    return new UploadShoeImageService(this.shoeImageService);
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

  async pingDatabase(): Promise<boolean> {
    try {
      await this.pool.query('SELECT 1');
      return true;
    } catch {
      return false;
    }
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}
