import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import type { CreateRentalUseCase } from '@usecase/CreateRentalUseCase.port';
import type { ActivateRentalUseCase } from '@usecase/ActivateRentalUseCase.port';
import type { GetRentalUseCase } from '@usecase/GetRentalUseCase.port';
import type { ListRentalsUseCase } from '@usecase/ListRentalsUseCase.port';
import type { ReturnRentalUseCase } from '@usecase/ReturnRentalUseCase.port';
import type { CancelRentalUseCase } from '@usecase/CancelRentalUseCase.port';
import type { TransactionManager } from '@port/TransactionManager.port';
import {
  CreateRentalSchema,
  ReturnRentalSchema,
  CancelRentalSchema,
  ListRentalsQuerySchema,
} from './rental.schema';

export class RentalController {
  private readonly createRental: CreateRentalUseCase;
  private readonly activateRental: ActivateRentalUseCase;
  private readonly returnRental: ReturnRentalUseCase;
  private readonly cancelRental: CancelRentalUseCase;
  private readonly listRentals: ListRentalsUseCase;
  private readonly getRental: GetRentalUseCase;
  private readonly transactionManager: TransactionManager;

  constructor(
    createRental: CreateRentalUseCase,
    activateRental: ActivateRentalUseCase,
    returnRental: ReturnRentalUseCase,
    cancelRental: CancelRentalUseCase,
    listRentals: ListRentalsUseCase,
    getRental: GetRentalUseCase,
    transactionManager: TransactionManager
  ) {
    this.createRental = createRental;
    this.activateRental = activateRental;
    this.returnRental = returnRental;
    this.cancelRental = cancelRental;
    this.listRentals = listRentals;
    this.getRental = getRental;
    this.transactionManager = transactionManager;
  }

  routes(): Router {
    const router = Router();
    router.get('/', this.handle(this.list.bind(this)));
    router.get('/:id', this.handle(this.getById.bind(this)));
    router.post('/', this.withTransaction(this.create.bind(this)));
    router.patch('/:id/activate', this.withTransaction(this.activate.bind(this)));
    router.patch('/:id/return', this.withTransaction(this.return.bind(this)));
    router.patch('/:id/cancel', this.withTransaction(this.cancel.bind(this)));
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

  private withTransaction(
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
    const query = ListRentalsQuerySchema.parse(req.query);
    const result = await this.listRentals.execute(
      query.status ? { status: query.status } : undefined
    );
    res.json(result);
  }

  private async getById(req: Request, res: Response): Promise<void> {
    const result = await this.getRental.execute({ rentalId: req.params['id'] as string });
    res.json(result);
  }

  private async create(req: Request, res: Response): Promise<void> {
    const body = CreateRentalSchema.parse(req.body);
    const result = await this.createRental.execute(body);
    res.status(201).json(result);
  }

  private async activate(req: Request, res: Response): Promise<void> {
    const result = await this.activateRental.execute({ rentalId: req.params['id'] as string });
    res.json(result);
  }

  private async return(req: Request, res: Response): Promise<void> {
    const body = ReturnRentalSchema.parse(req.body);
    const result = await this.returnRental.execute({ rentalId: req.params['id'] as string, ...body });
    res.json(result);
  }

  private async cancel(req: Request, res: Response): Promise<void> {
    const body = CancelRentalSchema.parse(req.body);
    const result = await this.cancelRental.execute({ rentalId: req.params['id'] as string, ...body });
    res.json(result);
  }
}
