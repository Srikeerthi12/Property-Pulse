import { z } from 'zod';

const statusSchema = z.enum(['draft', 'pending', 'approved', 'rejected', 'sold', 'inactive']);

const amenitiesSchema = z
  .preprocess(
    (v) => {
      if (typeof v === 'string') {
        try {
          return JSON.parse(v);
        } catch {
          return v;
        }
      }
      return v;
    },
    z.array(z.string().trim().min(1)).max(200).default([]),
  )
  .optional();

const propertyTypeSchema = z
  .preprocess((v) => (typeof v === 'string' ? v.trim().toLowerCase() : v), z.enum(['flat', 'villa', 'land']))
  .optional();

export const createPropertySchema = z.object({
  title: z.string().trim().min(3).max(200),
  description: z.string().trim().max(5000).optional().nullable(),
  price: z.coerce.number().positive().optional().nullable(),
  area: z.coerce.number().positive().optional().nullable(),
  location: z.string().trim().max(200).optional().nullable(),
  latitude: z.coerce.number().min(-90).max(90).optional().nullable(),
  longitude: z.coerce.number().min(-180).max(180).optional().nullable(),
  propertyType: propertyTypeSchema,
  bedrooms: z.coerce.number().int().min(0).max(50).optional().nullable(),
  bathrooms: z.coerce.number().int().min(0).max(50).optional().nullable(),
  amenities: amenitiesSchema,
  submit: z.preprocess((v) => v === 'true' || v === true, z.boolean().optional()),
});

export const updatePropertySchema = createPropertySchema
  .omit({ submit: true })
  .partial()
  .refine((data) => Object.keys(data).length > 0, { message: 'No updates provided' });

export const submitPropertySchema = z.object({});

export const rejectSchema = z.object({
  reason: z.string().trim().min(3).max(500),
});

export const listApprovedSchema = z.object({
  q: z.string().trim().max(200).optional(),
  location: z.string().trim().max(200).optional(),
  minPrice: z.coerce.number().optional(),
  maxPrice: z.coerce.number().optional(),
  propertyType: propertyTypeSchema,
  sort: z.enum(['newest', 'price_asc', 'price_desc']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(12),
});

export { statusSchema };
