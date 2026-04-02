import { z } from 'zod';

export const AddWishlistBodySchema = z.object({
  shoeId: z.string().min(1).max(10),
});

export type AddWishlistBodyInput = z.infer<typeof AddWishlistBodySchema>;
