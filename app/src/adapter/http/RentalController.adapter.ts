import { Router } from 'express';
import type { Request, Response, RequestHandler } from 'express';
import type { CreateRentalUseCase } from '@usecase/CreateRentalUseCase.port';
import type { ActivateRentalUseCase } from '@usecase/ActivateRentalUseCase.port';
import type { GetRentalUseCase } from '@usecase/GetRentalUseCase.port';
import type { ListRentalsUseCase } from '@usecase/ListRentalsUseCase.port';
import type { ReturnRentalUseCase } from '@usecase/ReturnRentalUseCase.port';
import type { CancelRentalUseCase } from '@usecase/CancelRentalUseCase.port';
import type { DeleteRentalAdminUseCase } from '@usecase/DeleteRentalAdminUseCase.port';
import type { TransactionManager } from '@port/TransactionManager.port';
import {
  CreateRentalSchema,
  ReturnRentalSchema,
  CancelRentalSchema,
  ListRentalsQuerySchema,
  ListMyRentalsQuerySchema,
} from './rental.schema';
import { asyncRoute, transactionalRoute } from './middleware/routeMiddleware';
import { ValidationError } from '@domain/errors/ValidationError';

export type RouteGuards = {
  admin?: RequestHandler[];
  createRental?: RequestHandler[];
  customer?: RequestHandler[];
};

export class RentalController {
  private readonly createRental: CreateRentalUseCase;
  private readonly activateRental: ActivateRentalUseCase;
  private readonly returnRental: ReturnRentalUseCase;
  private readonly cancelRental: CancelRentalUseCase;
  private readonly listRentals: ListRentalsUseCase;
  private readonly getRental: GetRentalUseCase;
  private readonly deleteRentalAdmin: DeleteRentalAdminUseCase;

  constructor(
    createRental: CreateRentalUseCase,
    activateRental: ActivateRentalUseCase,
    returnRental: ReturnRentalUseCase,
    cancelRental: CancelRentalUseCase,
    listRentals: ListRentalsUseCase,
    getRental: GetRentalUseCase,
    deleteRentalAdmin: DeleteRentalAdminUseCase
  ) {
    this.createRental = createRental;
    this.activateRental = activateRental;
    this.returnRental = returnRental;
    this.cancelRental = cancelRental;
    this.listRentals = listRentals;
    this.getRental = getRental;
    this.deleteRentalAdmin = deleteRentalAdmin;
  }

  routes(transactionManager: TransactionManager, guards?: RouteGuards): Router {
    const router = Router();
    const admin = guards?.admin ?? [];
    const createRental = guards?.createRental ?? [];
    const customer = guards?.customer ?? [];
    router.get('/me', ...customer, asyncRoute(this.listMine.bind(this)));
    router.get('/me/:id', ...customer, asyncRoute(this.getMine.bind(this)));
    router.patch(
      '/me/:id/cancel',
      ...customer,
      transactionalRoute(transactionManager, this.cancelMine.bind(this))
    );
    router.get('/', ...admin, asyncRoute(this.list.bind(this)));
    router.get('/:id', ...admin, asyncRoute(this.getById.bind(this)));
    router.post(
      '/',
      ...createRental,
      transactionalRoute(transactionManager, this.create.bind(this))
    );
    router.patch(
      '/:id/activate',
      ...admin,
      transactionalRoute(transactionManager, this.activate.bind(this))
    );
    router.patch(
      '/:id/return',
      ...admin,
      transactionalRoute(transactionManager, this.return.bind(this))
    );
    router.patch(
      '/:id/cancel',
      ...admin,
      transactionalRoute(transactionManager, this.cancel.bind(this))
    );
    router.delete('/:id', ...admin, asyncRoute(this.deleteAdmin.bind(this)));
    return router;
  }

  private async listMine(req: Request, res: Response): Promise<void> {
    const auth = req.auth;
    if (!auth?.customerId) {
      res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'Account is not linked to a customer profile.',
      });
      return;
    }
    const query = ListMyRentalsQuerySchema.parse(req.query);
    const result = await this.listRentals.execute({
      customerId: auth.customerId,
      ...(query.page !== undefined ? { page: query.page } : {}),
      ...(query.pageSize !== undefined ? { pageSize: query.pageSize } : {}),
    });
    res.json(result);
  }

  private async getMine(req: Request, res: Response): Promise<void> {
    const auth = req.auth;
    if (!auth?.customerId) {
      res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'Account is not linked to a customer profile.',
      });
      return;
    }
    const result = await this.getRental.execute({
      rentalId: req.params['id'] as string,
      requestingCustomerId: auth.customerId,
    });
    res.json(result);
  }

  private async cancelMine(req: Request, res: Response): Promise<void> {
    const auth = req.auth;
    if (!auth?.customerId) {
      res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'Account is not linked to a customer profile.',
      });
      return;
    }
    const body = CancelRentalSchema.parse(req.body);
    const result = await this.cancelRental.execute({
      rentalId: req.params['id'] as string,
      cancelledAt: body.cancelledAt,
      note: body.note,
      requestingCustomerId: auth.customerId,
    });
    res.json(result);
  }

  private async list(req: Request, res: Response): Promise<void> {
    const query = ListRentalsQuerySchema.parse(req.query);
    const amountBucket =
      query.amountBucket === undefined || query.amountBucket === 'all' ? undefined : query.amountBucket;

    const result = await this.listRentals.execute({
      ...(query.status ? { status: query.status } : {}),
      ...(query.startDateFrom ? { startDateFrom: query.startDateFrom } : {}),
      ...(query.startDateTo ? { startDateTo: query.startDateTo } : {}),
      ...(amountBucket ? { amountBucket } : {}),
      ...(query.search !== undefined && query.search.trim() !== '' ? { search: query.search.trim() } : {}),
      ...(query.page !== undefined ? { page: query.page } : {}),
      ...(query.pageSize !== undefined ? { pageSize: query.pageSize } : {}),
    });
    res.json(result);
  }

  private async getById(req: Request, res: Response): Promise<void> {
    const result = await this.getRental.execute({ rentalId: req.params['id'] as string });
    res.json(result);
  }

  private async create(req: Request, res: Response): Promise<void> {
    const body = CreateRentalSchema.parse(req.body);
    const auth = req.auth;
    if (!auth) {
      res.status(401).json({ error: 'UNAUTHORIZED', message: 'Authentication required.' });
      return;
    }

    let customerId = body.customerId;
    if (auth.role === 'customer') {
      if (!auth.customerId) {
        throw new ValidationError('Account is not linked to a customer profile.');
      }
      customerId = auth.customerId;
    }

    const result = await this.createRental.execute({ ...body, customerId });
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

  private async deleteAdmin(req: Request, res: Response): Promise<void> {
    await this.deleteRentalAdmin.execute({ rentalId: req.params['id'] as string });
    res.status(204).end();
  }
}
