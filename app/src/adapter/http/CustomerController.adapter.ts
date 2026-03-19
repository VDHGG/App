import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import type { GetCustomerUseCase } from '@usecase/GetCustomerUseCase.port';
import type { ListCustomersUseCase } from '@usecase/ListCustomersUseCase.port';
import type { RegisterCustomerUseCase } from '@usecase/RegisterCustomerUseCase.port';
import type { TransactionManager } from '@port/TransactionManager.port';
import { RegisterCustomerSchema } from './customer.schema';

export class CustomerController {
  private readonly registerCustomer: RegisterCustomerUseCase;
  private readonly listCustomers: ListCustomersUseCase;
  private readonly getCustomer: GetCustomerUseCase;
  private readonly transactionManager: TransactionManager;

  constructor(
    registerCustomer: RegisterCustomerUseCase,
    listCustomers: ListCustomersUseCase,
    getCustomer: GetCustomerUseCase,
    transactionManager: TransactionManager
  ) {
    this.registerCustomer = registerCustomer;
    this.listCustomers = listCustomers;
    this.getCustomer = getCustomer;
    this.transactionManager = transactionManager;
  }

  routes(): Router {
    const router = Router();
    router.get('/', this.handle(this.list.bind(this)));
    router.get('/:id', this.handle(this.getById.bind(this)));
    router.post('/', this.withTransaction(this.register.bind(this)));
    return router;
  }

  private handle(
    fn: (req: Request, res: Response) => Promise<void>
  ): (req: Request, res: Response, next: NextFunction) => Promise<void> {
    return async (req, res, next) => {
      try {
        await fn(req, res);
      } catch (err) {
        next(err);
      }
    };
  }

  withTransaction(
    fn: (req: Request, res: Response) => Promise<void>
  ): (req: Request, res: Response, next: NextFunction) => Promise<void> {
    return async (req, res, next) => {
      try {
        await this.transactionManager.runInTransaction(() => fn(req, res));
      } catch (err) {
        next(err);
      }
    };
  }

  private async list(req: Request, res: Response): Promise<void> {
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
