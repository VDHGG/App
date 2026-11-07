import { Router } from 'express';
import type { Request, Response, RequestHandler } from 'express';
import { z } from 'zod';
import type { Pool, RowDataPacket } from 'mysql2/promise';
import { RentalPeriod } from '@domain/RentalPeriod.vo';
import type { RentalAvailabilityChecker } from '@port/RentalAvailabilityChecker.port';
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
  customer?: RequestHandler[];
};

export class ShoeController {
  private readonly addShoe: AddShoeUseCase;
  private readonly updateShoe: UpdateShoeUseCase;
  private readonly deactivateShoe: DeactivateShoeUseCase;
  private readonly listShoes: ListShoesUseCase;
  private readonly getShoe: GetShoeUseCase;
  private readonly catalog: CatalogLookupPort;
  private readonly availabilityChecker?: RentalAvailabilityChecker;
  private readonly pool?: Pool;

  constructor(
    addShoe: AddShoeUseCase,
    updateShoe: UpdateShoeUseCase,
    deactivateShoe: DeactivateShoeUseCase,
    listShoes: ListShoesUseCase,
    getShoe: GetShoeUseCase,
    catalog: CatalogLookupPort,
    availabilityChecker?: RentalAvailabilityChecker,
    pool?: Pool
  ) {
    this.addShoe = addShoe;
    this.updateShoe = updateShoe;
    this.deactivateShoe = deactivateShoe;
    this.listShoes = listShoes;
    this.getShoe = getShoe;
    this.catalog = catalog;
    this.availabilityChecker = availabilityChecker;
    this.pool = pool;
  }

