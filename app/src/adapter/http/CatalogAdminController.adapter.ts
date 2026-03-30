import { Router } from 'express';
import type { Request, Response, RequestHandler } from 'express';
import type { CatalogAdminRepository } from '@port/CatalogAdminRepository.port';
import { CatalogIdParamSchema, CatalogNameBodySchema } from './catalogAdmin.schema';
import { asyncRoute } from './middleware/routeMiddleware';

export type RouteGuards = {
  admin?: RequestHandler[];
};

export class CatalogAdminController {
  private readonly catalog: CatalogAdminRepository;

  constructor(catalog: CatalogAdminRepository) {
    this.catalog = catalog;
  }

  routes(guards?: RouteGuards): Router {
    const router = Router();
    const admin = guards?.admin ?? [];

    router.post('/catalog/brands', ...admin, asyncRoute(this.createBrand.bind(this)));
    router.patch('/catalog/brands/:id', ...admin, asyncRoute(this.updateBrand.bind(this)));
    router.delete('/catalog/brands/:id', ...admin, asyncRoute(this.deleteBrand.bind(this)));

    router.post('/catalog/categories', ...admin, asyncRoute(this.createCategory.bind(this)));
    router.patch('/catalog/categories/:id', ...admin, asyncRoute(this.updateCategory.bind(this)));
    router.delete('/catalog/categories/:id', ...admin, asyncRoute(this.deleteCategory.bind(this)));

    return router;
  }

  private async createBrand(req: Request, res: Response): Promise<void> {
    const body = CatalogNameBodySchema.parse(req.body);
    const row = await this.catalog.createBrand(body.name);
    res.status(201).json(row);
  }

  private async updateBrand(req: Request, res: Response): Promise<void> {
    const { id } = CatalogIdParamSchema.parse(req.params);
    const body = CatalogNameBodySchema.parse(req.body);
    await this.catalog.updateBrand(id, body.name);
    res.status(204).end();
  }

  private async deleteBrand(req: Request, res: Response): Promise<void> {
    const { id } = CatalogIdParamSchema.parse(req.params);
    await this.catalog.deleteBrand(id);
    res.status(204).end();
  }

  private async createCategory(req: Request, res: Response): Promise<void> {
    const body = CatalogNameBodySchema.parse(req.body);
    const row = await this.catalog.createCategory(body.name);
    res.status(201).json(row);
  }

  private async updateCategory(req: Request, res: Response): Promise<void> {
    const { id } = CatalogIdParamSchema.parse(req.params);
    const body = CatalogNameBodySchema.parse(req.body);
    await this.catalog.updateCategory(id, body.name);
    res.status(204).end();
  }

  private async deleteCategory(req: Request, res: Response): Promise<void> {
    const { id } = CatalogIdParamSchema.parse(req.params);
    await this.catalog.deleteCategory(id);
    res.status(204).end();
  }
}
