import { Router } from 'express';
import type { Request, Response, RequestHandler } from 'express';
import type { AddShoeUseCase } from '@usecase/AddShoeUseCase.port';
import type { DeactivateShoeUseCase } from '@usecase/DeactivateShoeUseCase.port';
import type { GetShoeUseCase } from '@usecase/GetShoeUseCase.port';
import type { ListShoesUseCase } from '@usecase/ListShoesUseCase.port';
import type { UpdateShoeUseCase } from '@usecase/UpdateShoeUseCase.port';
import type { TransactionManager } from '@port/TransactionManager.port';
import type { CatalogLookupPort } from '@port/CatalogLookup.port';
import type { AddShoeRequest } from '@usecase/AddShoeRequest.dto';
import type { UpdateShoeRequest } from '@usecase/UpdateShoeRequest.dto';
import { ValidationError } from '@domain/errors/ValidationError';
import {
  AddShoeSchema,
  ListShoesQuerySchema,
  UpdateShoeBodySchema,
  type AddShoeInput,
  type UpdateShoeBodyInput,
} from './shoe.schema';
import { asyncRoute, transactionalRoute } from './middleware/routeMiddleware';

export type RouteGuards = {
  admin?: RequestHandler[];
  authenticated?: RequestHandler[];
};

export class ShoeController {
  private readonly addShoe: AddShoeUseCase;
  private readonly updateShoe: UpdateShoeUseCase;
  private readonly deactivateShoe: DeactivateShoeUseCase;
  private readonly listShoes: ListShoesUseCase;
  private readonly getShoe: GetShoeUseCase;
  private readonly catalog: CatalogLookupPort;

  constructor(
    addShoe: AddShoeUseCase,
    updateShoe: UpdateShoeUseCase,
    deactivateShoe: DeactivateShoeUseCase,
    listShoes: ListShoesUseCase,
    getShoe: GetShoeUseCase,
    catalog: CatalogLookupPort
  ) {
    this.addShoe = addShoe;
    this.updateShoe = updateShoe;
    this.deactivateShoe = deactivateShoe;
    this.listShoes = listShoes;
    this.getShoe = getShoe;
    this.catalog = catalog;
  }

  routes(transactionManager: TransactionManager, guards?: RouteGuards): Router {
    const router = Router();
    const admin = guards?.admin ?? [];
    const authenticated = guards?.authenticated ?? [];
    router.get('/catalog/shoe-lookups', ...authenticated, asyncRoute(this.shoeLookups.bind(this)));
    router.get('/shoes', ...authenticated, asyncRoute(this.list.bind(this)));
    router.post('/shoes', ...admin, transactionalRoute(transactionManager, this.add.bind(this)));
    router.patch(
      '/shoes/:id',
      ...admin,
      transactionalRoute(transactionManager, this.update.bind(this))
    );
    router.delete(
      '/shoes/:id',
      ...admin,
      transactionalRoute(transactionManager, this.deactivate.bind(this))
    );
    router.get('/shoes/:id', ...authenticated, asyncRoute(this.getById.bind(this)));
    return router;
  }

  private async shoeLookups(_req: Request, res: Response): Promise<void> {
    const [brands, categories, colors] = await Promise.all([
      this.catalog.listBrands(),
      this.catalog.listCategories(),
      this.catalog.listColors(),
    ]);
    res.json({ brands, categories, colors });
  }

  private async list(req: Request, res: Response): Promise<void> {
    const query = ListShoesQuerySchema.parse(req.query);
    const result = await this.listShoes.execute({
      ...(query.priceBucket !== undefined ? { priceBucket: query.priceBucket } : {}),
      ...(query.stockBucket !== undefined ? { stockBucket: query.stockBucket } : {}),
      ...(query.page !== undefined ? { page: query.page } : {}),
      ...(query.pageSize !== undefined ? { pageSize: query.pageSize } : {}),
    });
    res.json(result);
  }

  private async getById(req: Request, res: Response): Promise<void> {
    const result = await this.getShoe.execute({ shoeId: req.params['id'] as string });
    res.json(result);
  }

  private async resolveAddPayload(body: AddShoeInput): Promise<AddShoeRequest> {
    const brand = await this.catalog.getBrandNameById(body.brandId);
    if (!brand) {
      throw new ValidationError('Brand id is not valid.');
    }
    const category = await this.catalog.getCategoryNameById(body.categoryId);
    if (!category) {
      throw new ValidationError('Category id is not valid.');
    }
    const variants: AddShoeRequest['variants'] = [];
    for (const v of body.variants) {
      const color = await this.catalog.getColorNameById(v.colorId);
      if (!color) {
        throw new ValidationError('Color id is not valid.');
      }
      variants.push({ size: v.size, color, totalQuantity: v.totalQuantity });
    }
    return {
      name: body.name,
      brand,
      category,
      description: body.description,
      pricePerDay: body.pricePerDay,
      imagePublicId: body.imagePublicId,
      variants,
    };
  }

  private async add(req: Request, res: Response): Promise<void> {
    const body = AddShoeSchema.parse(req.body);
    const payload = await this.resolveAddPayload(body);
    const result = await this.addShoe.execute(payload);
    res.status(201).json(result);
  }

  private async resolveUpdatePayload(
    shoeId: string,
    body: UpdateShoeBodyInput
  ): Promise<UpdateShoeRequest> {
    let brand: string | undefined;
    if (body.brandId !== undefined) {
      const n = await this.catalog.getBrandNameById(body.brandId);
      if (!n) {
        throw new ValidationError('Brand id is not valid.');
      }
      brand = n;
    }
    let category: string | undefined;
    if (body.categoryId !== undefined) {
      const n = await this.catalog.getCategoryNameById(body.categoryId);
      if (!n) {
        throw new ValidationError('Category id is not valid.');
      }
      category = n;
    }
    let newVariants: { size: number; color: string; totalQuantity: number }[] | undefined;
    if (body.newVariants !== undefined && body.newVariants.length > 0) {
      newVariants = [];
      for (const nv of body.newVariants) {
        const color = await this.catalog.getColorNameById(nv.colorId);
        if (!color) {
          throw new ValidationError('Color id is not valid.');
        }
        newVariants.push({ size: nv.size, color, totalQuantity: nv.totalQuantity });
      }
    }
    return {
      shoeId,
      name: body.name,
      ...(brand !== undefined ? { brand } : {}),
      ...(category !== undefined ? { category } : {}),
      description: body.description,
      pricePerDay: body.pricePerDay,
      isActive: body.isActive,
      imagePublicId: body.imagePublicId,
      variantQuantityUpdates: body.variantQuantityUpdates,
      newVariants,
    };
  }

  private async update(req: Request, res: Response): Promise<void> {
    const shoeId = req.params['id'] as string;
    const body = UpdateShoeBodySchema.parse(req.body);
    const payload = await this.resolveUpdatePayload(shoeId, body);
    const result = await this.updateShoe.execute(payload);
    res.json(result);
  }

  private async deactivate(req: Request, res: Response): Promise<void> {
    const shoeId = req.params['id'] as string;
    const result = await this.deactivateShoe.execute({ shoeId });
    res.json(result);
  }
}
