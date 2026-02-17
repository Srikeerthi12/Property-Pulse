import { query } from '../config/db.js';

function mapInquiryRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    propertyId: row.property_id,
    buyerId: row.buyer_id,
    agentId: row.agent_id,
    status: row.status,
    message: row.message,
    hasActiveDeal: Boolean(row.has_active_deal),
    hasCompletedVisit: Boolean(row.has_completed_visit),
    latestVisitId: row.latest_visit_id ?? null,
    latestVisitStatus: row.latest_visit_status ?? null,
    latestVisitScheduledAt: row.latest_visit_scheduled_at ?? null,
    latestVisitCompleted: Boolean(row.latest_visit_completed),
    offerPrice: row.offer_price ?? null,
    offerMessage: row.offer_message ?? null,
    offerUpdatedAt: row.offer_updated_at ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    property: row.property_title
      ? {
          id: row.property_id,
          title: row.property_title,
          location: row.property_location ?? null,
          price: row.property_price ?? null,
          status: row.property_status ?? null,
          sellerId: row.property_seller_id ?? null,
          thumbnailUrl: row.property_thumbnail_url ?? null,
        }
      : undefined,
    buyer: row.buyer_name
      ? {
          id: row.buyer_id,
          name: row.buyer_name,
          email: row.buyer_email,
        }
      : undefined,
    agent: row.agent_name
      ? {
          id: row.agent_id,
          name: row.agent_name,
          email: row.agent_email,
        }
      : row.agent_id
        ? { id: row.agent_id }
        : null,
  };
}

export async function pickLeastLoadedAgentId() {
  const result = await query(
    `SELECT u.id
     FROM users u
     LEFT JOIN property_inquiries i
       ON i.agent_id = u.id
      AND i.status NOT IN ('closed','dropped')
     WHERE u.role = 'agent'
       AND u.is_active = true
     GROUP BY u.id, u.created_at
     ORDER BY COUNT(i.id) ASC, u.created_at ASC
     LIMIT 1`,
  );
  return result.rows[0]?.id || null;
}

export async function isActiveAgentById(userId) {
  if (!userId) return false;
  const result = await query(
    `SELECT 1 FROM users WHERE id = $1 AND role = 'agent' AND is_active = true LIMIT 1`,
    [userId],
  );
  return Boolean(result.rows[0]);
}

export async function createInquiry({ propertyId, buyerId, agentId, message }) {
  const result = await query(
    `INSERT INTO property_inquiries (property_id, buyer_id, agent_id, status, message)
     VALUES ($1, $2, $3, 'new', $4)
     RETURNING id, property_id, buyer_id, agent_id, status, message, created_at, updated_at`,
    [propertyId, buyerId, agentId, message ?? null],
  );
  return mapInquiryRow(result.rows[0]);
}

export async function getInquiryById(id) {
  const result = await query(
    `SELECT id, property_id, buyer_id, agent_id, status, message, offer_price, offer_message, offer_updated_at, created_at, updated_at
     FROM property_inquiries
     WHERE id = $1
     LIMIT 1`,
    [id],
  );
  return mapInquiryRow(result.rows[0]);
}

export async function getInquiryByIdWithJoins(id) {
  const result = await query(
    `SELECT i.*, p.title AS property_title, p.location AS property_location, p.price AS property_price,
            p.status AS property_status,
            p.seller_id AS property_seller_id,
            EXISTS (
              SELECT 1
              FROM deals d
              WHERE d.inquiry_id = i.id
                AND d.status NOT IN ('closed_won','closed_lost','cancelled')
            ) AS has_active_deal,
            EXISTS (
              SELECT 1
              FROM visits v
              WHERE v.inquiry_id = i.id
                AND v.status = 'completed'
            ) AS has_completed_visit,
            lv.id AS latest_visit_id,
            lv.status AS latest_visit_status,
            lv.scheduled_at AS latest_visit_scheduled_at,
            (lv.status = 'completed') AS latest_visit_completed,
            (
              SELECT image_url
              FROM property_images img
              WHERE img.property_id = p.id
              ORDER BY img.created_at ASC
              LIMIT 1
            ) AS property_thumbnail_url,
            b.name AS buyer_name, b.email AS buyer_email,
            a.name AS agent_name, a.email AS agent_email
     FROM property_inquiries i
     JOIN properties p ON p.id = i.property_id
     JOIN users b ON b.id = i.buyer_id
     LEFT JOIN users a ON a.id = i.agent_id
     LEFT JOIN LATERAL (
       SELECT v.id, v.status, v.scheduled_at
       FROM visits v
       WHERE v.inquiry_id = i.id
       ORDER BY v.scheduled_at DESC NULLS LAST, v.created_at DESC
       LIMIT 1
     ) lv ON true
     WHERE i.id = $1
     LIMIT 1`,
    [id],
  );
  return mapInquiryRow(result.rows[0]);
}

