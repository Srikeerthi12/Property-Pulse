import { listAgentLeads } from '../models/inquiry.model.js';
import { listAgentLeadsSchema } from '../utils/inquiry.validators.js';

export async function status(_req, res) {
  return res.json({ ok: true });
}

export async function leads(req, res) {
  const parsed = listAgentLeadsSchema.safeParse(req.query);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid query', issues: parsed.error.issues });

  const agentId = req.auth?.sub;
  if (!agentId) return res.status(401).json({ error: 'Unauthorized' });

  const items = await listAgentLeads({
    agentId,
    status: parsed.data.status,
    q: parsed.data.q,
    page: parsed.data.page,
    limit: parsed.data.limit,
  });

  return res.json({ items, page: parsed.data.page, limit: parsed.data.limit });
}
