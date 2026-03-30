import type { Pool } from 'mysql2/promise';
import { VariantDeactivationPolicy } from '@domain/ShoeVariant.entity';
import { MysqlCustomerRepository } from '@adapter/persistence/MysqlCustomerRepository.adapter';
import { MysqlSystemUserRepository } from '@adapter/persistence/MysqlSystemUserRepository.adapter';
import { MysqlShoeRepository } from '@adapter/persistence/MysqlShoeRepository.adapter';
import { MysqlCatalogLookup } from '@adapter/persistence/MysqlCatalogLookup.adapter';
import { MysqlCatalogAdmin } from '@adapter/persistence/MysqlCatalogAdmin.adapter';
import { MysqlRentalRepository } from '@adapter/persistence/MysqlRentalRepository.adapter';
import { MysqlRentalAvailabilityChecker } from '@adapter/persistence/MysqlRentalAvailabilityChecker.adapter';
import { MysqlTransactionManager } from '@adapter/persistence/MysqlTransactionManager.adapter';
import { UuidGenerator } from '@adapter/persistence/UuidGenerator.adapter';
import { CloudinaryShoeImageService } from '@adapter/cloudinary/CloudinaryShoeImageService.adapter';
import { JoseAccessTokenService } from '@adapter/auth/JoseAccessTokenService.adapter';
import type { TransactionManager } from '@port/TransactionManager.port';
import type { AccessTokenService } from '@port/AccessTokenService.port';
import type { SystemUserRepository } from '@port/SystemUserRepository.port';
import type { LoginUserUseCase } from '@usecase/LoginUserUseCase.port';
import type { RegisterUserUseCase } from '@usecase/RegisterUserUseCase.port';
import type { UpdateProfileUseCase } from '@usecase/UpdateProfileUseCase.port';
import type { ChangePasswordUseCase } from '@usecase/ChangePasswordUseCase.port';
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
import type { CatalogLookupPort } from '@port/CatalogLookup.port';
import type { CatalogAdminRepository } from '@port/CatalogAdminRepository.port';
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
import { LoginUserService } from '@usecase/LoginUser.service';
import { RegisterUserService } from '@usecase/RegisterUser.service';
import { UpdateProfileService } from '@usecase/UpdateProfile.service';
import { ChangePasswordService } from '@usecase/ChangePassword.service';
import { UploadShoeImageService } from '@usecase/UploadShoeImage.service';
import { createPool } from './db/MysqlConnection';

export class MysqlContainer {
  private readonly pool: Pool;
  private readonly customerRepository: MysqlCustomerRepository;
  private readonly systemUserRepository: MysqlSystemUserRepository;
  private readonly shoeRepository: MysqlShoeRepository;
  private readonly rentalRepository: MysqlRentalRepository;
  private readonly transactionManager: MysqlTransactionManager;
  private readonly accessTokenService: JoseAccessTokenService;
  private readonly registerCustomer: RegisterCustomerService;
  private readonly loginUser: LoginUserService;
  private readonly registerUser: RegisterUserService;
  private readonly updateProfile: UpdateProfileService;
  private readonly changePassword: ChangePasswordService;
  private readonly shoeImageService: CloudinaryShoeImageService;
  private readonly catalogLookup: MysqlCatalogLookup;
  private readonly catalogAdmin: MysqlCatalogAdmin;

  constructor() {
    this.pool = createPool();
    this.customerRepository = new MysqlCustomerRepository(this.pool);
    this.systemUserRepository = new MysqlSystemUserRepository(this.pool);
    this.shoeRepository = new MysqlShoeRepository(this.pool);
    this.rentalRepository = new MysqlRentalRepository(this.pool);
    this.transactionManager = new MysqlTransactionManager(this.pool);

    this.accessTokenService = new JoseAccessTokenService(
      process.env.JWT_SECRET ?? '',
      process.env.JWT_EXPIRES_IN ?? '8h'
    );

    this.registerCustomer = new RegisterCustomerService(
      this.customerRepository,
      new UuidGenerator('C')
    );

    this.loginUser = new LoginUserService(this.systemUserRepository, this.accessTokenService);

    this.registerUser = new RegisterUserService(
      this.transactionManager,
      this.registerCustomer,
      this.systemUserRepository,
      new UuidGenerator('U'),
      this.accessTokenService
    );

    this.updateProfile = new UpdateProfileService(
      this.transactionManager,
      this.systemUserRepository,
      this.customerRepository
    );

    this.changePassword = new ChangePasswordService(this.systemUserRepository);

    this.shoeImageService = new CloudinaryShoeImageService();
    this.catalogLookup = new MysqlCatalogLookup(this.pool);
    this.catalogAdmin = new MysqlCatalogAdmin(this.pool);
  }

  getCatalogLookup(): CatalogLookupPort {
    return this.catalogLookup;
  }

  getCatalogAdminRepository(): CatalogAdminRepository {
    return this.catalogAdmin;
  }

  getTransactionManager(): TransactionManager {
    return this.transactionManager;
  }

  getAccessTokenService(): AccessTokenService {
    return this.accessTokenService;
  }

  getSystemUserRepository(): SystemUserRepository {
    return this.systemUserRepository;
  }

  getLoginUserUseCase(): LoginUserUseCase {
    return this.loginUser;
  }

  getRegisterUserUseCase(): RegisterUserUseCase {
    return this.registerUser;
  }

  getUpdateProfileUseCase(): UpdateProfileUseCase {
    return this.updateProfile;
  }

  getChangePasswordUseCase(): ChangePasswordUseCase {
    return this.changePassword;
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
    return this.registerCustomer;
  }

  getAddShoeUseCase(): AddShoeUseCase {
    return new AddShoeService(this.shoeRepository, new UuidGenerator('S'));
  }

  getUpdateShoeUseCase(): UpdateShoeUseCase {
    return new UpdateShoeService(
      this.shoeRepository,
      new UuidGenerator('S'),
      this.shoeImageService,
      this.catalogLookup
    );
  }

  getDeactivateShoeUseCase(): DeactivateShoeUseCase {
    return new DeactivateShoeService(this.shoeRepository);
  }

  getListShoesUseCase(): ListShoesUseCase {
    return new ListShoesService(this.shoeRepository, this.shoeImageService);
  }

  getGetShoeUseCase(): GetShoeUseCase {
    return new GetShoeService(this.shoeRepository, this.shoeImageService, this.catalogLookup);
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
