import { z } from 'zod';

export const LoginAdminSchema = z.object({
  email: z.string().min(1, 'Email is required.'),
  password: z.string().min(1, 'Password is required.'),
});
