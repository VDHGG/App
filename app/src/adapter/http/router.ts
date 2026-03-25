import { Router } from 'express';
import type { MysqlContainer } from '@infra/MysqlContainer';
import { CustomerController } from './CustomerController.adapter';
import { ShoeController } from './ShoeController.adapter';
import { ShoeImageController } from './ShoeImageController.adapter';
import { RentalController } from './RentalController.adapter';
import { AuthController } from './AuthController.adapter';
import {
  createBearerAuthMiddleware,
  createRequireRolesMiddleware,
} from './middleware/authMiddleware';

export function createRouter(container: MysqlContainer): Router {
  const router = Router();

  router.get('/', (_req, res) => {
    res.json({
      ok: true,
      name: 'Shoe Rental API',
      version: 1,
      hint: 'Open the Vite app at http://localhost:5173 ',
      endpoints: [
        'POST /api/v1/auth/login',
        'GET /api/v1/shoes',
        'GET /health',
      ],
    });
  });

  const tx = container.getTransactionManager();

  const accessTokenService = container.getAccessTokenService();
  const bearerAuth = createBearerAuthMiddleware(accessTokenService);
  const requireAdmin = createRequireRolesMiddleware('admin');
  const adminGuard = [bearerAuth, requireAdmin];

  const authCtrl = new AuthController(container.getLoginAdminUseCase(), bearerAuth);
  router.use('/auth', authCtrl.routes());

  const customerCtrl = new CustomerController(
    container.getRegisterCustomerUseCase(),
    container.getListCustomersUseCase(),
    container.getGetCustomerUseCase()
  );
  const shoeCtrl = new ShoeController(
    container.getAddShoeUseCase(),
    container.getUpdateShoeUseCase(),
    container.getDeactivateShoeUseCase(),
    container.getListShoesUseCase(),
    container.getGetShoeUseCase()
  );
  const shoeImageCtrl = new ShoeImageController(container.getUploadShoeImageUseCase());
  const rentalCtrl = new RentalController(
    container.getCreateRentalUseCase(),
    container.getActivateRentalUseCase(),
    container.getReturnRentalUseCase(),
    container.getCancelRentalUseCase(),
    container.getListRentalsUseCase(),
    container.getGetRentalUseCase()
  );

  router.use('/customers', customerCtrl.routes(tx, { admin: adminGuard }));
  router.use('/shoe-images', shoeImageCtrl.routes({ admin: adminGuard }));
  router.use('/shoes', shoeCtrl.routes(tx, { admin: adminGuard }));
  router.use('/rentals', rentalCtrl.routes(tx, { admin: adminGuard }));

  return router;
}
