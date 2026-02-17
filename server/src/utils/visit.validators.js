import { z } from 'zod';

export const visitStatusSchema = z.enum([
  'scheduled',
  'confirmed',
  'completed',
  'cancelled',
  'rescheduled',
  'no_show',
]);

export const createVisitSchema = z.object({
  inquiryId: z.string().uuid(),
  visitDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  visitTime: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/),
  notes: z.string().max(2000).optional(),
});

export const listVisitsSchema = z.object({
  status: visitStatusSchema.optional(),
  agentId: z.string().uuid().optional(),
  buyerId: z.string().uuid().optional(),
  sellerId: z.string().uuid().optional(),
  propertyId: z.string().uuid().optional(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(500).default(50),
});

export const updateVisitStatusSchema = z.object({
  status: visitStatusSchema,
  notes: z.string().max(2000).optional(),
});

export const rescheduleVisitSchema = z.object({
  visitDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  visitTime: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/),
  notes: z.string().max(2000).optional(),
});

export const reassignVisitSchema = z.object({
  agentId: z.string().uuid().nullable(),
});
