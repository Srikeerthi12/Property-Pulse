import { query } from '../config/db.js';

export async function logPropertyAction({ propertyId, actionType, performedBy, metadata = {} }) {
  await query(
    `INSERT INTO property_logs (property_id, action_type, performed_by, metadata)
     VALUES ($1, $2, $3, $4)`,
    [propertyId, actionType, performedBy || null, metadata],
  );
}

export async function listPropertyLogs(propertyId) {
  const result = await query(
    `SELECT id, property_id AS "propertyId", action_type AS "actionType", performed_by AS "performedBy",
            metadata, created_at AS "createdAt"
     FROM property_logs
     WHERE property_id = $1
     ORDER BY created_at DESC`,
    [propertyId],
  );
  return result.rows;
}
