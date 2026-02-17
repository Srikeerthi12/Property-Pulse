import { pool, query } from '../config/db.js';

function toNumberOrNull(value) {
  if (value === null || value === undefined) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function mapDealRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    inquiryId: row.inquiry_id,
    propertyId: row.property_id,
    buyerId: row.buyer_id,
    agentId: row.agent_id,
    offerPrice: toNumberOrNull(row.offer_price),
    finalPrice: toNumberOrNull(row.final_price),
    status: row.status,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    property: row.property_id
      ? {
          id: row.property_id,
          title: row.property_title,
          location: row.property_location,
          price: toNumberOrNull(row.property_price),
          status: row.property_status,
          thumbnailUrl: row.property_thumbnail_url,
          sellerId: row.property_seller_id,
        }
      : null,
    buyer: row.buyer_id
      ? {
          id: row.buyer_id,
          name: row.buyer_name,
          email: row.buyer_email,
        }
      : null,
    agent: row.agent_id
      ? {
          id: row.agent_id,
          name: row.agent_name,
          email: row.agent_email,
        }
      : null,
    inquiry: row.inquiry_id
      ? {
          id: row.inquiry_id,
          status: row.inquiry_status,
          message: row.inquiry_message,
          createdAt: row.inquiry_created_at,
        }
      : null,
  };
}

async function getDealByIdRaw(id) {
  const res = await query(
    `SELECT d.*,
            p.title AS property_title, p.location AS property_location, p.price AS property_price, p.status AS property_status,
            p.seller_id AS property_seller_id,
            (
              SELECT image_url
              FROM property_images img
              WHERE img.property_id = p.id
              ORDER BY img.created_at ASC
              LIMIT 1
            ) AS property_thumbnail_url,
            b.name AS buyer_name, b.email AS buyer_email,
            a.name AS agent_name, a.email AS agent_email,
            i.status AS inquiry_status, i.message AS inquiry_message, i.created_at AS inquiry_created_at
     FROM deals d
     JOIN properties p ON p.id = d.property_id
     LEFT JOIN users b ON b.id = d.buyer_id
     LEFT JOIN users a ON a.id = d.agent_id
     LEFT JOIN property_inquiries i ON i.id = d.inquiry_id
     WHERE d.id = $1
     LIMIT 1`,
    [id],
  );
  return res.rows[0] || null;
}

export async function getDealByIdMapped(id) {
  const row = await getDealByIdRaw(id);
  return mapDealRow(row);
}

async function findActiveDealIdByInquiryId(inquiryId, client = null) {
  const q = client ? client.query.bind(client) : query;
  const res = await q(
    `SELECT id
     FROM deals
     WHERE inquiry_id = $1
       AND status NOT IN ('closed_won','closed_lost','cancelled')
     ORDER BY created_at DESC
     LIMIT 1`,
    [inquiryId],
  );
  return res.rows[0]?.id || null;
}

export async function getDealByInquiryIdMapped(inquiryId) {
  const dealId = await findActiveDealIdByInquiryId(inquiryId);
  if (!dealId) return null;
  return getDealByIdMapped(dealId);
}

