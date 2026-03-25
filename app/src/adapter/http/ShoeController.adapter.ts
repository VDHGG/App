import { Router } from 'express';
import type { Request, Response, RequestHandler } from 'express';
import type { AddShoeUseCase } from '@usecase/AddShoeUseCase.port';
import type { DeactivateShoeUseCase } from '@usecase/DeactivateShoeUseCase.port';
import type { GetShoeUseCase } from '@usecase/GetShoeUseCase.port';
import type { ListShoesUseCase } from '@usecase/ListShoesUseCase.port';
import type { UpdateShoeUseCase } from '@usecase/UpdateShoeUseCase.port';
import type { TransactionManager } from '@port/TransactionManager.port';
import { AddShoeSchema, UpdateShoeBodySchema } from './shoe.schema';
import { asyncRoute, transactionalRoute } from './middleware/routeMiddleware';

export type RouteGuards = {
  admin?: RequestHandler[];
};

export class ShoeController {
  private readonly addShoe: AddShoeUseCase;
  private readonly updateShoe: UpdateShoeUseCase;
  private readonly deactivateShoe: DeactivateShoeUseCase;
  private readonly listShoes: ListShoesUseCase;
  private readonly getShoe: GetShoeUseCase;

  constructor(
    addShoe: AddShoeUseCase,
    updateShoe: UpdateShoeUseCase,
    deactivateShoe: DeactivateShoeUseCase,
    listShoes: ListShoesUseCase,
    getShoe: GetShoeUseCase
  ) {
    this.addShoe = addShoe;
    this.updateShoe = updateShoe;
    this.deactivateShoe = deactivateShoe;
    this.listShoes = listShoes;
    this.getShoe = getShoe;
  }

  routes(transactionManager: TransactionManager, guards?: RouteGuards): Router {
    const router = Router();
    const admin = guards?.admin ?? [];
    router.get('/', asyncRoute(this.list.bind(this)));
    router.post('/', ...admin, transactionalRoute(transactionManager, this.add.bind(this)));
    router.patch(
      '/:id',
      ...admin,
      transactionalRoute(transactionManager, this.update.bind(this))
    );
    router.delete(
      '/:id',
      ...admin,
      transactionalRoute(transactionManager, this.deactivate.bind(this))
    );
    router.get('/:id', asyncRoute(this.getById.bind(this)));
    return router;
  }

  private async list(_req: Request, res: Response): Promise<void> {
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

  private async update(req: Request, res: Response): Promise<void> {
    const shoeId = req.params['id'] as string;
    const body = UpdateShoeBodySchema.parse(req.body);
    const result = await this.updateShoe.execute({
      shoeId,
      name: body.name,
      brand: body.brand,
      category: body.category,
      description: body.description,
      pricePerDay: body.pricePerDay,
      isActive: body.isActive,
      imagePublicId: body.imagePublicId,
      variantQuantityUpdates: body.variantQuantityUpdates,
      newVariants: body.newVariants,
    });
    res.json(result);
  }

  private async deactivate(req: Request, res: Response): Promise<void> {
    const shoeId = req.params['id'] as string;
    const result = await this.deactivateShoe.execute({ shoeId });
    res.json(result);
  }
}
