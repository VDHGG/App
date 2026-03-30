import { z } from 'zod';

export const CatalogNameBodySchema = z.object({
  name: z.string().min(1).max(100),
});

export const CatalogIdParamSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export type CatalogNameBodyInput = z.infer<typeof CatalogNameBodySchema>;