export async function createDealFromInquiry({
  inquiryId,
  offerPrice,
  message = null,
  actorRole = null,
  actorId = null,
  adminOverride = false,
  overrideReason = null,
}) {
  if (!inquiryId) return { deal: null, reason: 'inquiry_not_found' };
  const role = actorRole ? String(actorRole).toLowerCase() : null;
  const isAdmin = role === 'admin';
  const allowOverride = isAdmin && adminOverride;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Lock the inquiry row to avoid race conditions (two agents creating simultaneously).
    const inquiryRes = await client.query(
      `SELECT i.id, i.property_id, i.buyer_id, i.agent_id, i.status AS inquiry_status,
              p.seller_id AS seller_id, p.status AS property_status
       FROM property_inquiries i
       JOIN properties p ON p.id = i.property_id
       WHERE i.id = $1
       FOR UPDATE OF i, p
       LIMIT 1`,
      [inquiryId],
    );
    const inquiry = inquiryRes.rows[0];
    if (!inquiry) {
      await client.query('ROLLBACK');
      return { deal: null, reason: 'inquiry_not_found' };
    }

    // Permissions (defense-in-depth)
    if (role === 'agent') {
      if (!inquiry.agent_id) {
        await client.query('ROLLBACK');
        return { deal: null, reason: 'no_assigned_agent' };
      }
      if (String(inquiry.agent_id) !== String(actorId)) {
        await client.query('ROLLBACK');
        return { deal: null, reason: 'forbidden' };
      }
    }

    const leadStatus = String(inquiry.inquiry_status || '').toLowerCase();
    if (leadStatus === 'closed' || leadStatus === 'dropped') {
      await client.query('ROLLBACK');
      return { deal: null, reason: 'lead_closed_or_dropped' };
    }
    if (!['visit_scheduled', 'negotiation'].includes(leadStatus)) {
      await client.query('ROLLBACK');
      return { deal: null, reason: 'lead_invalid_status' };
    }

    if (String(inquiry.property_status) === 'sold') {
      await client.query('ROLLBACK');
      return { deal: null, reason: 'property_sold' };
    }
    if (String(inquiry.property_status) === 'inactive' && !allowOverride) {
      await client.query('ROLLBACK');
      return { deal: null, reason: 'property_inactive' };
    }

    const latestVisitRes = await client.query(
      `SELECT id, status, scheduled_at, property_id
       FROM visits
       WHERE inquiry_id = $1
       ORDER BY scheduled_at DESC NULLS LAST, created_at DESC
       LIMIT 1
       FOR UPDATE`,
      [inquiryId],
    );
    const latestVisit = latestVisitRes.rows[0] || null;

    if (!allowOverride) {
      if (!latestVisit) {
        await client.query('ROLLBACK');
        return { deal: null, reason: 'visit_required' };
      }
      if (latestVisit.property_id && String(latestVisit.property_id) !== String(inquiry.property_id)) {
        await client.query('ROLLBACK');
        return {
          deal: null,
          reason: 'visit_mismatch',
          meta: { latestVisitId: latestVisit.id, latestVisitPropertyId: latestVisit.property_id, inquiryPropertyId: inquiry.property_id },
        };
      }
      const latestStatus = String(latestVisit.status || '').toLowerCase();
      if (latestStatus !== 'completed') {
        await client.query('ROLLBACK');
        return {
          deal: null,
          reason: 'latest_visit_not_completed',
          meta: { latestVisitId: latestVisit.id, latestVisitStatus: latestVisit.status },
        };
      }
      if (latestVisit.scheduled_at) {
        const when = new Date(latestVisit.scheduled_at);
        if (!Number.isNaN(when.getTime()) && when.getTime() > Date.now()) {
          await client.query('ROLLBACK');
          return {
            deal: null,
            reason: 'visit_completed_in_future',
            meta: { latestVisitId: latestVisit.id, latestVisitScheduledAt: latestVisit.scheduled_at },
          };
        }
      }
    }

    const existingId = await findActiveDealIdByInquiryId(inquiryId, client);
    if (existingId) {
      await client.query('ROLLBACK');
      return { deal: null, reason: 'deal_exists' };
    }

    const createdRes = await client.query(
      `INSERT INTO deals (inquiry_id, property_id, buyer_id, seller_id, agent_id, offer_price, status, notes)
       VALUES ($1, $2, $3, $4, $5, $6, 'open', $7)
       RETURNING id`,
      [
        inquiry.id,
        inquiry.property_id,
        inquiry.buyer_id,
        inquiry.seller_id,
        inquiry.agent_id,
        offerPrice,
        message,
      ],
    );

    await client.query('COMMIT');
    const deal = await getDealByIdMapped(createdRes.rows[0].id);
    const usedVisitId = latestVisit && String(latestVisit.status || '').toLowerCase() === 'completed' ? latestVisit.id : null;
    return {
      deal,
      reason: null,
      meta: {
        usedVisitId,
        latestVisitId: latestVisit?.id ?? null,
        latestVisitStatus: latestVisit?.status ?? null,
        adminOverride: allowOverride,
        overrideReason: allowOverride ? overrideReason : null,
      },
    };
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch {
      // ignore
    }
    // Unique constraint on active inquiry deals (race-safe)
    if (err?.code === '23505') return { deal: null, reason: 'deal_exists' };
    throw err;
  } finally {
    client.release();
  }
}

