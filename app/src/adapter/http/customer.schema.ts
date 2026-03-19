import { z } from 'zod';

export const RegisterCustomerSchema = z.object({
  fullName: z.string().min(1).max(100),
  email: z.string().email().max(255).transform((v) => v.toLowerCase()),
  rank: z.enum(['BRONZE', 'SILVER', 'GOLD', 'DIAMOND']).optional(),
});

export type RegisterCustomerInput = z.infer<typeof RegisterCustomerSchema>;
