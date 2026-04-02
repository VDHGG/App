import { z } from 'zod';

export const RegisterCustomerSchema = z.object({
  fullName: z.string().min(1).max(100),
  email: z.string().email().max(255).transform((v) => v.toLowerCase()),
  phone: z.string().min(8).max(15).trim(),
  rank: z.enum(['BRONZE', 'SILVER', 'GOLD', 'DIAMOND']).optional(),
});

export type RegisterCustomerInput = z.infer<typeof RegisterCustomerSchema>;

export const ListCustomersQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(50).optional(),
  search: z.string().max(200).optional(),
});

export type ListCustomersQueryInput = z.infer<typeof ListCustomersQuerySchema>;

export const UpdateCustomerAdminSchema = z.object({
  fullName: z.string().min(1).max(100),
  email: z.string().email().max(255).transform((v) => v.toLowerCase()),
  phone: z.string().max(15).nullable().optional(),
  rank: z.enum(['BRONZE', 'SILVER', 'GOLD', 'DIAMOND']),
  isActive: z.boolean(),
});

export type UpdateCustomerAdminInput = z.infer<typeof UpdateCustomerAdminSchema>;