export async function listBuyerInquiries({ buyerId, page = 1, limit = 20 }) {
  const offset = (page - 1) * limit;
  const result = await query(
    `SELECT i.*, p.title AS property_title, p.location AS property_location, p.price AS property_price,
            p.status AS property_status,
            p.seller_id AS property_seller_id,
            EXISTS (
              SELECT 1
              FROM deals d
              WHERE d.inquiry_id = i.id
                AND d.status NOT IN ('closed_won','closed_lost','cancelled')
            ) AS has_active_deal,
            EXISTS (
              SELECT 1
              FROM visits v
              WHERE v.inquiry_id = i.id
                AND v.status = 'completed'
            ) AS has_completed_visit,
            lv.id AS latest_visit_id,
            lv.status AS latest_visit_status,
            lv.scheduled_at AS latest_visit_scheduled_at,
            (lv.status = 'completed') AS latest_visit_completed,
            (
              SELECT image_url
              FROM property_images img
              WHERE img.property_id = p.id
              ORDER BY img.created_at ASC
              LIMIT 1
            ) AS property_thumbnail_url,
            a.name AS agent_name, a.email AS agent_email
     FROM property_inquiries i
     JOIN properties p ON p.id = i.property_id
     LEFT JOIN users a ON a.id = i.agent_id
     LEFT JOIN LATERAL (
       SELECT v.id, v.status, v.scheduled_at
       FROM visits v
       WHERE v.inquiry_id = i.id
       ORDER BY v.scheduled_at DESC NULLS LAST, v.created_at DESC
       LIMIT 1
     ) lv ON true
     WHERE i.buyer_id = $1
     ORDER BY i.created_at DESC
     LIMIT $2 OFFSET $3`,
    [buyerId, limit, offset],
  );
  return result.rows.map(mapInquiryRow);
}

export async function listAgentLeads({ agentId, status, q, page = 1, limit = 20 }) {
  const where = ['i.agent_id = $1'];
  const params = [agentId];
  let idx = 2;

  if (status) {
    where.push(`i.status = $${idx++}`);
    params.push(status);
  }
  if (q) {
    where.push(`(p.title ILIKE $${idx} OR b.name ILIKE $${idx} OR b.email ILIKE $${idx})`);
    params.push(`%${q}%`);
    idx += 1;
  }

  const offset = (page - 1) * limit;
  params.push(limit, offset);

  const result = await query(
    `SELECT i.*, p.title AS property_title, p.location AS property_location, p.price AS property_price,
            p.status AS property_status,
            p.seller_id AS property_seller_id,
            EXISTS (
              SELECT 1
              FROM deals d
              WHERE d.inquiry_id = i.id
                AND d.status NOT IN ('closed_won','closed_lost','cancelled')
            ) AS has_active_deal,
            EXISTS (
              SELECT 1
              FROM visits v
              WHERE v.inquiry_id = i.id
                AND v.status = 'completed'
            ) AS has_completed_visit,
            lv.id AS latest_visit_id,
            lv.status AS latest_visit_status,
            lv.scheduled_at AS latest_visit_scheduled_at,
            (lv.status = 'completed') AS latest_visit_completed,
            (
              SELECT image_url
              FROM property_images img
              WHERE img.property_id = p.id
              ORDER BY img.created_at ASC
              LIMIT 1
            ) AS property_thumbnail_url,
            b.name AS buyer_name, b.email AS buyer_email
     FROM property_inquiries i
     JOIN properties p ON p.id = i.property_id
     JOIN users b ON b.id = i.buyer_id
     LEFT JOIN LATERAL (
       SELECT v.id, v.status, v.scheduled_at
       FROM visits v
       WHERE v.inquiry_id = i.id
       ORDER BY v.scheduled_at DESC NULLS LAST, v.created_at DESC
       LIMIT 1
     ) lv ON true
     WHERE ${where.join(' AND ')}
     ORDER BY i.created_at DESC
     LIMIT $${idx++} OFFSET $${idx++}`,
    params,
  );
  return result.rows.map(mapInquiryRow);
}

