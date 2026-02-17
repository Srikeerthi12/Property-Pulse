import { z } from 'zod';

import {
  addInquiryNote,
  createInquiry,
  getInquiryByIdWithJoins,
  isActiveAgentById,
  listBuyerInquiries,
  listInquiryNotes,
  pickLeastLoadedAgentId,
  updateInquiryOfferByBuyer,
  updateInquiryStatus,
} from '../models/inquiry.model.js';
import { getPropertyByIdMapped } from '../models/property.model.js';
import {
  addInquiryNoteSchema,
  createInquirySchema,
  listMyInquiriesSchema,
  submitInquiryOfferSchema,
  updateInquiryStatusSchema,
} from '../utils/inquiry.validators.js';
import { getDealByInquiryIdMapped } from '../models/deal.model.js';

function roleOf(req) {
  return req.user?.role ? String(req.user.role).toLowerCase() : null;
}

function assertInquiryStatusTransition(from, to) {
  if (!from || !to) return false;
  if (from === to) return true;

  // Final states: no transitions out.
  if (from === 'closed' || from === 'dropped') return false;

  const allowed = {
    new: new Set(['contacted', 'dropped']),
    contacted: new Set(['visit_scheduled', 'dropped']),
    visit_scheduled: new Set(['negotiation', 'dropped']),
    negotiation: new Set(['closed', 'dropped']),
    closed: new Set([]),
    dropped: new Set([]),
  };

  return Boolean(allowed[from]?.has(to));
}

export async function createBuyerInquiry(req, res) {
  const parsed = createInquirySchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid payload', issues: parsed.error.issues });

  const buyerId = req.auth?.sub;
  if (!buyerId) return res.status(401).json({ error: 'Unauthorized' });

  const property = await getPropertyByIdMapped(parsed.data.propertyId);
  if (!property) return res.status(404).json({ error: 'Property not found' });
  if (property.status === 'sold') return res.status(409).json({ error: 'Property is already sold' });
  if (property.status !== 'approved') return res.status(404).json({ error: 'Property not found' });

  // Assign an agent:
  // - If seller is an agent, assign them.
  // - Otherwise pick the least-loaded active agent.
  let agentId = null;
  if (property.sellerId && (await isActiveAgentById(property.sellerId))) {
    agentId = property.sellerId;
  } else {
    agentId = await pickLeastLoadedAgentId();
  }

  try {
    const inquiry = await createInquiry({
      propertyId: parsed.data.propertyId,
      buyerId,
      agentId,
      message: parsed.data.message,
    });
    const full = await getInquiryByIdWithJoins(inquiry.id);
    return res.status(201).json({ inquiry: full });
  } catch (err) {
    // Unique constraint: prevent duplicate lead per buyer+property
    if (err?.code === '23505') {
      return res.status(409).json({ error: 'You have already inquired about this property' });
    }
    throw err;
  }
}

export async function myInquiries(req, res) {
  const parsed = listMyInquiriesSchema.safeParse(req.query);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid query', issues: parsed.error.issues });

  const buyerId = req.auth?.sub;
  if (!buyerId) return res.status(401).json({ error: 'Unauthorized' });

  const items = await listBuyerInquiries({
    buyerId,
    page: parsed.data.page,
    limit: parsed.data.limit,
  });
  return res.json({ items, page: parsed.data.page, limit: parsed.data.limit });
}

export async function submitOffer(req, res) {
  const parsedParams = z.object({ id: z.string().uuid() }).safeParse(req.params);
  if (!parsedParams.success) return res.status(400).json({ error: 'Invalid inquiry id' });

  const parsed = submitInquiryOfferSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid payload', issues: parsed.error.issues });

  const buyerId = req.auth?.sub;
  if (!buyerId) return res.status(401).json({ error: 'Unauthorized' });

  const inquiry = await getInquiryByIdWithJoins(parsedParams.data.id);
  if (!inquiry) return res.status(404).json({ error: 'Lead not found' });
  if (inquiry.buyerId !== buyerId) return res.status(403).json({ error: 'Forbidden' });
  if (String(inquiry.status) === 'dropped') return res.status(409).json({ error: 'Cannot submit offer for dropped inquiry' });

  // After deal exists, buyer must update the deal offer (subject to deal status rules)
  const existingDeal = await getDealByInquiryIdMapped(inquiry.id);
  if (existingDeal) {
    return res.status(409).json({ error: 'Deal already exists for this inquiry. Update offer from Deals.' });
  }

  const property = await getPropertyByIdMapped(inquiry.propertyId);
  if (!property) return res.status(404).json({ error: 'Property not found' });
  if (property.status === 'sold') return res.status(409).json({ error: 'Property is already sold' });

  const updated = await updateInquiryOfferByBuyer({
    inquiryId: inquiry.id,
    buyerId,
    offerPrice: parsed.data.offerPrice,
    offerMessage: parsed.data.message ?? null,
  });
  const full = await getInquiryByIdWithJoins(updated.id);
  return res.json({ inquiry: full });
}