  routes(transactionManager: TransactionManager, guards?: RouteGuards): Router {
    const router = Router();
    const admin = guards?.admin ?? [];
    const authenticated = guards?.authenticated ?? [];
    const customer = guards?.customer ?? [];
    router.get('/catalog/shoe-lookups', ...authenticated, asyncRoute(this.shoeLookups.bind(this)));
    router.get('/reviews', ...admin, asyncRoute(this.listAllReviewsAdmin.bind(this)));
    router.delete('/reviews/:reviewId', ...admin, asyncRoute(this.deleteReviewAdmin.bind(this)));
    router.get('/shoes', ...authenticated, asyncRoute(this.list.bind(this)));
    router.post('/shoes', ...admin, transactionalRoute(transactionManager, this.add.bind(this)));
    router.get('/shoes/:id/availability', ...authenticated, asyncRoute(this.getAvailability.bind(this)));
    router.get('/shoes/:id/reviews', ...authenticated, asyncRoute(this.getReviews.bind(this)));
    router.post('/shoes/:id/reviews', ...customer, asyncRoute(this.postReview.bind(this)));
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

  private async getAvailability(req: Request, res: Response): Promise<void> {
    const shoeId = req.params['id'] as string;
    const startDateStr = String(req.query['startDate'] ?? '').trim();
    const endDateStr = String(req.query['endDate'] ?? '').trim();

    if (!startDateStr || !endDateStr) {
      throw new ValidationError('startDate and endDate query parameters are required.');
    }

    const startDate = new Date(startDateStr);
    const endDate = new Date(endDateStr);
    const period = new RentalPeriod(startDate, endDate);

    const shoe = await this.getShoe.execute({ shoeId });

    const variants = await Promise.all(
      shoe.variants.map(async (v) => {
        let reservedQuantity = 0;
        if (this.availabilityChecker) {
          reservedQuantity = await this.availabilityChecker.getReservedQuantityForVariant(
            v.variantId,
            period
          );
        }
        const availableQuantity = Math.max(0, v.totalQuantity - reservedQuantity);
        return {
          variantId: v.variantId,
          size: v.size,
          color: v.color,
          totalQuantity: v.totalQuantity,
          reservedQuantity,
          availableQuantity,
        };
      })
    );

    res.json({
      shoeId,
      startDate: period.startDate,
      endDate: period.endDate,
      durationDays: period.durationInDays,
      variants,
    });
  }

  private async getReviews(req: Request, res: Response): Promise<void> {
    const shoeId = req.params['id'] as string;
    await this.getShoe.execute({ shoeId });

    if (!this.pool) {
      res.json({ shoeId, averageRating: 5, totalReviews: 0, reviews: [] });
      return;
    }

    const [rows] = await this.pool.query<RowDataPacket[]>(
      `SELECT review_id, shoe_id, customer_id, customer_name, rating, comment, created_at
       FROM shoe_reviews
       WHERE shoe_id = ?
       ORDER BY created_at DESC`,
      [shoeId]
    );

    const reviews = rows.map((r) => ({
      reviewId: Number(r['review_id']),
      shoeId: String(r['shoe_id']),
      customerId: String(r['customer_id']),
      customerName: String(r['customer_name']),
      rating: Number(r['rating']),
      comment: String(r['comment']),
      createdAt: new Date(r['created_at']).toISOString(),
    }));

    const totalReviews = reviews.length;
    const averageRating =
      totalReviews > 0
        ? Math.round((reviews.reduce((sum, r) => sum + r.rating, 0) / totalReviews) * 10) / 10
        : 5;

    res.json({ shoeId, averageRating, totalReviews, reviews });
  }

  private async postReview(req: Request, res: Response): Promise<void> {
    const auth = req.auth;
    if (!auth?.customerId) {
      throw new ValidationError('Account is not linked to a customer profile.');
    }

    const shoeId = req.params['id'] as string;
    await this.getShoe.execute({ shoeId });

    const schema = z.object({
      rating: z.number().int().min(1).max(5),
      comment: z.string().trim().min(1).max(500),
    });
    const body = schema.parse(req.body);

    if (!this.pool) {
      res.status(201).json({ shoeId, customerId: auth.customerId, customerName: auth.customerId, ...body });
      return;
    }

    let customerName = auth.customerId;
    try {
      const [cRows] = await this.pool.query<RowDataPacket[]>(
        'SELECT full_name FROM customers WHERE customer_id = ? LIMIT 1',
        [auth.customerId]
      );
      if (cRows.length > 0 && cRows[0]['full_name']) {
        customerName = String(cRows[0]['full_name']);
      }
    } catch {
      // ignore
    }

    await this.pool.query(
      `INSERT INTO shoe_reviews (shoe_id, customer_id, customer_name, rating, comment)
       VALUES (?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         rating = VALUES(rating),
         comment = VALUES(comment),
         customer_name = VALUES(customer_name),
         updated_at = NOW()`,
      [shoeId, auth.customerId, customerName, body.rating, body.comment]
    );

    res.status(201).json({
      shoeId,
      customerId: auth.customerId,
      customerName,
      rating: body.rating,
      comment: body.comment,
    });
  }

  private async listAllReviewsAdmin(req: Request, res: Response): Promise<void> {
    if (!this.pool) {
      res.json({ reviews: [], total: 0, averageRating: 5 });
      return;
    }

    const conditions: string[] = [];
    const params: Array<string | number> = [];

    const rawRating = String(req.query['rating'] ?? '').trim();
    if (
      rawRating === '1' ||
      rawRating === '2' ||
      rawRating === '3' ||
      rawRating === '4' ||
      rawRating === '5'
    ) {
      conditions.push('sr.rating = ?');
      params.push(Number(rawRating));
    }

    const search = String(req.query['search'] ?? '').trim();
    if (search) {
      const like = `%${search}%`;
      conditions.push(
        '(sr.shoe_id LIKE ? OR s.name LIKE ? OR sr.customer_name LIKE ? OR sr.customer_id LIKE ? OR sr.comment LIKE ?)'
      );
      params.push(like, like, like, like, like);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const [rows] = await this.pool.query<RowDataPacket[]>(
      `SELECT sr.review_id, sr.shoe_id, COALESCE(s.name, sr.shoe_id) AS shoe_name,
              sr.customer_id, sr.customer_name, sr.rating, sr.comment, sr.created_at
       FROM shoe_reviews sr
       LEFT JOIN shoes s ON s.shoe_id = sr.shoe_id
       ${whereClause}
       ORDER BY sr.created_at DESC
       LIMIT 200`,
      params
    );

    const reviews = rows.map((r) => ({
      reviewId: Number(r['review_id']),
      shoeId: String(r['shoe_id']),
      shoeName: String(r['shoe_name']),
      customerId: String(r['customer_id']),
      customerName: String(r['customer_name']),
      rating: Number(r['rating']),
      comment: String(r['comment']),
      createdAt: new Date(r['created_at']).toISOString(),
    }));

    const total = reviews.length;
    const averageRating =
      total > 0
        ? Math.round((reviews.reduce((sum, r) => sum + r.rating, 0) / total) * 10) / 10
        : 5;

    res.json({ reviews, total, averageRating });
  }

  private async deleteReviewAdmin(req: Request, res: Response): Promise<void> {
    const reviewId = Number(req.params['reviewId']);
    if (!Number.isInteger(reviewId) || reviewId <= 0) {
      throw new ValidationError('Invalid reviewId.');
    }

    if (!this.pool) {
      res.status(204).end();
      return;
    }

    const [result] = await this.pool.query(
      'DELETE FROM shoe_reviews WHERE review_id = ?',
      [reviewId]
    );
    const affected = (result as { affectedRows?: number })?.affectedRows ?? 0;
    if (affected === 0) {
      res.status(404).json({ error: 'NOT_FOUND', message: 'Review not found.' });
      return;
    }

    res.status(204).end();
  }
}
