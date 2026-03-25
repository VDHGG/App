import { Router } from 'express';
import type { Request, Response, RequestHandler } from 'express';
import type { GetCustomerUseCase } from '@usecase/GetCustomerUseCase.port';
import type { ListCustomersUseCase } from '@usecase/ListCustomersUseCase.port';
import type { RegisterCustomerUseCase } from '@usecase/RegisterCustomerUseCase.port';
import type { TransactionManager } from '@port/TransactionManager.port';
import { RegisterCustomerSchema } from './customer.schema';
import { asyncRoute, transactionalRoute } from './middleware/routeMiddleware';

export type RouteGuards = {
  admin?: RequestHandler[];
};

export class CustomerController {
  private readonly registerCustomer: RegisterCustomerUseCase;
  private readonly listCustomers: ListCustomersUseCase;
  private readonly getCustomer: GetCustomerUseCase;

  constructor(
    registerCustomer: RegisterCustomerUseCase,
    listCustomers: ListCustomersUseCase,
    getCustomer: GetCustomerUseCase
  ) {
    this.registerCustomer = registerCustomer;
    this.listCustomers = listCustomers;
    this.getCustomer = getCustomer;
  }

  routes(transactionManager: TransactionManager, guards?: RouteGuards): Router {
    const router = Router();
    const admin = guards?.admin ?? [];
    router.get('/', ...admin, asyncRoute(this.list.bind(this)));
    router.get('/:id', ...admin, asyncRoute(this.getById.bind(this)));
    router.post('/', transactionalRoute(transactionManager, this.register.bind(this)));
    return router;
  }

  private async list(_req: Request, res: Response): Promise<void> {
    const result = await this.listCustomers.execute();
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
}
