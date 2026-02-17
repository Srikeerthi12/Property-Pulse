import { query } from '../config/db.js';

function mapVisitRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    inquiryId: row.inquiry_id,
    propertyId: row.property_id,
    buyerId: row.buyer_id,
    agentId: row.agent_id,
    visitDate: row.visit_date,
    visitTime: row.visit_time,
    scheduledAt: row.scheduled_at,
    status: row.status,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    property: row.property_id
      ? {
          id: row.property_id,
          title: row.property_title,
          location: row.property_location,
          price: row.property_price,
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
  };
}

async function getVisitByIdRaw(id) {
  const res = await query(
    `SELECT v.*, p.title AS property_title, p.location AS property_location, p.price AS property_price,
            p.seller_id AS property_seller_id,
            (
              SELECT image_url
              FROM property_images img
              WHERE img.property_id = p.id
              ORDER BY img.created_at ASC
              LIMIT 1
            ) AS property_thumbnail_url,
            b.name AS buyer_name, b.email AS buyer_email,
            a.name AS agent_name, a.email AS agent_email
     FROM visits v
     JOIN properties p ON p.id = v.property_id
     LEFT JOIN users b ON b.id = v.buyer_id
     LEFT JOIN users a ON a.id = v.agent_id
     WHERE v.id = $1
     LIMIT 1`,
    [id],
  );
  return res.rows[0] || null;
}

export async function getVisitByIdMapped(id) {
  const row = await getVisitByIdRaw(id);
  return mapVisitRow(row);
}

export async function createVisitFromInquiry({ inquiryId, visitDate, visitTime, notes = null, createdByUserId }) {
  const inquiryRes = await query(
    `SELECT i.id, i.property_id, i.buyer_id, i.agent_id
     FROM property_inquiries i
     WHERE i.id = $1
     LIMIT 1`,
    [inquiryId],
  );
  const inquiry = inquiryRes.rows[0];
  if (!inquiry) return null;

  const scheduledAt = visitDate && visitTime ? `${visitDate}T${visitTime}` : null;

  const res = await query(
    `INSERT INTO visits (inquiry_id, property_id, buyer_id, agent_id, visit_date, visit_time, scheduled_at, status, notes)
     VALUES ($1, $2, $3, $4, $5::date, $6::time, $7::timestamptz, 'scheduled', $8)
     RETURNING id`,
    [
      inquiry.id,
      inquiry.property_id,
      inquiry.buyer_id,
      inquiry.agent_id,
      visitDate,
      visitTime,
      scheduledAt,
      notes,
    ],
  );

  return getVisitByIdMapped(res.rows[0].id);
}

export async function listBuyerVisits({ buyerId, status = null, page = 1, limit = 50 } = {}) {
  const offset = (page - 1) * limit;
  const where = [`v.buyer_id = $1`];
  const params = [buyerId];
  if (status) {
    params.push(status);
    where.push(`v.status = $${params.length}`);
  }

  const res = await query(
    `SELECT v.*, p.title AS property_title, p.location AS property_location, p.price AS property_price,
            p.seller_id AS property_seller_id,
            (
              SELECT image_url
              FROM property_images img
              WHERE img.property_id = p.id
              ORDER BY img.created_at ASC
              LIMIT 1
            ) AS property_thumbnail_url,
            a.name AS agent_name, a.email AS agent_email
     FROM visits v
     JOIN properties p ON p.id = v.property_id
     LEFT JOIN users a ON a.id = v.agent_id
     WHERE ${where.join(' AND ')}
     ORDER BY v.visit_date DESC NULLS LAST, v.visit_time DESC NULLS LAST, v.created_at DESC
     LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    [...params, limit, offset],
  );
  return res.rows.map(mapVisitRow);
}

export async function listAgentVisits({ agentId, status = null, startDate = null, endDate = null, page = 1, limit = 200 } = {}) {
  const offset = (page - 1) * limit;
  const where = [`v.agent_id = $1`];
  const params = [agentId];
  if (status) {
    params.push(status);
    where.push(`v.status = $${params.length}`);
  }
  if (startDate) {
    params.push(startDate);
    where.push(`v.visit_date >= $${params.length}::date`);
  }
  if (endDate) {
    params.push(endDate);
    where.push(`v.visit_date <= $${params.length}::date`);
  }

  const res = await query(
    `SELECT v.*, p.title AS property_title, p.location AS property_location, p.price AS property_price,
            p.seller_id AS property_seller_id,
            (
              SELECT image_url
              FROM property_images img
              WHERE img.property_id = p.id
              ORDER BY img.created_at ASC
              LIMIT 1
            ) AS property_thumbnail_url,
            b.name AS buyer_name, b.email AS buyer_email
     FROM visits v
     JOIN properties p ON p.id = v.property_id
     LEFT JOIN users b ON b.id = v.buyer_id
     WHERE ${where.join(' AND ')}
     ORDER BY v.visit_date ASC NULLS LAST, v.visit_time ASC NULLS LAST, v.created_at ASC
     LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    [...params, limit, offset],
  );
  return res.rows.map(mapVisitRow);
}

