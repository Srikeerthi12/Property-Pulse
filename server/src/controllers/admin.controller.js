import { z } from 'zod';
import fs from 'node:fs/promises';
import path from 'node:path';

import { deleteUserById, getUserStats, listUsers, setUserActiveById } from '../models/user.model.js';
import { getPropertyByIdMapped, listAdminProperties, listPendingProperties, setPropertyStatus } from '../models/property.model.js';
import { listPropertyImages } from '../models/propertyImage.model.js';
import { listPropertyLogs, logPropertyAction } from '../models/propertyLog.model.js';
import { deleteAllImagesForProperty } from '../models/propertyImage.model.js';
import { getUploadsRoot, isWithinUploadsRoot } from '../config/uploads.js';
import { listAdminLeads, reassignInquiry } from '../models/inquiry.model.js';
import { assignLeadSchema, listAdminLeadsSchema } from '../utils/inquiry.validators.js';
import { query } from '../config/db.js';

export async function status(_req, res) {
  return res.json({ ok: true });
}

export async function stats(_req, res) {
  const stats = await getUserStats();
  return res.json({ stats });
}

export async function users(_req, res) {
  const users = await listUsers();
  return res.json({ users });
}

export async function setActive(req, res) {
  const parsedParams = z.object({ id: z.string().uuid() }).safeParse(req.params);
  if (!parsedParams.success) return res.status(400).json({ error: 'Invalid user id' });

  const parsedBody = z.object({ isActive: z.boolean() }).safeParse(req.body);
  if (!parsedBody.success) return res.status(400).json({ error: 'Invalid payload', issues: parsedBody.error.issues });

  const updated = await setUserActiveById(parsedParams.data.id, parsedBody.data.isActive);
  if (!updated) return res.status(404).json({ error: 'User not found' });

  return res.json({ user: updated });
}

export async function remove(req, res) {
  const parsedParams = z.object({ id: z.string().uuid() }).safeParse(req.params);
  if (!parsedParams.success) return res.status(400).json({ error: 'Invalid user id' });

  const deleted = await deleteUserById(parsedParams.data.id);
  if (!deleted) return res.status(404).json({ error: 'User not found' });

  return res.json({ ok: true });
}

export async function pendingProperties(_req, res) {
  const parsed = z
    .object({
      sellerId: z.string().uuid().optional(),
      page: z.coerce.number().int().min(1).optional(),
      limit: z.coerce.number().int().min(1).max(50).optional(),
    })
    .safeParse(_req.query);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid query', issues: parsed.error.issues });

  const items = await listPendingProperties({
    sellerId: parsed.data.sellerId,
    page: parsed.data.page ?? 1,
    limit: parsed.data.limit ?? 20,
  });
  const withImages = await Promise.all(
    items.map(async (p) => {
      const images = await listPropertyImages(p.id);
      return { ...p, images };
    }),
  );
  return res.json({ items: withImages });
}

export async function properties(req, res) {
  const parsed = z
    .object({
      status: z.enum(['draft', 'pending', 'approved', 'rejected', 'sold', 'inactive']).optional(),
      sellerId: z.string().uuid().optional(),
      q: z.string().trim().max(200).optional(),
      sort: z.enum(['newest', 'price_asc', 'price_desc']).optional(),
      page: z.coerce.number().int().min(1).default(1),
      limit: z.coerce.number().int().min(1).max(50).default(20),
    })
    .safeParse(req.query);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid query', issues: parsed.error.issues });

  const items = await listAdminProperties(parsed.data);
  return res.json({ items, page: parsed.data.page, limit: parsed.data.limit });
}

