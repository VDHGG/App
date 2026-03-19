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

export const ListRentalsQuerySchema = z.object({
  status: z.enum(['RESERVED', 'ACTIVE', 'RETURNED', 'CANCELLED']).optional(),
});

export type CreateRentalInput = z.infer<typeof CreateRentalSchema>;
export type ReturnRentalInput = z.infer<typeof ReturnRentalSchema>;
export type CancelRentalInput = z.infer<typeof CancelRentalSchema>;
export type ListRentalsQueryInput = z.infer<typeof ListRentalsQuerySchema>;
