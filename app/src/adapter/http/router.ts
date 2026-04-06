import { Router } from 'express';
import type { MysqlContainer } from '@infra/MysqlContainer';
import { CustomerController } from './CustomerController.adapter';
import { ShoeController } from './ShoeController.adapter';
import { ShoeImageController } from './ShoeImageController.adapter';
import { RentalController } from './RentalController.adapter';
import { AuthController, createAuthRateLimiter } from './AuthController.adapter';
import { CatalogAdminController } from './CatalogAdminController.adapter';
import { AdminSystemUserController } from './AdminSystemUserController.adapter';
import { WishlistController } from './WishlistController.adapter';
import { MomoPaymentController } from './MomoPaymentController.adapter';
import { ChatController } from './ChatController.adapter';
import {
  createBearerAuthMiddleware,
  createOptionalBearerAuthMiddleware,
  createRequireRolesMiddleware,
} from './middleware/authMiddleware';
import rateLimit from 'express-rate-limit';

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
        'GET /api/v1/shoes (optional ?page=&pageSize=)',
        'GET /api/v1/customers (optional ?page=&pageSize=&search=)',
        'PATCH /api/v1/customers/:id (admin)',
        'GET /api/v1/system-users (admin, optional ?page=&pageSize=&search=)',
        'PATCH /api/v1/system-users/:userId (admin)',
        'GET /api/v1/rentals (optional ?page=&pageSize=&search=)',
        'GET /api/v1/rentals/me (customer)',
        'GET /api/v1/wishlist (customer)',
        'GET /health',
        'POST /api/v1/payments/momo/create (customer bearer)',
        'POST /api/v1/payments/momo/ipn (MoMo server)',
        'POST /api/v1/chat (optional Bearer; AI assistant)',
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
  const requireCustomer = createRequireRolesMiddleware('customer');
  const customerOnlyAuth = [bearerAuth, requireCustomer];

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
    container.getGetCustomerUseCase(),
    container.getUpdateCustomerAdminUseCase()
  );
  const adminSystemUserCtrl = new AdminSystemUserController(
    container.getSystemUserRepository(),
    container.getAdminListSystemUsersUseCase(),
    container.getAdminUpdateSystemUserUseCase()
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
  const wishlistCtrl = new WishlistController(container.getWishlistUseCase());
  const momoPaymentCtrl = new MomoPaymentController(
    container.getGetRentalUseCase(),
    container.getRentalPaymentRepository()
  );
  const optionalBearer = createOptionalBearerAuthMiddleware(accessTokenService);
  const chatRateLimit = rateLimit({
    windowMs: 60_000,
    max: 24,
    standardHeaders: true,
    legacyHeaders: false,
  });
  const chatCtrl = new ChatController(
    container.getListRentalsUseCase(),
    container.getGetRentalUseCase(),
    container.getListShoesUseCase()
  );

  router.use('/', shoeCtrl.routes(tx, { admin: adminGuard, authenticated: storefrontAuth }));
  router.use('/', catalogAdminCtrl.routes({ admin: adminGuard }));
  router.use('/customers', customerCtrl.routes(tx, { admin: adminGuard }));
  router.use('/system-users', adminSystemUserCtrl.routes(tx, { admin: adminGuard }));
  router.use('/shoe-images', shoeImageCtrl.routes({ admin: adminGuard }));
  router.use(
    '/rentals',
    rentalCtrl.routes(tx, {
      admin: adminGuard,
      createRental: storefrontAuth,
      customer: customerOnlyAuth,
    })
  );
  router.use('/wishlist', wishlistCtrl.routes({ customer: customerOnlyAuth }));
  router.use('/', momoPaymentCtrl.routes(customerOnlyAuth));
  router.use('/', chatCtrl.routes([chatRateLimit, optionalBearer]));

  return router;
}
