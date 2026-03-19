import { Router } from 'express';
import type { MysqlContainer } from '@infra/MysqlContainer';
import { CustomerController } from './CustomerController.adapter';
import { ShoeController } from './ShoeController.adapter';
import { RentalController } from './RentalController.adapter';

export function createRouter(container: MysqlContainer): Router {
  const router = Router();
  const tx = container.getTransactionManager();

  const customerCtrl = new CustomerController(
    container.getRegisterCustomerUseCase(),
    container.getListCustomersUseCase(),
    container.getGetCustomerUseCase(),
    tx
  );
  const shoeCtrl = new ShoeController(
    container.getAddShoeUseCase(),
    container.getListShoesUseCase(),
    container.getGetShoeUseCase(),
    tx
  );
  const rentalCtrl = new RentalController(
    container.getCreateRentalUseCase(),
    container.getActivateRentalUseCase(),
    container.getReturnRentalUseCase(),
    container.getCancelRentalUseCase(),
    container.getListRentalsUseCase(),
    container.getGetRentalUseCase(),
    tx
  );

  router.use('/customers', customerCtrl.routes());
  router.use('/shoes', shoeCtrl.routes());
  router.use('/rentals', rentalCtrl.routes());

  return router;
}
