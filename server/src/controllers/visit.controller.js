import { z } from 'zod';

import {
  cancelVisit,
  createVisitFromInquiry,
  getVisitByIdMapped,
  listAdminVisits,
  listAgentVisits,
  listBuyerVisits,
  listSellerVisits,
  reassignVisitAgent,
  rescheduleVisit,
  setVisitStatus,
} from '../models/visit.model.js';
import { getInquiryByIdWithJoins } from '../models/inquiry.model.js';
import { getPropertyByIdMapped } from '../models/property.model.js';
import {
  createVisitSchema,
  listVisitsSchema,
  reassignVisitSchema,
  rescheduleVisitSchema,
  updateVisitStatusSchema,
} from '../utils/visit.validators.js';

function roleOf(req) {
  return req.auth?.role ? String(req.auth.role).toLowerCase() : null;
}

function isAdmin(req) {
  return roleOf(req) === 'admin';
}

function isPastScheduledTime(visit) {
  if (!visit?.scheduledAt) return false;
  const when = new Date(visit.scheduledAt);
  if (Number.isNaN(when.getTime())) return false;
  return when.getTime() < Date.now();
}

function ensureBuyerCanModifyTiming(visit) {
  if (!visit?.scheduledAt) return true;
  const when = new Date(visit.scheduledAt);
  if (Number.isNaN(when.getTime())) return true;
  return when.getTime() > Date.now();
}

export async function create(req, res) {
  const parsed = createVisitSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid payload', issues: parsed.error.issues });

  const role = roleOf(req);
  if (!role) return res.status(401).json({ error: 'Unauthorized' });
  if (!['buyer', 'agent', 'admin'].includes(role)) return res.status(403).json({ error: 'Forbidden' });

  const inquiry = await getInquiryByIdWithJoins(parsed.data.inquiryId);
  if (!inquiry) return res.status(404).json({ error: 'Inquiry not found' });

  const leadStatus = String(inquiry.status);
  if (!['contacted', 'visit_scheduled', 'negotiation'].includes(leadStatus)) {
    return res.status(409).json({ error: 'Visit can only be scheduled after the lead is contacted' });
  }

  const property = await getPropertyByIdMapped(inquiry.propertyId);
  if (!property) return res.status(404).json({ error: 'Property not found' });
  if (property.status === 'sold') return res.status(409).json({ error: 'Property is already sold' });

  // Basic ownership rules
  if (role === 'buyer' && inquiry.buyerId !== req.auth.sub) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  if (role === 'agent' && inquiry.agentId !== req.auth.sub) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  if ((role === 'buyer' || role === 'agent') && !inquiry.agentId) {
    return res.status(409).json({ error: 'Inquiry has no assigned agent yet' });
  }

  const visit = await createVisitFromInquiry({
    inquiryId: inquiry.id,
    visitDate: parsed.data.visitDate,
    visitTime: parsed.data.visitTime,
    notes: parsed.data.notes ?? null,
    createdByUserId: req.auth.sub,
  });
  if (!visit) return res.status(404).json({ error: 'Inquiry not found' });

  return res.status(201).json({ visit });
}

export async function listMy(req, res) {
  const role = roleOf(req);
  if (!role) return res.status(401).json({ error: 'Unauthorized' });
  if (role !== 'buyer') return res.status(403).json({ error: 'Forbidden' });

  const parsed = listVisitsSchema.pick({ status: true, page: true, limit: true }).safeParse(req.query);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid query', issues: parsed.error.issues });

  const items = await listBuyerVisits({
    buyerId: req.auth.sub,
    status: parsed.data.status ?? null,
    page: parsed.data.page,
    limit: parsed.data.limit,
  });
  return res.json({ items, page: parsed.data.page, limit: parsed.data.limit });
}

export async function listAgent(req, res) {
  const role = roleOf(req);
  if (!role) return res.status(401).json({ error: 'Unauthorized' });
  if (!['agent', 'admin'].includes(role)) return res.status(403).json({ error: 'Forbidden' });

  const parsed = listVisitsSchema.pick({ status: true, startDate: true, endDate: true, page: true, limit: true, agentId: true }).safeParse(req.query);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid query', issues: parsed.error.issues });

  const agentId = isAdmin(req) && parsed.data.agentId ? parsed.data.agentId : req.auth.sub;
  const items = await listAgentVisits({
    agentId,
    status: parsed.data.status ?? null,
    startDate: parsed.data.startDate ?? null,
    endDate: parsed.data.endDate ?? null,
    page: parsed.data.page,
    limit: parsed.data.limit,
  });
  return res.json({ items, page: parsed.data.page, limit: parsed.data.limit });
}

export async function list(req, res) {
  const role = roleOf(req);
  if (!role) return res.status(401).json({ error: 'Unauthorized' });

  const parsed = listVisitsSchema.safeParse(req.query);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid query', issues: parsed.error.issues });

  if (role === 'admin') {
    const items = await listAdminVisits({
      status: parsed.data.status ?? null,
      agentId: parsed.data.agentId ?? null,
      buyerId: parsed.data.buyerId ?? null,
      propertyId: parsed.data.propertyId ?? null,
      startDate: parsed.data.startDate ?? null,
      endDate: parsed.data.endDate ?? null,
      page: parsed.data.page,
      limit: parsed.data.limit,
    });
    return res.json({ items, page: parsed.data.page, limit: parsed.data.limit });
  }

  if (role === 'seller') {
    const items = await listSellerVisits({
      sellerId: req.auth.sub,
      status: parsed.data.status ?? null,
      startDate: parsed.data.startDate ?? null,
      endDate: parsed.data.endDate ?? null,
      page: parsed.data.page,
      limit: parsed.data.limit,
    });
    return res.json({ items, page: parsed.data.page, limit: parsed.data.limit });
  }

  return res.status(403).json({ error: 'Forbidden' });
}

