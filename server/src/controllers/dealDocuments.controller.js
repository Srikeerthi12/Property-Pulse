import fs from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';

import { getUploadsRoot, isWithinUploadsRoot, toPublicUploadUrl } from '../config/uploads.js';
import { getDealByIdMapped } from '../models/deal.model.js';
import {
  createDealDocument,
  deleteDealDocument,
  getDealDocumentById,
  listDealDocuments,
} from '../models/dealDocument.model.js';

function roleOf(req) {
  return req.auth?.role ? String(req.auth.role).toLowerCase() : null;
}

function canModifyDocuments(dealStatus) {
  // Strict rule: documents allowed only when status >= negotiation,
  // and read-only after closed/cancelled.
  return dealStatus === 'negotiation' || dealStatus === 'agreement_pending';
}

function parseDocType(value) {
  const parsed = z
    .object({ docType: z.enum(['id_proof', 'agreement', 'payment_proof', 'invoice']).optional().nullable() })
    .safeParse({ docType: value === '' ? null : value });
  return parsed.success ? parsed.data.docType ?? null : null;
}

function isParticipant(deal, userId) {
  if (!deal || !userId) return false;
  if (deal.buyerId && deal.buyerId === userId) return true;
  if (deal.agentId && deal.agentId === userId) return true;
  const sellerId = deal?.property?.sellerId;
  if (sellerId && sellerId === userId) return true;
  return false;
}

function publicUploadUrlToAbsPath(url) {
  if (!url || typeof url !== 'string') return null;
  if (!url.startsWith('/uploads/')) return null;
  const rel = url.slice('/uploads/'.length);
  const abs = path.join(getUploadsRoot(), rel);
  return abs;
}

export async function list(req, res) {
  const parsedParams = z.object({ id: z.string().uuid() }).safeParse(req.params);
  if (!parsedParams.success) return res.status(400).json({ error: 'Invalid deal id' });

  const role = roleOf(req);
  if (!role) return res.status(401).json({ error: 'Unauthorized' });

  const deal = await getDealByIdMapped(parsedParams.data.id);
  if (!deal) return res.status(404).json({ error: 'Deal not found' });

  if (role !== 'admin' && !isParticipant(deal, req.auth.sub)) return res.status(403).json({ error: 'Forbidden' });

  const items = await listDealDocuments(deal.id);
  return res.json({ items });
}

export async function upload(req, res) {
  const parsedParams = z.object({ id: z.string().uuid() }).safeParse(req.params);
  if (!parsedParams.success) return res.status(400).json({ error: 'Invalid deal id' });

  const role = roleOf(req);
  if (!role) return res.status(401).json({ error: 'Unauthorized' });

  const deal = await getDealByIdMapped(parsedParams.data.id);
  if (!deal) return res.status(404).json({ error: 'Deal not found' });

  if (role !== 'admin' && !isParticipant(deal, req.auth.sub)) return res.status(403).json({ error: 'Forbidden' });

  if (!canModifyDocuments(String(deal.status))) {
    return res.status(409).json({ error: 'Documents can only be modified during negotiation/agreement stage' });
  }

  const docType = parseDocType(req.body?.docType);

  const files = Array.isArray(req.files) ? req.files : [];
  if (files.length === 0) return res.status(400).json({ error: 'No files uploaded' });

  const created = [];
  for (const f of files) {
    const filename = f.originalname || f.filename || 'document';
    const absPath = f.path;
    const url = absPath ? toPublicUploadUrl(absPath) : null;
    if (!url) continue;

    const doc = await createDealDocument({
      dealId: deal.id,
      uploadedBy: req.auth.sub,
      docType,
      filename,
      url,
    });
    if (doc) created.push(doc);
  }

  return res.status(201).json({ items: created });
}

export async function remove(req, res) {
  const parsedParams = z
    .object({ id: z.string().uuid(), docId: z.string().uuid() })
    .safeParse({ id: req.params?.id, docId: req.params?.docId });
  if (!parsedParams.success) return res.status(400).json({ error: 'Invalid request' });

  const role = roleOf(req);
  if (!role) return res.status(401).json({ error: 'Unauthorized' });

  const deal = await getDealByIdMapped(parsedParams.data.id);
  if (!deal) return res.status(404).json({ error: 'Deal not found' });

  if (role !== 'admin' && !isParticipant(deal, req.auth.sub)) return res.status(403).json({ error: 'Forbidden' });

  if (!canModifyDocuments(String(deal.status))) {
    return res.status(409).json({ error: 'Documents are read-only for this deal status' });
  }

  const doc = await getDealDocumentById({ dealId: deal.id, documentId: parsedParams.data.docId });
  if (!doc) return res.status(404).json({ error: 'Document not found' });

  if (role !== 'admin' && doc.uploaded_by && doc.uploaded_by !== req.auth.sub) {
    return res.status(403).json({ error: 'Only the uploader or admin can delete this document' });
  }

  const deleted = await deleteDealDocument({ dealId: deal.id, documentId: doc.id });

  // Best-effort file deletion.
  const abs = publicUploadUrlToAbsPath(doc.url);
  if (abs && isWithinUploadsRoot(abs)) {
    try {
      await fs.unlink(abs);
    } catch {
      // ignore
    }
  }

  return res.json({ document: deleted });
}