export async function listBuyerDeals({ buyerId, status = null, page = 1, limit = 50 } = {}) {
  const offset = (page - 1) * limit;
  const where = ['d.buyer_id = $1'];
  const params = [buyerId];
  if (status) {
    params.push(status);
    where.push(`d.status = $${params.length}`);
  }

  const res = await query(
    `SELECT d.*,
            p.title AS property_title, p.location AS property_location, p.price AS property_price, p.status AS property_status,
            p.seller_id AS property_seller_id,
            (
              SELECT image_url
              FROM property_images img
              WHERE img.property_id = p.id
              ORDER BY img.created_at ASC
              LIMIT 1
            ) AS property_thumbnail_url,
            a.name AS agent_name, a.email AS agent_email,
            i.status AS inquiry_status, i.message AS inquiry_message, i.created_at AS inquiry_created_at
     FROM deals d
     JOIN properties p ON p.id = d.property_id
     LEFT JOIN users a ON a.id = d.agent_id
     LEFT JOIN property_inquiries i ON i.id = d.inquiry_id
     WHERE ${where.join(' AND ')}
     ORDER BY d.created_at DESC
     LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    [...params, limit, offset],
  );
  return res.rows.map(mapDealRow);
}

export async function listAgentDeals({ agentId, status = null, page = 1, limit = 100 } = {}) {
  const offset = (page - 1) * limit;
  const where = ['d.agent_id = $1'];
  const params = [agentId];
  if (status) {
    params.push(status);
    where.push(`d.status = $${params.length}`);
  }

  const res = await query(
    `SELECT d.*,
            p.title AS property_title, p.location AS property_location, p.price AS property_price, p.status AS property_status,
            p.seller_id AS property_seller_id,
            (
              SELECT image_url
              FROM property_images img
              WHERE img.property_id = p.id
              ORDER BY img.created_at ASC
              LIMIT 1
            ) AS property_thumbnail_url,
            b.name AS buyer_name, b.email AS buyer_email,
            i.status AS inquiry_status, i.message AS inquiry_message, i.created_at AS inquiry_created_at
     FROM deals d
     JOIN properties p ON p.id = d.property_id
     LEFT JOIN users b ON b.id = d.buyer_id
     LEFT JOIN property_inquiries i ON i.id = d.inquiry_id
     WHERE ${where.join(' AND ')}
     ORDER BY d.created_at DESC
     LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    [...params, limit, offset],
  );
  return res.rows.map(mapDealRow);
}

