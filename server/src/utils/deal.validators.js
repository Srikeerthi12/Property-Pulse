import { z } from 'zod';

export const dealStatusSchema = z.enum([
  'open',
  'negotiation',
  'agreement_pending',
  'closed_won',
  'closed_lost',
  'cancelled',
]);

export const createDealSchema = z.object({
  inquiryId: z.string().uuid(),
  offerPrice: z.coerce.number().positive().optional(),
  message: z.string().max(2000).optional(),
  adminOverride: z.coerce.boolean().optional(),
  overrideReason: z.string().max(500).optional(),
});

export const listDealsSchema = z.object({
  status: dealStatusSchema.optional(),
  agentId: z.string().uuid().optional(),
  buyerId: z.string().uuid().optional(),
  propertyId: z.string().uuid().optional(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export const updateDealStatusSchema = z.object({
  status: dealStatusSchema,
  finalPrice: z.coerce.number().positive().optional(),
  notes: z.string().max(2000).optional(),
});

export const updateDealOfferSchema = z.object({
  offerPrice: z.coerce.number().positive(),
  message: z.string().max(2000).optional(),
});
