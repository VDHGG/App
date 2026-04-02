import { Router } from 'express';
import type { Request, Response, RequestHandler } from 'express';
import type { WishlistUseCase } from '@usecase/WishlistUseCase.port';
import { AddWishlistBodySchema } from './wishlist.schema';
import { asyncRoute } from './middleware/routeMiddleware';
import { ValidationError } from '@domain/errors/ValidationError';

export type WishlistRouteGuards = {
  customer: RequestHandler[];
};

export class WishlistController {
  private readonly wishlist: WishlistUseCase;

  constructor(wishlist: WishlistUseCase) {
    this.wishlist = wishlist;
  }

  routes(guards: WishlistRouteGuards): Router {
    const router = Router();
    const customer = guards.customer;
    router.get('/shoe-ids', ...customer, asyncRoute(this.getShoeIds.bind(this)));
    router.get('/', ...customer, asyncRoute(this.list.bind(this)));
    router.post('/', ...customer, asyncRoute(this.add.bind(this)));
    router.delete('/clear', ...customer, asyncRoute(this.clear.bind(this)));
    router.delete('/:shoeId', ...customer, asyncRoute(this.remove.bind(this)));
    return router;
  }

  private customerId(req: Request): string {
    const id = req.auth?.customerId;
    if (!id) {
      throw new ValidationError('Account is not linked to a customer profile.');
    }
    return id;
  }

  private async list(req: Request, res: Response): Promise<void> {
    const result = await this.wishlist.listForCustomer(this.customerId(req));
    res.json(result);
  }

  private async getShoeIds(req: Request, res: Response): Promise<void> {
    const result = await this.wishlist.getShoeIds(this.customerId(req));
    res.json(result);
  }

  private async add(req: Request, res: Response): Promise<void> {
    const body = AddWishlistBodySchema.parse(req.body);
    await this.wishlist.add(this.customerId(req), body.shoeId);
    res.status(204).send();
  }

  private async remove(req: Request, res: Response): Promise<void> {
    const shoeId = req.params['shoeId'] as string;
    await this.wishlist.remove(this.customerId(req), shoeId);
    res.status(204).send();
  }

  private async clear(req: Request, res: Response): Promise<void> {
    await this.wishlist.clear(this.customerId(req));
    res.status(204).send();
  }
}
