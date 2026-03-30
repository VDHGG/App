import { Router } from 'express';
import type { MysqlContainer } from '@infra/MysqlContainer';
import { CustomerController } from './CustomerController.adapter';
import { ShoeController } from './ShoeController.adapter';
import { ShoeImageController } from './ShoeImageController.adapter';
import { RentalController } from './RentalController.adapter';
import { AuthController, createAuthRateLimiter } from './AuthController.adapter';
import { CatalogAdminController } from './CatalogAdminController.adapter';
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
        'POST /api/v1/auth/register',
        'GET /api/v1/auth/me',
        'PATCH /api/v1/auth/me',
        'POST /api/v1/auth/change-password',
        'GET /api/v1/catalog/shoe-lookups',
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
  const requireCustomerOrAdmin = createRequireRolesMiddleware('admin', 'customer');
  const storefrontAuth = [bearerAuth, requireCustomerOrAdmin];

  const authLimiter = createAuthRateLimiter();
  const authCtrl = new AuthController(
    container.getLoginUserUseCase(),
    container.getRegisterUserUseCase(),
    container.getSystemUserRepository(),
    container.getTransactionManager(),
    container.getUpdateProfileUseCase(),
    container.getChangePasswordUseCase(),
    bearerAuth
  );
  router.use('/auth', authCtrl.routes(authLimiter));

  const customerCtrl = new CustomerController(
    container.getRegisterCustomerUseCase(),
    container.getListCustomersUseCase(),
    container.getGetCustomerUseCase()
  );
  const catalogLookup = container.getCatalogLookup();
  const shoeCtrl = new ShoeController(
    container.getAddShoeUseCase(),
    container.getUpdateShoeUseCase(),
    container.getDeactivateShoeUseCase(),
    container.getListShoesUseCase(),
    container.getGetShoeUseCase(),
    catalogLookup
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
  const catalogAdminCtrl = new CatalogAdminController(container.getCatalogAdminRepository());

  router.use('/', shoeCtrl.routes(tx, { admin: adminGuard, authenticated: storefrontAuth }));
  router.use('/', catalogAdminCtrl.routes({ admin: adminGuard }));
  router.use('/customers', customerCtrl.routes(tx, { admin: adminGuard }));
  router.use('/shoe-images', shoeImageCtrl.routes({ admin: adminGuard }));
  router.use(
    '/rentals',
    rentalCtrl.routes(tx, { admin: adminGuard, createRental: storefrontAuth })
  );

  return router;
}
