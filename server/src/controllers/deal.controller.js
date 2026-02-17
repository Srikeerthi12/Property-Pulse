import { z } from 'zod';

import {
  cancelDeal,
  getDealByIdMapped,
  listAdminDeals,
  listAgentDeals,
  listBuyerDeals,
  listSellerDeals,
  createDealFromInquiry,
  reassignDealAgent,
  setDealStatus,
  updateDealOffer,
} from '../models/deal.model.js';
import { getInquiryByIdWithJoins } from '../models/inquiry.model.js';
import { getPropertyByIdMapped, setPropertyStatus } from '../models/property.model.js';
import { setVisitsCompletedForInquiry } from '../models/visit.model.js';
import { updateInquiryOfferByBuyer, updateInquiryStatusAdminOrAgent } from '../models/inquiry.model.js';
import { logDealAudit } from '../models/dealAudit.model.js';
import { createNotification } from '../models/notification.model.js';
import {
  createDealSchema,
  listDealsSchema,
  updateDealOfferSchema,
  updateDealStatusSchema,
} from '../utils/deal.validators.js';

function roleOf(req) {
  return req.auth?.role ? String(req.auth.role).toLowerCase() : null;
}

function isAdmin(req) {
  return roleOf(req) === 'admin';
}

function isClosedStatus(status) {
  return ['closed_won', 'closed_lost', 'cancelled'].includes(status);
}

function canTransition(from, to) {
  if (!from || !to) return false;
  if (from === to) return true;
  const allowed = {
    open: new Set(['negotiation', 'cancelled']),
    negotiation: new Set(['agreement_pending', 'cancelled']),
    agreement_pending: new Set(['closed_won', 'closed_lost']),
    closed_won: new Set([]),
    closed_lost: new Set([]),
    cancelled: new Set([]),
  };
  return Boolean(allowed[from]?.has(to));
}

function isEditableOfferStatus(status) {
  return status === 'open' || status === 'negotiation';
}

