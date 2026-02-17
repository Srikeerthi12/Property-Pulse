import { z } from 'zod';

import { getSellerPropertyLeadDetail, listSellerPropertyLeadSummary } from '../models/inquiry.model.js';

export async function propertyLeads(req, res) {
  const sellerId = req.auth?.sub;
  if (!sellerId) return res.status(401).json({ error: 'Unauthorized' });

  const items = await listSellerPropertyLeadSummary(sellerId);
  return res.json({ items });
}

export async function propertyLeadDetail(req, res) {
  const sellerId = req.auth?.sub;
  if (!sellerId) return res.status(401).json({ error: 'Unauthorized' });

  const parsedParams = z.object({ propertyId: z.string().uuid() }).safeParse(req.params);
  if (!parsedParams.success) return res.status(400).json({ error: 'Invalid property id' });

  const data = await getSellerPropertyLeadDetail({ sellerId, propertyId: parsedParams.data.propertyId });
  if (!data.summary) return res.status(404).json({ error: 'Property not found' });

  const total = Number(data.summary.totalInquiries || 0);
  const closed = Number(data.summary.closed || 0);
  const conversionRate = total > 0 ? closed / total : 0;

  return res.json({
    property: data.summary,
    agentPerformance: data.agentPerformance,
    conversionRate,
  });
}
