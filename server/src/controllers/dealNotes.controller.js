import { z } from 'zod';

import { getDealByIdMapped } from '../models/deal.model.js';
import { addDealNote, listDealNotes } from '../models/dealNote.model.js';

function roleOf(req) {
  return req.auth?.role ? String(req.auth.role).toLowerCase() : null;
}

function isClosed(status) {
  return ['closed_won', 'closed_lost', 'cancelled'].includes(status);
}

function isParticipant(deal, userId) {
  if (!deal || !userId) return false;
  if (deal.buyerId && deal.buyerId === userId) return true;
  if (deal.agentId && deal.agentId === userId) return true;
  const sellerId = deal?.property?.sellerId;
  if (sellerId && sellerId === userId) return true;
  return false;
}

const addSchema = z.object({ content: z.string().trim().min(1).max(2000) });

export async function list(req, res) {
  const parsedParams = z.object({ id: z.string().uuid() }).safeParse(req.params);
  if (!parsedParams.success) return res.status(400).json({ error: 'Invalid deal id' });

  const role = roleOf(req);
  if (!role) return res.status(401).json({ error: 'Unauthorized' });

  const deal = await getDealByIdMapped(parsedParams.data.id);
  if (!deal) return res.status(404).json({ error: 'Deal not found' });

  if (role !== 'admin' && !isParticipant(deal, req.auth.sub)) return res.status(403).json({ error: 'Forbidden' });

  const items = await listDealNotes(deal.id);
  return res.json({ items });
}

export async function add(req, res) {
  const parsedParams = z.object({ id: z.string().uuid() }).safeParse(req.params);
  if (!parsedParams.success) return res.status(400).json({ error: 'Invalid deal id' });

  const parsed = addSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid payload', issues: parsed.error.issues });

  const role = roleOf(req);
  if (!role) return res.status(401).json({ error: 'Unauthorized' });

  const deal = await getDealByIdMapped(parsedParams.data.id);
  if (!deal) return res.status(404).json({ error: 'Deal not found' });

  if (role !== 'admin' && !isParticipant(deal, req.auth.sub)) return res.status(403).json({ error: 'Forbidden' });

  if (isClosed(deal.status) && role !== 'admin') {
    return res.status(409).json({ error: 'Cannot add notes to a closed deal' });
  }

  const note = await addDealNote({ dealId: deal.id, authorId: req.auth.sub, content: parsed.data.content });
  return res.status(201).json({ note });
}
