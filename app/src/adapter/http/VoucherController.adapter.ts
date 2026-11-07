import { Router } from 'express';
import type { Request, Response, RequestHandler } from 'express';
import { z } from 'zod';
import type { VoucherRepository } from '@port/VoucherRepository.port';
import { asyncRoute } from './middleware/routeMiddleware';
import { NotFoundError } from '@domain/errors/NotFoundError';
import { ValidationError } from '@domain/errors/ValidationError';

const CreateVoucherSchema = z.object({
  code: z
    .string()
    .trim()
    .min(2)
    .max(32)
    .regex(/^[A-Za-z0-9_-]+$/, 'Mã voucher chỉ bao gồm chữ cái, số, gạch dưới và gạch nối.'),
  discountPercent: z.number().int().min(1).max(50),
  description: z.string().trim().min(1).max(255),
  isActive: z.boolean().optional().default(true),
  maxUses: z.number().int().min(1).nullable().optional(),
  expiresAt: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}/, 'Ngày hết hạn phải theo định dạng YYYY-MM-DD.')
    .transform((s) => s.slice(0, 10))
    .nullable()
    .optional(),
});

const UpdateVoucherSchema = z.object({
  discountPercent: z.number().int().min(1).max(50).optional(),
  description: z.string().trim().min(1).max(255).optional(),
  isActive: z.boolean().optional(),
  maxUses: z.number().int().min(1).nullable().optional(),
  expiresAt: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}/, 'Ngày hết hạn phải theo định dạng YYYY-MM-DD.')
    .transform((s) => s.slice(0, 10))
    .nullable()
    .optional(),
});

export class VoucherController {
  private readonly voucherRepo: VoucherRepository;

  constructor(voucherRepo: VoucherRepository) {
    this.voucherRepo = voucherRepo;
  }

  routes(adminGuards: RequestHandler[]): Router {
    const router = Router();
    router.get('/', ...adminGuards, asyncRoute(this.listAll.bind(this)));
    router.post('/', ...adminGuards, asyncRoute(this.create.bind(this)));
    router.patch('/:code', ...adminGuards, asyncRoute(this.update.bind(this)));
    router.delete('/:code', ...adminGuards, asyncRoute(this.delete.bind(this)));
    return router;
  }

  private async listAll(_req: Request, res: Response): Promise<void> {
    const vouchers = await this.voucherRepo.listAll();
    res.json({ vouchers });
  }

  private async create(req: Request, res: Response): Promise<void> {
    const body = CreateVoucherSchema.parse(req.body);
    const code = body.code.toUpperCase();
    const existing = await this.voucherRepo.findByCode(code);
    if (existing) {
      throw new ValidationError(`Mã voucher ${code} đã tồn tại.`);
    }
    const saved = await this.voucherRepo.save({
      code,
      discountPercent: body.discountPercent,
      description: body.description,
      isActive: body.isActive ?? true,
      maxUses: body.maxUses ?? null,
      expiresAt: body.expiresAt ?? null,
    });
    res.status(201).json(saved);
  }

  private async update(req: Request, res: Response): Promise<void> {
    const rawCode = String(req.params['code'] ?? '').trim().toUpperCase();
    const existing = await this.voucherRepo.findByCode(rawCode);
    if (!existing) {
      throw new NotFoundError('Voucher', rawCode);
    }

    const body = UpdateVoucherSchema.parse(req.body);
    if (body.maxUses !== undefined && body.maxUses !== null && body.maxUses < existing.usedCount) {
      throw new ValidationError(
        `Giới hạn lượt dùng (${body.maxUses}) không thể nhỏ hơn số lượt đã dùng (${existing.usedCount}).`
      );
    }
    const updated = await this.voucherRepo.save({
      code: existing.code,
      discountPercent: body.discountPercent ?? existing.discountPercent,
      description: body.description ?? existing.description,
      isActive: body.isActive !== undefined ? body.isActive : existing.isActive,
      maxUses: body.maxUses !== undefined ? body.maxUses : existing.maxUses,
      expiresAt: body.expiresAt !== undefined ? body.expiresAt : existing.expiresAt,
    });
    res.json(updated);
  }

  private async delete(req: Request, res: Response): Promise<void> {
    const rawCode = String(req.params['code'] ?? '').trim().toUpperCase();
    const deleted = await this.voucherRepo.deleteByCode(rawCode);
    if (!deleted) {
      throw new NotFoundError('Voucher', rawCode);
    }
    res.status(204).end();
  }
}
