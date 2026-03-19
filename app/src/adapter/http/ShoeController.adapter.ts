import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import type { AddShoeUseCase } from '@usecase/AddShoeUseCase.port';
import type { GetShoeUseCase } from '@usecase/GetShoeUseCase.port';
import type { ListShoesUseCase } from '@usecase/ListShoesUseCase.port';
import type { TransactionManager } from '@port/TransactionManager.port';
import { AddShoeSchema } from './shoe.schema';

export class ShoeController {
  private readonly addShoe: AddShoeUseCase;
  private readonly listShoes: ListShoesUseCase;
  private readonly getShoe: GetShoeUseCase;
  private readonly transactionManager: TransactionManager;

  constructor(
    addShoe: AddShoeUseCase,
    listShoes: ListShoesUseCase,
    getShoe: GetShoeUseCase,
    transactionManager: TransactionManager
  ) {
    this.addShoe = addShoe;
    this.listShoes = listShoes;
    this.getShoe = getShoe;
    this.transactionManager = transactionManager;
  }

  routes(): Router {
    const router = Router();
    router.get('/', this.handle(this.list.bind(this)));
    router.get('/:id', this.handle(this.getById.bind(this)));
    router.post('/', this.withTransaction(this.add.bind(this)));
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
    const result = await this.listShoes.execute();
    res.json(result);
  }

  private async getById(req: Request, res: Response): Promise<void> {
    const result = await this.getShoe.execute({ shoeId: req.params['id'] as string });
    res.json(result);
  }

  private async add(req: Request, res: Response): Promise<void> {
    const body = AddShoeSchema.parse(req.body);
    const result = await this.addShoe.execute(body);
    res.status(201).json(result);
  }
}
