import { query } from '../config/db.js';

export async function listDealDocuments(dealId) {
  const res = await query(
    `SELECT id, deal_id, uploaded_by, doc_type, filename, url, created_at
     FROM deal_documents
     WHERE deal_id = $1
     ORDER BY created_at DESC`,
    [dealId],
  );
  return res.rows;
}

export async function createDealDocument({ dealId, uploadedBy, docType = null, filename, url }) {
  const res = await query(
    `INSERT INTO deal_documents (deal_id, uploaded_by, doc_type, filename, url)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, deal_id, uploaded_by, doc_type, filename, url, created_at`,
    [dealId, uploadedBy ?? null, docType ?? null, filename, url],
  );
  return res.rows[0] || null;
}

export async function getDealDocumentById({ dealId, documentId }) {
  const res = await query(
    `SELECT id, deal_id, uploaded_by, doc_type, filename, url, created_at
     FROM deal_documents
     WHERE id = $1 AND deal_id = $2
     LIMIT 1`,
    [documentId, dealId],
  );
  return res.rows[0] || null;
}

export async function deleteDealDocument({ dealId, documentId }) {
  const res = await query(
    `DELETE FROM deal_documents
     WHERE id = $1 AND deal_id = $2
     RETURNING id, deal_id, uploaded_by, doc_type, filename, url, created_at`,
    [documentId, dealId],
  );
  return res.rows[0] || null;
}