function uploadUrlToAbsPath(uploadUrl) {
  if (!uploadUrl || typeof uploadUrl !== 'string') return null;
  const root = getUploadsRoot();
  const rel = uploadUrl.replace(/^\/uploads\//, '');
  return path.join(root, ...rel.split('/'));
}

export async function removeProperty(req, res) {
  const parsedParams = z.object({ id: z.string().uuid() }).safeParse(req.params);
  if (!parsedParams.success) return res.status(400).json({ error: 'Invalid property id' });

  const property = await getPropertyByIdMapped(parsedParams.data.id);
  if (!property) return res.status(404).json({ error: 'Property not found' });

  const updated = await setPropertyStatus({ propertyId: property.id, status: 'inactive', rejectionReason: null });

  const removed = await deleteAllImagesForProperty(property.id);
  for (const row of removed) {
    const abs = uploadUrlToAbsPath(row.imageUrl);
    if (abs && isWithinUploadsRoot(abs)) {
      try {
        await fs.unlink(abs);
      } catch {
        // ignore
      }
    }
  }

  await logPropertyAction({
    propertyId: property.id,
    actionType: 'PROPERTY_REMOVED_BY_ADMIN',
    performedBy: req.auth?.sub || null,
  });

  return res.json({ property: updated });
}

export async function approveProperty(req, res) {
  const parsedParams = z.object({ id: z.string().uuid() }).safeParse(req.params);
  if (!parsedParams.success) return res.status(400).json({ error: 'Invalid property id' });

  const property = await getPropertyByIdMapped(parsedParams.data.id);
  if (!property) return res.status(404).json({ error: 'Property not found' });
  if (property.status !== 'pending') return res.status(409).json({ error: 'Only pending properties can be approved' });

  const updated = await setPropertyStatus({ propertyId: property.id, status: 'approved', rejectionReason: null });
  await logPropertyAction({
    propertyId: property.id,
    actionType: 'PROPERTY_APPROVED',
    performedBy: req.auth?.sub || null,
    metadata: { from: 'pending', to: 'approved' },
  });

  const images = await listPropertyImages(property.id);
  return res.json({ property: { ...updated, images } });
}

export async function rejectProperty(req, res) {
  const parsedParams = z.object({ id: z.string().uuid() }).safeParse(req.params);
  if (!parsedParams.success) return res.status(400).json({ error: 'Invalid property id' });

  const parsedBody = z.object({ reason: z.string().min(3).max(500) }).safeParse(req.body);
  if (!parsedBody.success) return res.status(400).json({ error: 'Invalid payload', issues: parsedBody.error.issues });

  const property = await getPropertyByIdMapped(parsedParams.data.id);
  if (!property) return res.status(404).json({ error: 'Property not found' });
  if (property.status !== 'pending') return res.status(409).json({ error: 'Only pending properties can be rejected' });

  const updated = await setPropertyStatus({
    propertyId: property.id,
    status: 'rejected',
    rejectionReason: parsedBody.data.reason,
  });
  await logPropertyAction({
    propertyId: property.id,
    actionType: 'PROPERTY_REJECTED',
    performedBy: req.auth?.sub || null,
    metadata: { from: 'pending', to: 'rejected', reason: parsedBody.data.reason },
  });

  const images = await listPropertyImages(property.id);
  return res.json({ property: { ...updated, images } });
}

export async function propertyLogs(req, res) {
  const parsedParams = z.object({ id: z.string().uuid() }).safeParse(req.params);
  if (!parsedParams.success) return res.status(400).json({ error: 'Invalid property id' });

  const property = await getPropertyByIdMapped(parsedParams.data.id);
  if (!property) return res.status(404).json({ error: 'Property not found' });

  const items = await listPropertyLogs(property.id);
  return res.json({ logs: items });
}

export async function leads(req, res) {
  const parsed = listAdminLeadsSchema.safeParse(req.query);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid query', issues: parsed.error.issues });

  const items = await listAdminLeads({
    status: parsed.data.status,
    agentId: parsed.data.agentId,
    buyerId: parsed.data.buyerId,
    propertyId: parsed.data.propertyId,
    q: parsed.data.q,
    page: parsed.data.page,
    limit: parsed.data.limit,
  });

  return res.json({ items, page: parsed.data.page, limit: parsed.data.limit });
}

async function assertAgentIdOk(agentId) {
  if (agentId === null) return true;
  const result = await query(
    `SELECT 1 FROM users WHERE id = $1 AND role = 'agent' AND is_active = true LIMIT 1`,
    [agentId],
  );
  return Boolean(result.rows[0]);
}

export async function assignLead(req, res) {
  const parsedParams = z.object({ id: z.string().uuid() }).safeParse(req.params);
  if (!parsedParams.success) return res.status(400).json({ error: 'Invalid lead id' });

  const parsedBody = assignLeadSchema.safeParse(req.body);
  if (!parsedBody.success) return res.status(400).json({ error: 'Invalid payload', issues: parsedBody.error.issues });

  const ok = await assertAgentIdOk(parsedBody.data.agentId);
  if (!ok) return res.status(400).json({ error: 'Invalid agentId' });

  const updated = await reassignInquiry({ inquiryId: parsedParams.data.id, agentId: parsedBody.data.agentId });
  if (!updated) return res.status(404).json({ error: 'Lead not found' });

  return res.json({ inquiry: updated });
}
