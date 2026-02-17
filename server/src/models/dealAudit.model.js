import { query } from '../config/db.js';

export async function logDealAudit({ dealId, actorId, actionType, metadata = null }) {
  if (!dealId || !actionType) return null;
  const res = await query(
    `INSERT INTO deal_audit_logs (deal_id, actor_id, action_type, metadata)
     VALUES ($1, $2, $3, $4)
     RETURNING id, deal_id, actor_id, action_type, metadata, created_at`,
    [dealId, actorId ?? null, actionType, metadata ? JSON.stringify(metadata) : null],
  );
  return res.rows[0] || null;
}

export async function listDealAudit(dealId, { limit = 50 } = {}) {
  const res = await query(
    `SELECT id, deal_id, actor_id, action_type, metadata, created_at
     FROM deal_audit_logs
     WHERE deal_id = $1
     ORDER BY created_at DESC
     LIMIT $2`,
    [dealId, limit],
  );
  return res.rows;
}