export async function updateStatus(req, res) {
  const parsedParams = z.object({ id: z.string().uuid() }).safeParse(req.params);
  if (!parsedParams.success) return res.status(400).json({ error: 'Invalid inquiry id' });

  const parsedBody = updateInquiryStatusSchema.safeParse(req.body);
  if (!parsedBody.success) return res.status(400).json({ error: 'Invalid payload', issues: parsedBody.error.issues });

  const agentId = req.auth?.sub;
  if (!agentId) return res.status(401).json({ error: 'Unauthorized' });

  const existing = await getInquiryByIdWithJoins(parsedParams.data.id);
  if (!existing) return res.status(404).json({ error: 'Lead not found' });
  if (!existing.agentId || existing.agentId !== agentId) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const property = await getPropertyByIdMapped(existing.propertyId);
  if (!property) return res.status(404).json({ error: 'Property not found' });
  if (property.status === 'sold') return res.status(409).json({ error: 'Property is already sold' });

  if (!assertInquiryStatusTransition(existing.status, parsedBody.data.status)) {
    return res.status(409).json({ error: 'Invalid status transition' });
  }

  const updated = await updateInquiryStatus({
    inquiryId: parsedParams.data.id,
    agentId,
    status: parsedBody.data.status,
  });

  if (!updated) return res.status(404).json({ error: 'Lead not found' });
  const full = await getInquiryByIdWithJoins(updated.id);
  return res.json({ inquiry: full });
}

export async function addNote(req, res) {
  const parsedParams = z.object({ id: z.string().uuid() }).safeParse(req.params);
  if (!parsedParams.success) return res.status(400).json({ error: 'Invalid inquiry id' });

  const parsedBody = addInquiryNoteSchema.safeParse(req.body);
  if (!parsedBody.success) return res.status(400).json({ error: 'Invalid payload', issues: parsedBody.error.issues });

  const agentId = req.auth?.sub;
  if (!agentId) return res.status(401).json({ error: 'Unauthorized' });

  const inquiry = await getInquiryByIdWithJoins(parsedParams.data.id);
  if (!inquiry) return res.status(404).json({ error: 'Lead not found' });
  if (!inquiry.agentId || inquiry.agentId !== agentId) return res.status(403).json({ error: 'Forbidden' });

  if (String(inquiry.status) === 'closed' || String(inquiry.status) === 'dropped') {
    return res.status(409).json({ error: 'Cannot add notes to closed/dropped leads' });
  }

  const property = await getPropertyByIdMapped(inquiry.propertyId);
  if (!property) return res.status(404).json({ error: 'Property not found' });
  if (property.status === 'sold') return res.status(409).json({ error: 'Property is already sold' });

  const note = await addInquiryNote({ inquiryId: inquiry.id, agentId, note: parsedBody.data.note });
  return res.status(201).json({ note });
}

export async function notes(req, res) {
  const parsedParams = z.object({ id: z.string().uuid() }).safeParse(req.params);
  if (!parsedParams.success) return res.status(400).json({ error: 'Invalid inquiry id' });

  const inquiry = await getInquiryByIdWithJoins(parsedParams.data.id);
  if (!inquiry) return res.status(404).json({ error: 'Lead not found' });

  const role = roleOf(req);
  const userId = req.auth?.sub;
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  // Allowed: assigned agent OR admin.
  if (role !== 'admin' && inquiry.agentId !== userId) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const items = await listInquiryNotes(inquiry.id);
  return res.json({ items });
}
