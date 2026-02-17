import { query } from '../config/db.js';

export async function listDealNotes(dealId) {
  const res = await query(
    `SELECT n.id, n.deal_id, n.author_id, u.name AS author_name, u.email AS author_email, n.content, n.created_at
     FROM deal_notes n
     LEFT JOIN users u ON u.id = n.author_id
     WHERE n.deal_id = $1
     ORDER BY n.created_at DESC`,
    [dealId],
  );
  return res.rows.map((r) => ({
    id: r.id,
    dealId: r.deal_id,
    authorId: r.author_id,
    author: r.author_id ? { id: r.author_id, name: r.author_name, email: r.author_email } : null,
    content: r.content,
    createdAt: r.created_at,
  }));
}

export async function addDealNote({ dealId, authorId, content }) {
  const res = await query(
    `INSERT INTO deal_notes (deal_id, author_id, content)
     VALUES ($1, $2, $3)
     RETURNING id, deal_id, author_id, content, created_at`,
    [dealId, authorId ?? null, content],
  );
  const row = res.rows[0];
  if (!row) return null;
  return {
    id: row.id,
    dealId: row.deal_id,
    authorId: row.author_id,
    content: row.content,
    createdAt: row.created_at,
  };
}