export async function listAdminLeads({ status, agentId, buyerId, propertyId, q, page = 1, limit = 50 }) {
  const where = [];
  const params = [];
  let idx = 1;

  if (status) {
    where.push(`i.status = $${idx++}`);
    params.push(status);
  }
  if (agentId) {
    where.push(`i.agent_id = $${idx++}`);
    params.push(agentId);
  }
  if (buyerId) {
    where.push(`i.buyer_id = $${idx++}`);
    params.push(buyerId);
  }
  if (propertyId) {
    where.push(`i.property_id = $${idx++}`);
    params.push(propertyId);
  }
  if (q) {
    where.push(`(p.title ILIKE $${idx} OR b.name ILIKE $${idx} OR b.email ILIKE $${idx} OR a.name ILIKE $${idx})`);
    params.push(`%${q}%`);
    idx += 1;
  }

  const offset = (page - 1) * limit;
  params.push(limit, offset);

  const result = await query(
    `SELECT i.*, p.title AS property_title, p.location AS property_location, p.price AS property_price,
            p.status AS property_status,
            p.seller_id AS property_seller_id,
            EXISTS (
              SELECT 1
              FROM deals d
              WHERE d.inquiry_id = i.id
                AND d.status NOT IN ('closed_won','closed_lost','cancelled')
            ) AS has_active_deal,
            EXISTS (
              SELECT 1
              FROM visits v
              WHERE v.inquiry_id = i.id
                AND v.status = 'completed'
            ) AS has_completed_visit,
            lv.id AS latest_visit_id,
            lv.status AS latest_visit_status,
            lv.scheduled_at AS latest_visit_scheduled_at,
            (lv.status = 'completed') AS latest_visit_completed,
            (
              SELECT image_url
              FROM property_images img
              WHERE img.property_id = p.id
              ORDER BY img.created_at ASC
              LIMIT 1
            ) AS property_thumbnail_url,
            b.name AS buyer_name, b.email AS buyer_email,
            a.name AS agent_name, a.email AS agent_email
     FROM property_inquiries i
     JOIN properties p ON p.id = i.property_id
     JOIN users b ON b.id = i.buyer_id
     LEFT JOIN users a ON a.id = i.agent_id
     LEFT JOIN LATERAL (
       SELECT v.id, v.status, v.scheduled_at
       FROM visits v
       WHERE v.inquiry_id = i.id
       ORDER BY v.scheduled_at DESC NULLS LAST, v.created_at DESC
       LIMIT 1
     ) lv ON true
     ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
     ORDER BY i.created_at DESC
     LIMIT $${idx++} OFFSET $${idx++}`,
    params,
  );
  return result.rows.map(mapInquiryRow);
}

export async function updateInquiryStatus({ inquiryId, agentId, status }) {
  const result = await query(
    `UPDATE property_inquiries
     SET status = $3
     WHERE id = $1 AND agent_id = $2
     RETURNING id, property_id, buyer_id, agent_id, status, message, offer_price, offer_message, offer_updated_at, created_at, updated_at`,
    [inquiryId, agentId, status],
  );
  return mapInquiryRow(result.rows[0]);
}

export async function updateInquiryStatusAdminOrAgent({ inquiryId, actorId, actorRole, status }) {
  const role = String(actorRole || '').toLowerCase();
  if (role === 'admin') {
    const res = await query(
      `UPDATE property_inquiries
       SET status = $2
       WHERE id = $1
       RETURNING id, property_id, buyer_id, agent_id, status, message, offer_price, offer_message, offer_updated_at, created_at, updated_at`,
      [inquiryId, status],
    );
    return mapInquiryRow(res.rows[0]);
  }

  const res = await query(
    `UPDATE property_inquiries
     SET status = $3
     WHERE id = $1 AND agent_id = $2
     RETURNING id, property_id, buyer_id, agent_id, status, message, offer_price, offer_message, offer_updated_at, created_at, updated_at`,
    [inquiryId, actorId, status],
  );
  return mapInquiryRow(res.rows[0]);
}

export async function updateInquiryOfferByBuyer({ inquiryId, buyerId, offerPrice, offerMessage = null }) {
  const res = await query(
    `UPDATE property_inquiries
     SET offer_price = $3,
         offer_message = $4,
         offer_updated_at = now()
     WHERE id = $1 AND buyer_id = $2
     RETURNING id, property_id, buyer_id, agent_id, status, message, offer_price, offer_message, offer_updated_at, created_at, updated_at`,
    [inquiryId, buyerId, offerPrice, offerMessage],
  );
  return mapInquiryRow(res.rows[0]);
}

