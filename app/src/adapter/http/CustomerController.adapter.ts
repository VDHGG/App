import { Router } from 'express';
import type { Request, Response, RequestHandler } from 'express';
import type { GetCustomerUseCase } from '@usecase/GetCustomerUseCase.port';
import type { ListCustomersUseCase } from '@usecase/ListCustomersUseCase.port';
import type { RegisterCustomerUseCase } from '@usecase/RegisterCustomerUseCase.port';
import type { UpdateCustomerAdminUseCase } from '@usecase/UpdateCustomerAdminUseCase.port';
import type { DeleteCustomerAdminUseCase } from '@usecase/DeleteCustomerAdminUseCase.port';
import type { TransactionManager } from '@port/TransactionManager.port';
import {
  ListCustomersQuerySchema,
  RegisterCustomerSchema,
  UpdateCustomerAdminSchema,
} from './customer.schema';
import { asyncRoute, transactionalRoute } from './middleware/routeMiddleware';

export type RouteGuards = {
  admin?: RequestHandler[];
};

export class CustomerController {
  private readonly registerCustomer: RegisterCustomerUseCase;
  private readonly listCustomers: ListCustomersUseCase;
  private readonly getCustomer: GetCustomerUseCase;
  private readonly updateCustomerAdmin: UpdateCustomerAdminUseCase;
  private readonly deleteCustomerAdmin: DeleteCustomerAdminUseCase;

  constructor(
    registerCustomer: RegisterCustomerUseCase,
    listCustomers: ListCustomersUseCase,
    getCustomer: GetCustomerUseCase,
    updateCustomerAdmin: UpdateCustomerAdminUseCase,
    deleteCustomerAdmin: DeleteCustomerAdminUseCase
  ) {
    this.registerCustomer = registerCustomer;
    this.listCustomers = listCustomers;
    this.getCustomer = getCustomer;
    this.updateCustomerAdmin = updateCustomerAdmin;
    this.deleteCustomerAdmin = deleteCustomerAdmin;
  }

  routes(transactionManager: TransactionManager, guards?: RouteGuards): Router {
    const router = Router();
    const admin = guards?.admin ?? [];
    router.get('/', ...admin, asyncRoute(this.list.bind(this)));
    router.get('/:id', ...admin, asyncRoute(this.getById.bind(this)));
    router.post('/', ...admin, transactionalRoute(transactionManager, this.register.bind(this)));
    router.patch(
      '/:id',
      ...admin,
      transactionalRoute(transactionManager, this.patchAdmin.bind(this))
    );
    router.delete('/:id', ...admin, asyncRoute(this.deleteAdmin.bind(this)));
    return router;
  }

  private async list(req: Request, res: Response): Promise<void> {
    const query = ListCustomersQuerySchema.parse(req.query);
    const result = await this.listCustomers.execute({
      ...(query.page !== undefined ? { page: query.page } : {}),
      ...(query.pageSize !== undefined ? { pageSize: query.pageSize } : {}),
      ...(query.search !== undefined && query.search.trim() !== '' ? { search: query.search.trim() } : {}),
    });
    res.json(result);
  }

  private async patchAdmin(req: Request, res: Response): Promise<void> {
    const body = UpdateCustomerAdminSchema.parse(req.body);
    const result = await this.updateCustomerAdmin.execute({
      customerId: req.params['id'] as string,
      fullName: body.fullName,
      email: body.email,
      phone: body.phone ?? null,
      rank: body.rank,
      isActive: body.isActive,
    });
    res.json(result);
  }

  private async getById(req: Request, res: Response): Promise<void> {
    const result = await this.getCustomer.execute({ customerId: req.params['id'] as string });
    res.json(result);
  }

  private async register(req: Request, res: Response): Promise<void> {
    const body = RegisterCustomerSchema.parse(req.body);
    const result = await this.registerCustomer.execute(body);
    res.status(201).json(result);
  }

  private async deleteAdmin(req: Request, res: Response): Promise<void> {
    await this.deleteCustomerAdmin.execute({ customerId: req.params['id'] as string });
    res.status(204).end();
  }
}
