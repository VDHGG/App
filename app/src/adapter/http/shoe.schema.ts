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
  imagePublicId: z.string().min(1).max(512).optional(),
  variants: z.array(VariantSchema).min(1),
});

const VariantQuantityUpdateSchema = z.object({
  variantId: z.string().min(1),
  totalQuantity: z.number().int().min(0),
});

const NewVariantBodySchema = z.object({
  size: z.number().int().min(1).max(60),
  color: z.string().min(1).max(100),
  totalQuantity: z.number().int().min(0),
});

export const UpdateShoeBodySchema = z
  .object({
    name: z.string().min(1).max(100).optional(),
    brand: z.string().min(1).max(100).optional(),
    category: z.string().min(1).max(100).optional(),
    description: z.string().max(500).nullable().optional(),
    pricePerDay: z.number().positive().optional(),
    isActive: z.boolean().optional(),
    imagePublicId: z.string().min(1).max(512).nullable().optional(),
    variantQuantityUpdates: z.array(VariantQuantityUpdateSchema).optional(),
    newVariants: z.array(NewVariantBodySchema).optional(),
  })
  .refine(
    (d) =>
      d.name !== undefined ||
      d.brand !== undefined ||
      d.category !== undefined ||
      d.description !== undefined ||
      d.pricePerDay !== undefined ||
      d.isActive !== undefined ||
      d.imagePublicId !== undefined ||
      (d.variantQuantityUpdates !== undefined && d.variantQuantityUpdates.length > 0) ||
      (d.newVariants !== undefined && d.newVariants.length > 0),
    { message: 'At least one field must be provided to update the shoe.' }
  );

export type AddShoeInput = z.infer<typeof AddShoeSchema>;
export type UpdateShoeBodyInput = z.infer<typeof UpdateShoeBodySchema>;