export async function listSellerVisits({ sellerId, status = null, startDate = null, endDate = null, page = 1, limit = 200 } = {}) {
  const offset = (page - 1) * limit;
  const where = [`p.seller_id = $1`];
  const params = [sellerId];
  if (status) {
    params.push(status);
    where.push(`v.status = $${params.length}`);
  }
  if (startDate) {
    params.push(startDate);
    where.push(`v.visit_date >= $${params.length}::date`);
  }
  if (endDate) {
    params.push(endDate);
    where.push(`v.visit_date <= $${params.length}::date`);
  }

  const res = await query(
    `SELECT v.*, p.title AS property_title, p.location AS property_location, p.price AS property_price,
            p.seller_id AS property_seller_id,
            (
              SELECT image_url
              FROM property_images img
              WHERE img.property_id = p.id
              ORDER BY img.created_at ASC
              LIMIT 1
            ) AS property_thumbnail_url,
            b.name AS buyer_name, b.email AS buyer_email,
            a.name AS agent_name, a.email AS agent_email
     FROM visits v
     JOIN properties p ON p.id = v.property_id
     LEFT JOIN users b ON b.id = v.buyer_id
     LEFT JOIN users a ON a.id = v.agent_id
     WHERE ${where.join(' AND ')}
     ORDER BY v.visit_date DESC NULLS LAST, v.visit_time DESC NULLS LAST, v.created_at DESC
     LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    [...params, limit, offset],
  );
  return res.rows.map(mapVisitRow);
}

export async function listAdminVisits({ status = null, agentId = null, buyerId = null, propertyId = null, startDate = null, endDate = null, page = 1, limit = 100 } = {}) {
  const offset = (page - 1) * limit;
  const where = ['1=1'];
  const params = [];

  function add(cond, val) {
    params.push(val);
    where.push(cond.replace('?', `$${params.length}`));
  }

  if (status) add('v.status = ?', status);
  if (agentId) add('v.agent_id = ?', agentId);
  if (buyerId) add('v.buyer_id = ?', buyerId);
  if (propertyId) add('v.property_id = ?', propertyId);
  if (startDate) add('v.visit_date >= ?::date', startDate);
  if (endDate) add('v.visit_date <= ?::date', endDate);

  const res = await query(
    `SELECT v.*, p.title AS property_title, p.location AS property_location, p.price AS property_price,
            p.seller_id AS property_seller_id,
            (
              SELECT image_url
              FROM property_images img
              WHERE img.property_id = p.id
              ORDER BY img.created_at ASC
              LIMIT 1
            ) AS property_thumbnail_url,
            b.name AS buyer_name, b.email AS buyer_email,
            a.name AS agent_name, a.email AS agent_email
     FROM visits v
     JOIN properties p ON p.id = v.property_id
     LEFT JOIN users b ON b.id = v.buyer_id
     LEFT JOIN users a ON a.id = v.agent_id
     WHERE ${where.join(' AND ')}
     ORDER BY v.visit_date DESC NULLS LAST, v.visit_time DESC NULLS LAST, v.created_at DESC
     LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    [...params, limit, offset],
  );
  return res.rows.map(mapVisitRow);
}

export async function setVisitStatus({ visitId, status, notes = null }) {
  const res = await query(
    `UPDATE visits
     SET status = $2,
         notes = COALESCE($3, notes)
     WHERE id = $1
     RETURNING id`,
    [visitId, status, notes],
  );
  if (!res.rows[0]) return null;
  return getVisitByIdMapped(res.rows[0].id);
}

export async function rescheduleVisit({ visitId, visitDate, visitTime, notes = null }) {
  const scheduledAt = visitDate && visitTime ? `${visitDate}T${visitTime}` : null;
  const res = await query(
    `UPDATE visits
     SET visit_date = $2::date,
         visit_time = $3::time,
         scheduled_at = $4::timestamptz,
         status = 'rescheduled',
         notes = COALESCE($5, notes)
     WHERE id = $1
     RETURNING id`,
    [visitId, visitDate, visitTime, scheduledAt, notes],
  );
  if (!res.rows[0]) return null;
  return getVisitByIdMapped(res.rows[0].id);
}

export async function cancelVisit({ visitId }) {
  const res = await query(
    `UPDATE visits
     SET status = 'cancelled'
     WHERE id = $1
     RETURNING id`,
    [visitId],
  );
  if (!res.rows[0]) return null;
  return getVisitByIdMapped(res.rows[0].id);
}

export async function reassignVisitAgent({ visitId, agentId }) {
  const res = await query(
    `UPDATE visits
     SET agent_id = $2
     WHERE id = $1
     RETURNING id`,
    [visitId, agentId],
  );
  if (!res.rows[0]) return null;
  return getVisitByIdMapped(res.rows[0].id);
}

export async function setVisitsCompletedForInquiry(inquiryId) {
  if (!inquiryId) return;
  await query(
    `UPDATE visits
     SET status = 'completed'
     WHERE inquiry_id = $1
       AND status <> 'cancelled'
       AND (scheduled_at IS NULL OR scheduled_at <= now())`,
    [inquiryId],
  );
}