export async function create(req, res) {
  const parsed = createDealSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid payload', issues: parsed.error.issues });

  const role = roleOf(req);
  if (!role) return res.status(401).json({ error: 'Unauthorized' });
  if (!['agent', 'admin'].includes(role)) return res.status(403).json({ error: 'Forbidden' });

  const adminOverrideRequested = role === 'admin' && Boolean(parsed.data.adminOverride);
  if (adminOverrideRequested && !String(parsed.data.overrideReason || '').trim()) {
    return res.status(400).json({ error: 'overrideReason is required when adminOverride is true' });
  }

  const inquiry = await getInquiryByIdWithJoins(parsed.data.inquiryId);
  if (!inquiry) return res.status(404).json({ error: 'Inquiry not found' });

  const leadStatus = String(inquiry.status);
  if (!adminOverrideRequested && (leadStatus === 'dropped' || leadStatus === 'closed')) {
    return res.status(409).json({ error: 'Cannot create deal from closed/dropped inquiry' });
  }

  if (!adminOverrideRequested && !['visit_scheduled', 'negotiation'].includes(leadStatus)) {
    return res.status(409).json({ error: 'Lead must be in Visit or Negotiation to convert to a deal' });
  }

  // Stricter rule: require the latest visit to be completed before conversion.
  if (!adminOverrideRequested && !inquiry.latestVisitCompleted) {
    return res.status(409).json({ error: 'Latest visit must be completed before converting to a deal' });
  }

  if (role === 'agent' && inquiry.agentId !== req.auth.sub) return res.status(403).json({ error: 'Forbidden' });
  if (role === 'agent' && !inquiry.agentId) return res.status(409).json({ error: 'Inquiry has no assigned agent yet' });

  const property = await getPropertyByIdMapped(inquiry.propertyId);
  if (!property) return res.status(404).json({ error: 'Property not found' });
  if (property.status === 'sold') return res.status(409).json({ error: 'Property is already sold' });
  if (!adminOverrideRequested && property.status === 'inactive') return res.status(409).json({ error: 'Property is inactive' });

  const offerPriceRaw = parsed.data.offerPrice ?? inquiry.offerPrice ?? null;
  const offerPrice = offerPriceRaw === null || offerPriceRaw === undefined ? null : Number(offerPriceRaw);
  if (!offerPrice || !Number.isFinite(offerPrice) || offerPrice <= 0) {
    return res.status(400).json({ error: 'offerPrice is required (or buyer must submit an offer first)' });
  }

  const { deal, reason, meta } = await createDealFromInquiry({
    inquiryId: inquiry.id,
    offerPrice,
    message: parsed.data.message ?? inquiry.offerMessage ?? null,
    actorRole: role,
    actorId: req.auth.sub,
    adminOverride: adminOverrideRequested,
    overrideReason: parsed.data.overrideReason ?? null,
  });

  if (reason === 'no_assigned_agent') return res.status(409).json({ error: 'Inquiry has no assigned agent yet' });
  if (reason === 'forbidden') return res.status(403).json({ error: 'Forbidden' });
  if (reason === 'property_sold') return res.status(409).json({ error: 'Property is already sold' });
  if (reason === 'property_inactive') return res.status(409).json({ error: 'Property is inactive' });
  if (reason === 'deal_exists') return res.status(409).json({ error: 'A deal already exists for this inquiry' });
  if (reason === 'lead_closed_or_dropped') return res.status(409).json({ error: 'Cannot create deal from closed/dropped inquiry' });
  if (reason === 'lead_invalid_status') return res.status(409).json({ error: 'Lead must be in Visit or Negotiation to convert to a deal' });
  if (reason === 'visit_required') return res.status(409).json({ error: 'A visit is required before converting to a deal' });
  if (reason === 'visit_mismatch') return res.status(409).json({ error: 'Latest visit is inconsistent with inquiry' });
  if (reason === 'latest_visit_not_completed') return res.status(409).json({ error: 'Latest visit must be completed before converting to a deal' });
  if (reason === 'visit_completed_in_future') return res.status(409).json({ error: 'Visit completion time is invalid' });
  if (!deal) return res.status(500).json({ error: 'Failed to create deal' });

  // Automation: when deal created, inquiry.status = negotiation
  await updateInquiryStatusAdminOrAgent({ inquiryId: inquiry.id, actorId: req.auth.sub, actorRole: role, status: 'negotiation' });

  await logDealAudit({
    dealId: deal.id,
    actorId: req.auth.sub,
    actionType: 'deal_created',
    metadata: {
      inquiryId: inquiry.id,
      latestVisitId: meta?.latestVisitId ?? null,
      usedVisitId: meta?.usedVisitId ?? null,
      adminOverride: Boolean(meta?.adminOverride),
      overrideReason: meta?.overrideReason ?? null,
    },
  });

  // Best-effort notifications
  try {
    const payload = { dealId: deal.id, inquiryId: inquiry.id, propertyId: inquiry.propertyId };
    if (inquiry.buyerId) await createNotification({ userId: inquiry.buyerId, type: 'deal_created', payload });
    if (property?.sellerId) await createNotification({ userId: property.sellerId, type: 'deal_created', payload });
    if (inquiry.agentId) await createNotification({ userId: inquiry.agentId, type: 'deal_created', payload });
  } catch {
    // ignore
  }

  return res.status(201).json({ deal });
}