export async function updateStatus(req, res) {
  const parsedParams = z.object({ id: z.string().uuid() }).safeParse(req.params);
  if (!parsedParams.success) return res.status(400).json({ error: 'Invalid visit id' });

  const parsed = updateVisitStatusSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid payload', issues: parsed.error.issues });

  const role = roleOf(req);
  if (!role) return res.status(401).json({ error: 'Unauthorized' });

  const visit = await getVisitByIdMapped(parsedParams.data.id);
  if (!visit) return res.status(404).json({ error: 'Visit not found' });

  const next = parsed.data.status;

  if (next === 'completed') {
    if (!visit?.scheduledAt) return res.status(409).json({ error: 'Cannot complete a visit without a scheduled time' });
    const when = new Date(visit.scheduledAt);
    if (Number.isNaN(when.getTime())) return res.status(409).json({ error: 'Cannot complete a visit with an invalid scheduled time' });
    if (when.getTime() > Date.now()) return res.status(409).json({ error: 'Cannot mark a visit completed before its scheduled time' });
  }

  // Permissions
  if (role === 'buyer') {
    if (visit.buyerId !== req.auth.sub) return res.status(403).json({ error: 'Forbidden' });
    if (next !== 'confirmed' && next !== 'cancelled') {
      return res.status(403).json({ error: 'Buyers can only confirm or cancel' });
    }
    if (next === 'cancelled' && !ensureBuyerCanModifyTiming(visit)) {
      return res.status(409).json({ error: 'Cannot cancel after the scheduled time' });
    }
  } else if (role === 'agent') {
    if (visit.agentId !== req.auth.sub) return res.status(403).json({ error: 'Forbidden' });
    // Agents can set workflow statuses
  } else if (role !== 'admin') {
    return res.status(403).json({ error: 'Forbidden' });
  }

  if (next === 'cancelled' && String(visit.status) === 'completed') {
    return res.status(409).json({ error: 'Cannot cancel a completed visit' });
  }

  const updated = await setVisitStatus({ visitId: visit.id, status: next, notes: parsed.data.notes ?? null });
  return res.json({ visit: updated });
}

export async function reschedule(req, res) {
  const parsedParams = z.object({ id: z.string().uuid() }).safeParse(req.params);
  if (!parsedParams.success) return res.status(400).json({ error: 'Invalid visit id' });

  const parsed = rescheduleVisitSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid payload', issues: parsed.error.issues });

  const role = roleOf(req);
  if (!role) return res.status(401).json({ error: 'Unauthorized' });

  const visit = await getVisitByIdMapped(parsedParams.data.id);
  if (!visit) return res.status(404).json({ error: 'Visit not found' });

  if (isPastScheduledTime(visit)) {
    return res.status(409).json({ error: 'Cannot reschedule after the scheduled time' });
  }

  if (role === 'buyer') {
    if (visit.buyerId !== req.auth.sub) return res.status(403).json({ error: 'Forbidden' });
    if (!ensureBuyerCanModifyTiming(visit)) {
      return res.status(409).json({ error: 'Cannot reschedule after the scheduled time' });
    }
  } else if (role === 'agent') {
    if (visit.agentId !== req.auth.sub) return res.status(403).json({ error: 'Forbidden' });
  } else if (role !== 'admin') {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const updated = await rescheduleVisit({
    visitId: visit.id,
    visitDate: parsed.data.visitDate,
    visitTime: parsed.data.visitTime,
    notes: parsed.data.notes ?? null,
  });
  return res.json({ visit: updated });
}

export async function remove(req, res) {
  const parsedParams = z.object({ id: z.string().uuid() }).safeParse(req.params);
  if (!parsedParams.success) return res.status(400).json({ error: 'Invalid visit id' });

  const role = roleOf(req);
  if (!role) return res.status(401).json({ error: 'Unauthorized' });

  const visit = await getVisitByIdMapped(parsedParams.data.id);
  if (!visit) return res.status(404).json({ error: 'Visit not found' });

  if (String(visit.status) === 'completed') {
    return res.status(409).json({ error: 'Cannot cancel a completed visit' });
  }

  if (role === 'buyer') {
    if (visit.buyerId !== req.auth.sub) return res.status(403).json({ error: 'Forbidden' });
    if (!ensureBuyerCanModifyTiming(visit)) {
      return res.status(409).json({ error: 'Cannot cancel after the scheduled time' });
    }
  } else if (role === 'agent') {
    if (visit.agentId !== req.auth.sub) return res.status(403).json({ error: 'Forbidden' });
  } else if (role !== 'admin') {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const updated = await cancelVisit({ visitId: visit.id });
  return res.json({ visit: updated });
}

export async function reassign(req, res) {
  const role = roleOf(req);
  if (!role) return res.status(401).json({ error: 'Unauthorized' });
  if (role !== 'admin') return res.status(403).json({ error: 'Forbidden' });

  const parsedParams = z.object({ id: z.string().uuid() }).safeParse(req.params);
  if (!parsedParams.success) return res.status(400).json({ error: 'Invalid visit id' });

  const parsed = reassignVisitSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid payload', issues: parsed.error.issues });

  const visit = await getVisitByIdMapped(parsedParams.data.id);
  if (!visit) return res.status(404).json({ error: 'Visit not found' });

  const updated = await reassignVisitAgent({ visitId: visit.id, agentId: parsed.data.agentId });
  return res.json({ visit: updated });
}
