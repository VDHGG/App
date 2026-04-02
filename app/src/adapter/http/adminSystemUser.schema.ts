import { z } from 'zod';

export const ListSystemUsersQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(50).optional(),
  search: z.string().max(200).optional(),
});

export type ListSystemUsersQueryInput = z.infer<typeof ListSystemUsersQuerySchema>;

export const AdminUpdateSystemUserBodySchema = z.object({
  fullName: z.string().min(1).max(100),
  email: z.string().email().max(255).transform((v) => v.toLowerCase()),
  phone: z.string().max(20).nullable().optional(),
  roleId: z.coerce.number().int().min(1).max(99),
  isActive: z.boolean(),
  customerId: z.union([z.string().min(1).max(20), z.null()]),
  newPassword: z.string().min(8).max(100).optional(),
});

export type AdminUpdateSystemUserBodyInput = z.infer<typeof AdminUpdateSystemUserBodySchema>;