export async function reassignInquiry({ inquiryId, agentId }) {
  const result = await query(
    `UPDATE property_inquiries
     SET agent_id = $2
     WHERE id = $1
     RETURNING id, property_id, buyer_id, agent_id, status, message, created_at, updated_at`,
    [inquiryId, agentId],
  );

  // Keep any ACTIVE deal aligned with the inquiry's assigned agent.
  await query(
    `UPDATE deals
     SET agent_id = $2
     WHERE inquiry_id = $1
       AND status NOT IN ('closed_won','closed_lost','cancelled')`,
    [inquiryId, agentId],
  );

  return mapInquiryRow(result.rows[0]);
}

export async function addInquiryNote({ inquiryId, agentId, note }) {
  const result = await query(
    `INSERT INTO inquiry_notes (inquiry_id, agent_id, note)
     VALUES ($1, $2, $3)
     RETURNING id, inquiry_id AS "inquiryId", agent_id AS "agentId", note, created_at AS "createdAt"`,
    [inquiryId, agentId, note],
  );
  return result.rows[0];
}

export async function listInquiryNotes(inquiryId) {
  const result = await query(
    `SELECT n.id, n.inquiry_id AS "inquiryId", n.agent_id AS "agentId", n.note, n.created_at AS "createdAt",
            a.name AS "agentName"
     FROM inquiry_notes n
     LEFT JOIN users a ON a.id = n.agent_id
     WHERE n.inquiry_id = $1
     ORDER BY n.created_at DESC`,
    [inquiryId],
  );
  return result.rows;
}

export async function listSellerPropertyLeadSummary(sellerId) {
  const result = await query(
    `SELECT p.id AS "propertyId",
            p.title AS "title",
            p.status AS "propertyStatus",
            COUNT(i.id)::int AS "totalInquiries",
            SUM(CASE WHEN i.status = 'new' THEN 1 ELSE 0 END)::int AS "new",
            SUM(CASE WHEN i.status = 'contacted' THEN 1 ELSE 0 END)::int AS "contacted",
            SUM(CASE WHEN i.status = 'visit_scheduled' THEN 1 ELSE 0 END)::int AS "visitScheduled",
            SUM(CASE WHEN i.status = 'negotiation' THEN 1 ELSE 0 END)::int AS "negotiation",
            SUM(CASE WHEN i.status = 'closed' THEN 1 ELSE 0 END)::int AS "closed",
            SUM(CASE WHEN i.status = 'dropped' THEN 1 ELSE 0 END)::int AS "dropped"
     FROM properties p
     LEFT JOIN property_inquiries i ON i.property_id = p.id
     WHERE p.seller_id = $1
     GROUP BY p.id
     ORDER BY p.created_at DESC`,
    [sellerId],
  );
  return result.rows;
}

export async function getSellerPropertyLeadDetail({ sellerId, propertyId }) {
  const summary = await query(
    `SELECT p.id AS "propertyId",
            p.title AS "title",
            COUNT(i.id)::int AS "totalInquiries",
            SUM(CASE WHEN i.status = 'new' THEN 1 ELSE 0 END)::int AS "new",
            SUM(CASE WHEN i.status = 'contacted' THEN 1 ELSE 0 END)::int AS "contacted",
            SUM(CASE WHEN i.status = 'visit_scheduled' THEN 1 ELSE 0 END)::int AS "visitScheduled",
            SUM(CASE WHEN i.status = 'negotiation' THEN 1 ELSE 0 END)::int AS "negotiation",
            SUM(CASE WHEN i.status = 'closed' THEN 1 ELSE 0 END)::int AS "closed",
            SUM(CASE WHEN i.status = 'dropped' THEN 1 ELSE 0 END)::int AS "dropped"
     FROM properties p
     LEFT JOIN property_inquiries i ON i.property_id = p.id
     WHERE p.seller_id = $1 AND p.id = $2
     GROUP BY p.id
     LIMIT 1`,
    [sellerId, propertyId],
  );

  const agentPerf = await query(
    `SELECT i.agent_id AS "agentId",
            u.name AS "agentName",
            COUNT(i.id)::int AS "total",
            SUM(CASE WHEN i.status = 'closed' THEN 1 ELSE 0 END)::int AS "closed",
            SUM(CASE WHEN i.status = 'dropped' THEN 1 ELSE 0 END)::int AS "dropped"
     FROM property_inquiries i
     LEFT JOIN users u ON u.id = i.agent_id
     JOIN properties p ON p.id = i.property_id
     WHERE p.seller_id = $1 AND i.property_id = $2
     GROUP BY i.agent_id, u.name
     ORDER BY "total" DESC`,
    [sellerId, propertyId],
  );

  return {
    summary: summary.rows[0] || null,
    agentPerformance: agentPerf.rows,
  };
}