export async function listSellerDeals({ sellerId, status = null, page = 1, limit = 100 } = {}) {
  const offset = (page - 1) * limit;
  const where = ['p.seller_id = $1'];
  const params = [sellerId];
  if (status) {
    params.push(status);
    where.push(`d.status = $${params.length}`);
  }

  const res = await query(
    `SELECT d.*,
            p.title AS property_title, p.location AS property_location, p.price AS property_price, p.status AS property_status,
            p.seller_id AS property_seller_id,
            (
              SELECT image_url
              FROM property_images img
              WHERE img.property_id = p.id
              ORDER BY img.created_at ASC
              LIMIT 1
            ) AS property_thumbnail_url,
            b.name AS buyer_name, b.email AS buyer_email,
            a.name AS agent_name, a.email AS agent_email,
            i.status AS inquiry_status, i.message AS inquiry_message, i.created_at AS inquiry_created_at
     FROM deals d
     JOIN properties p ON p.id = d.property_id
     LEFT JOIN users b ON b.id = d.buyer_id
     LEFT JOIN users a ON a.id = d.agent_id
     LEFT JOIN property_inquiries i ON i.id = d.inquiry_id
     WHERE ${where.join(' AND ')}
     ORDER BY d.created_at DESC
     LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    [...params, limit, offset],
  );
  return res.rows.map(mapDealRow);
}

export async function listAdminDeals(
  { status = null, agentId = null, buyerId = null, propertyId = null, startDate = null, endDate = null, page = 1, limit = 100 } = {},
) {
  const offset = (page - 1) * limit;
  const where = ['1=1'];
  const params = [];

  function add(cond, val) {
    params.push(val);
    where.push(cond.replace('?', `$${params.length}`));
  }

  if (status) add('d.status = ?', status);
  if (agentId) add('d.agent_id = ?', agentId);
  if (buyerId) add('d.buyer_id = ?', buyerId);
  if (propertyId) add('d.property_id = ?', propertyId);
  if (startDate) add('d.created_at >= ?::date', startDate);
  if (endDate) add('d.created_at <= (?::date + INTERVAL \'1 day\')', endDate);

  const res = await query(
    `SELECT d.*,
            p.title AS property_title, p.location AS property_location, p.price AS property_price, p.status AS property_status,
            p.seller_id AS property_seller_id,
            (
              SELECT image_url
              FROM property_images img
              WHERE img.property_id = p.id
              ORDER BY img.created_at ASC
              LIMIT 1
            ) AS property_thumbnail_url,
            b.name AS buyer_name, b.email AS buyer_email,
            a.name AS agent_name, a.email AS agent_email,
            i.status AS inquiry_status, i.message AS inquiry_message, i.created_at AS inquiry_created_at
     FROM deals d
     JOIN properties p ON p.id = d.property_id
     LEFT JOIN users b ON b.id = d.buyer_id
     LEFT JOIN users a ON a.id = d.agent_id
     LEFT JOIN property_inquiries i ON i.id = d.inquiry_id
     WHERE ${where.join(' AND ')}
     ORDER BY d.created_at DESC
     LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    [...params, limit, offset],
  );
  return res.rows.map(mapDealRow);
}

export async function updateDealOffer({ dealId, offerPrice, message = null }) {
  const res = await query(
    `UPDATE deals
     SET offer_price = $2,
         notes = COALESCE($3, notes)
     WHERE id = $1
     RETURNING id`,
    [dealId, offerPrice, message],
  );
  return getDealByIdMapped(res.rows[0]?.id);
}

export async function setDealStatus({ dealId, status, finalPrice = null, notes = null, clearFinalPrice = false }) {
  const res = await query(
    `UPDATE deals
     SET status = $2,
         final_price = CASE WHEN $5::boolean THEN NULL ELSE COALESCE($3, final_price) END,
         notes = COALESCE($4, notes)
     WHERE id = $1
     RETURNING id`,
    [dealId, status, finalPrice, notes, clearFinalPrice],
  );
  return getDealByIdMapped(res.rows[0]?.id);
}

export async function cancelDeal({ dealId }) {
  const res = await query(
    `UPDATE deals
     SET status = 'cancelled'
     WHERE id = $1
     RETURNING id`,
    [dealId],
  );
  return getDealByIdMapped(res.rows[0]?.id);
}

export async function reassignDealAgent({ dealId, agentId }) {
  const res = await query(
    `UPDATE deals
     SET agent_id = $2
     WHERE id = $1
     RETURNING id`,
    [dealId, agentId],
  );
  return res.rows[0]?.id ? getDealByIdMapped(res.rows[0].id) : null;
}
