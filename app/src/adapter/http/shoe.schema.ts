import { z } from 'zod';

const VariantSchema = z.object({
  size: z.number().int().min(1).max(60),
  color: z.string().min(1).max(100),
  totalQuantity: z.number().int().min(0),
});

export const AddShoeSchema = z.object({
  name: z.string().min(1).max(100),
  brand: z.string().min(1).max(100),
  category: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  pricePerDay: z.number().positive(),
  variants: z.array(VariantSchema).min(1),
});

export type AddShoeInput = z.infer<typeof AddShoeSchema>;
