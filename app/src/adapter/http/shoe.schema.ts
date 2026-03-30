import { z } from 'zod';

export const ListShoesQuerySchema = z.object({
  priceBucket: z.enum(['all', 'lt10', '10to20', '20to50', 'gt50']).optional(),
  stockBucket: z.enum(['all', '0', '1to5', '6plus']).optional(),
});

export type ListShoesQueryInput = z.infer<typeof ListShoesQuerySchema>;

const VariantSchema = z.object({
  size: z.number().int().min(1).max(60),
  colorId: z.number().int().positive(),
  totalQuantity: z.number().int().min(0),
});

export const AddShoeSchema = z.object({
  name: z.string().min(1).max(100),
  brandId: z.number().int().positive(),
  categoryId: z.number().int().positive(),
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
  colorId: z.number().int().positive(),
  totalQuantity: z.number().int().min(0),
});

export const UpdateShoeBodySchema = z
  .object({
    name: z.string().min(1).max(100).optional(),
    brandId: z.number().int().positive().optional(),
    categoryId: z.number().int().positive().optional(),
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
      d.brandId !== undefined ||
      d.categoryId !== undefined ||
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
