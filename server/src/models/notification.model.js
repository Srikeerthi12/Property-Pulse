import { query } from '../config/db.js';

export async function createNotification({ userId, type, payload = {} }) {
  if (!userId) return null;
  if (!type) return null;
  const res = await query(
    `INSERT INTO notifications (user_id, type, payload)
     VALUES ($1, $2, $3::jsonb)
     RETURNING *`,
    [userId, type, JSON.stringify(payload ?? {})],
  );
  return res.rows[0] || null;
}

export async function listNotifications(userId) {
  const result = await query('SELECT * FROM notifications WHERE user_id = $1 ORDER BY created_at DESC', [userId]);
  return result.rows;
}

export async function createNotification({ userId, type, payload = {} }) {
  if (!userId || !type) return null;
  const res = await query(
    `INSERT INTO notifications (user_id, type, payload)
     VALUES ($1, $2, $3::jsonb)
     RETURNING *`,
    [userId, String(type), JSON.stringify(payload ?? {})],
  );
  return res.rows[0] || null;
}