export async function listMy(req, res) {
  const role = roleOf(req);
  if (!role) return res.status(401).json({ error: 'Unauthorized' });
  if (role !== 'buyer') return res.status(403).json({ error: 'Forbidden' });

  const parsed = listDealsSchema.pick({ status: true, page: true, limit: true }).safeParse(req.query);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid query', issues: parsed.error.issues });

  const items = await listBuyerDeals({
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

  const parsed = listDealsSchema.pick({ status: true, page: true, limit: true, agentId: true }).safeParse(req.query);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid query', issues: parsed.error.issues });

  const agentId = isAdmin(req) && parsed.data.agentId ? parsed.data.agentId : req.auth.sub;
  const items = await listAgentDeals({
    agentId,
    status: parsed.data.status ?? null,
    page: parsed.data.page,
    limit: parsed.data.limit,
  });

  return res.json({ items, page: parsed.data.page, limit: parsed.data.limit });
}

export async function list(req, res) {
  const role = roleOf(req);
  if (!role) return res.status(401).json({ error: 'Unauthorized' });

  const parsed = listDealsSchema.safeParse(req.query);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid query', issues: parsed.error.issues });

  if (role === 'admin') {
    const items = await listAdminDeals({
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
    const items = await listSellerDeals({
      sellerId: req.auth.sub,
      status: parsed.data.status ?? null,
      page: parsed.data.page,
      limit: parsed.data.limit,
    });
    return res.json({ items, page: parsed.data.page, limit: parsed.data.limit });
  }

  return res.status(403).json({ error: 'Forbidden' });
}

export async function updateStatus(req, res) {
  const parsedParams = z.object({ id: z.string().uuid() }).safeParse(req.params);
  if (!parsedParams.success) return res.status(400).json({ error: 'Invalid deal id' });

  const parsed = updateDealStatusSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid payload', issues: parsed.error.issues });

  const role = roleOf(req);
  if (!role) return res.status(401).json({ error: 'Unauthorized' });
  if (!['agent', 'admin'].includes(role)) return res.status(403).json({ error: 'Forbidden' });

  const deal = await getDealByIdMapped(parsedParams.data.id);
  if (!deal) return res.status(404).json({ error: 'Deal not found' });
  if (role === 'agent' && deal.agentId !== req.auth.sub) return res.status(403).json({ error: 'Forbidden' });

  if (isClosedStatus(deal.status)) return res.status(409).json({ error: 'Deal is closed' });

  const nextStatus = parsed.data.status;
  if (!canTransition(deal.status, nextStatus)) {
    return res.status(409).json({ error: 'Invalid status transition' });
  }

  if (nextStatus !== 'closed_won' && parsed.data.finalPrice !== undefined) {
    return res.status(400).json({ error: 'finalPrice can only be set when closing a deal as won' });
  }

  const closing = nextStatus === 'closed_won' || nextStatus === 'closed_lost';

  if (closing) {
    // Only agent/admin can close (already enforced above).
    if (nextStatus === 'closed_won') {
      const prop = await getPropertyByIdMapped(deal.propertyId);
      if (!prop) return res.status(404).json({ error: 'Property not found' });
      if (prop.status === 'sold') return res.status(409).json({ error: 'Property is already sold' });

      const finalPrice = parsed.data.finalPrice ?? deal.finalPrice ?? deal.offerPrice;
      if (!finalPrice) return res.status(400).json({ error: 'finalPrice is required to close won' });
      const fp = Number(finalPrice);
      if (!Number.isFinite(fp) || fp <= 0) return res.status(400).json({ error: 'finalPrice must be > 0' });
      if (deal.offerPrice && finalPrice < deal.offerPrice) {
        return res.status(409).json({ error: 'finalPrice must be >= offerPrice' });
      }

      const updated = await setDealStatus({
        dealId: deal.id,
        status: nextStatus,
        finalPrice: fp,
        notes: parsed.data.notes ?? null,
      });

      // Mark property sold
      await setPropertyStatus({ propertyId: deal.propertyId, status: 'sold', rejectionReason: null });

      // Automation: inquiry closed; visits completed (best-effort)
      if (deal.inquiryId) {
        await updateInquiryStatusAdminOrAgent({ inquiryId: deal.inquiryId, actorId: req.auth.sub, actorRole: role, status: 'closed' });
        await setVisitsCompletedForInquiry(deal.inquiryId);
      }

      await logDealAudit({
        dealId: deal.id,
        actorId: req.auth.sub,
        actionType: 'deal_closed_won',
        metadata: { from: deal.status, to: nextStatus, finalPrice: fp },
      });

      return res.json({ deal: updated });
    }

    if (nextStatus === 'closed_lost') {
      const updated = await setDealStatus({
        dealId: deal.id,
        status: nextStatus,
        finalPrice: null,
        clearFinalPrice: true,
        notes: parsed.data.notes ?? null,
      });
      if (deal.inquiryId) {
        await updateInquiryStatusAdminOrAgent({ inquiryId: deal.inquiryId, actorId: req.auth.sub, actorRole: role, status: 'dropped' });
      }

      await logDealAudit({
        dealId: deal.id,
        actorId: req.auth.sub,
        actionType: 'deal_closed_lost',
        metadata: { from: deal.status, to: nextStatus },
      });
      return res.json({ deal: updated });
    }
  }

  const updated = await setDealStatus({
    dealId: deal.id,
    status: nextStatus,
    finalPrice: parsed.data.finalPrice ?? null,
    notes: parsed.data.notes ?? null,
  });

  await logDealAudit({
    dealId: deal.id,
    actorId: req.auth.sub,
    actionType: 'status_changed',
    metadata: { from: deal.status, to: nextStatus },
  });
  return res.json({ deal: updated });
}

export async function updateOffer(req, res) {
  const parsedParams = z.object({ id: z.string().uuid() }).safeParse(req.params);
  if (!parsedParams.success) return res.status(400).json({ error: 'Invalid deal id' });

  const parsed = updateDealOfferSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid payload', issues: parsed.error.issues });

  const role = roleOf(req);
  if (!role) return res.status(401).json({ error: 'Unauthorized' });
  if (!['buyer', 'agent', 'admin'].includes(role)) return res.status(403).json({ error: 'Forbidden' });

  const deal = await getDealByIdMapped(parsedParams.data.id);
  if (!deal) return res.status(404).json({ error: 'Deal not found' });
  if (isClosedStatus(deal.status)) return res.status(409).json({ error: 'Deal is closed' });

  if (!isEditableOfferStatus(deal.status)) {
    return res.status(409).json({ error: 'Offer cannot be updated at this stage' });
  }

  if (role === 'buyer' && deal.buyerId !== req.auth.sub) return res.status(403).json({ error: 'Forbidden' });
  if (role === 'agent' && deal.agentId !== req.auth.sub) return res.status(403).json({ error: 'Forbidden' });

  const updated = await updateDealOffer({
    dealId: deal.id,
    offerPrice: parsed.data.offerPrice,
    message: parsed.data.message ?? null,
  });

  await logDealAudit({
    dealId: deal.id,
    actorId: req.auth.sub,
    actionType: 'offer_updated',
    metadata: { offerPrice: parsed.data.offerPrice },
  });
  return res.json({ deal: updated });
}

export async function remove(req, res) {
  const parsedParams = z.object({ id: z.string().uuid() }).safeParse(req.params);
  if (!parsedParams.success) return res.status(400).json({ error: 'Invalid deal id' });

  const role = roleOf(req);
  if (!role) return res.status(401).json({ error: 'Unauthorized' });
  if (!['buyer', 'agent', 'admin'].includes(role)) return res.status(403).json({ error: 'Forbidden' });

  const deal = await getDealByIdMapped(parsedParams.data.id);
  if (!deal) return res.status(404).json({ error: 'Deal not found' });
  if (isClosedStatus(deal.status)) return res.status(409).json({ error: 'Deal is closed' });

  if (deal.status !== 'open' && deal.status !== 'negotiation') {
    return res.status(409).json({ error: 'Deal cannot be cancelled at this stage' });
  }

  if (role === 'buyer' && deal.buyerId !== req.auth.sub) return res.status(403).json({ error: 'Forbidden' });
  if (role === 'agent' && deal.agentId !== req.auth.sub) return res.status(403).json({ error: 'Forbidden' });

  const updated = await cancelDeal({ dealId: deal.id });

  await logDealAudit({
    dealId: deal.id,
    actorId: req.auth.sub,
    actionType: 'deal_cancelled',
    metadata: { from: deal.status, to: 'cancelled' },
  });
  return res.json({ deal: updated });
}

export async function reassign(req, res) {
  const parsedParams = z.object({ id: z.string().uuid() }).safeParse(req.params);
  if (!parsedParams.success) return res.status(400).json({ error: 'Invalid deal id' });

  const role = roleOf(req);
  if (!role) return res.status(401).json({ error: 'Unauthorized' });
  if (role !== 'admin') return res.status(403).json({ error: 'Forbidden' });

  const parsed = z.object({ agentId: z.string().uuid() }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid payload', issues: parsed.error.issues });

  const deal = await getDealByIdMapped(parsedParams.data.id);
  if (!deal) return res.status(404).json({ error: 'Deal not found' });

  const updated = await reassignDealAgent({ dealId: deal.id, agentId: parsed.data.agentId });

  await logDealAudit({
    dealId: deal.id,
    actorId: req.auth.sub,
    actionType: 'agent_changed',
    metadata: { from: deal.agentId, to: parsed.data.agentId },
  });
  return res.json({ deal: updated });
}
