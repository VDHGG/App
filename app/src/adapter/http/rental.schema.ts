import { z } from 'zod';

const CreateRentalItemSchema = z.object({
  variantId: z.string().min(1),
  quantity: z.number().int().positive(),
});

export const CreateRentalSchema = z
  .object({
    customerId: z.string().min(1),
    items: z.array(CreateRentalItemSchema).min(1),
    startDate: z.coerce.date(),
    endDate: z.coerce.date(),
  })
  .refine((d) => d.endDate >= d.startDate, {
    message: 'End date cannot be before start date',
    path: ['endDate'],
  });

export const ReturnRentalSchema = z.object({
  returnedAt: z.coerce.date().optional(),
  note: z.string().max(255).optional(),
});

export const CancelRentalSchema = z.object({
  cancelledAt: z.coerce.date().optional(),
  note: z.string().max(255).optional(),
});

export const ListRentalsQuerySchema = z
  .object({
    status: z.enum(['RESERVED', 'ACTIVE', 'RETURNED', 'CANCELLED']).optional(),
    startDateFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    startDateTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    amountBucket: z.enum(['all', 'lt50', '50to150', '150to300', 'gt300']).optional(),
    search: z.string().max(200).optional(),
    page: z.coerce.number().int().min(1).optional(),
    pageSize: z.coerce.number().int().min(1).max(50).optional(),
  })
  .refine(
    (q) =>
      !q.startDateFrom ||
      !q.startDateTo ||
      q.startDateFrom <= q.startDateTo,
    { message: 'startDateFrom must be on or before startDateTo', path: ['startDateTo'] }
  );

export type CreateRentalInput = z.infer<typeof CreateRentalSchema>;
export type ReturnRentalInput = z.infer<typeof ReturnRentalSchema>;
export type CancelRentalInput = z.infer<typeof CancelRentalSchema>;
export type ListRentalsQueryInput = z.infer<typeof ListRentalsQuerySchema>;

export const ListMyRentalsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(50).optional(),
});

export type ListMyRentalsQueryInput = z.infer<typeof ListMyRentalsQuerySchema>;
