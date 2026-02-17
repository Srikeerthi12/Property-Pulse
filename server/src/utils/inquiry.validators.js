import { z } from 'zod';

export const inquiryStatusSchema = z.enum([
  'new',
  'contacted',
  'visit_scheduled',
  'negotiation',
  'closed',
  'dropped',
]);

export const createInquirySchema = z.object({
  propertyId: z.string().uuid(),
  message: z.string().trim().max(2000).optional().nullable(),
});

export const listMyInquiriesSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export const listAgentLeadsSchema = z.object({
  status: inquiryStatusSchema.optional(),
  q: z.string().trim().max(200).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export const listAdminLeadsSchema = z.object({
  status: inquiryStatusSchema.optional(),
  agentId: z.string().uuid().optional(),
  buyerId: z.string().uuid().optional(),
  propertyId: z.string().uuid().optional(),
  q: z.string().trim().max(200).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export const updateInquiryStatusSchema = z.object({
  status: inquiryStatusSchema,
});

export const addInquiryNoteSchema = z.object({
  note: z.string().trim().min(1).max(4000),
});

export const submitInquiryOfferSchema = z.object({
  offerPrice: z.coerce.number().positive(),
  message: z.string().trim().max(2000).optional().nullable(),
});

export const assignLeadSchema = z.object({
  agentId: z.string().uuid().nullable(),
});

export const createFavoriteSchema = z.object({
  propertyId: z.string().uuid(),
});
