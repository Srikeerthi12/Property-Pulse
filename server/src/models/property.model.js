import { query } from '../config/db.js';

function toNumberOrNull(value) {
  if (value === null || value === undefined) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function mapPropertyRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    sellerId: row.seller_id,
    sellerName: row.seller_name ?? null,
    title: row.title,
    description: row.description,
    price: toNumberOrNull(row.price),
    area: toNumberOrNull(row.area),
    location: row.location,
    latitude: toNumberOrNull(row.latitude),
    longitude: toNumberOrNull(row.longitude),
    propertyType: row.property_type,
    bedrooms: row.bedrooms,
    bathrooms: row.bathrooms,
    amenities: row.amenities,
    status: row.status,
    rejectionReason: row.rejection_reason,
    viewCount: row.view_count,
    thumbnailUrl: row.thumbnail_url ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function getPropertyById(id) {
  const result = await query('SELECT * FROM properties WHERE id = $1', [id]);
  return result.rows[0] || null;
}

export async function getPropertyByIdMapped(id) {
  const result = await query('SELECT * FROM properties WHERE id = $1 LIMIT 1', [id]);
  return mapPropertyRow(result.rows[0]);
}

export async function createProperty({
  sellerId,
  title,
  description,
  price,
  area,
  location,
  latitude,
  longitude,
  propertyType,
  bedrooms,
  bathrooms,
  amenities,
  status,
}) {
  const result = await query(
    `INSERT INTO properties (
      seller_id, title, description, price, area, location, latitude, longitude,
      property_type, bedrooms, bathrooms, amenities, status
    )
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
     RETURNING *`,
    [
      sellerId,
      title,
      description ?? null,
      price ?? null,
      area ?? null,
      location ?? null,
      latitude ?? null,
      longitude ?? null,
      propertyType ?? null,
      bedrooms ?? null,
      bathrooms ?? null,
      JSON.stringify(amenities ?? []),
      status,
    ],
  );
  return mapPropertyRow(result.rows[0]);
}

export async function updatePropertyById(id, patch) {
  const fields = [];
  const values = [];
  let idx = 1;

  const mapping = {
    title: 'title',
    description: 'description',
    price: 'price',
    area: 'area',
    location: 'location',
    latitude: 'latitude',
    longitude: 'longitude',
    propertyType: 'property_type',
    bedrooms: 'bedrooms',
    bathrooms: 'bathrooms',
    amenities: 'amenities',
    rejectionReason: 'rejection_reason',
    status: 'status',
  };

  for (const [key, column] of Object.entries(mapping)) {
    if (Object.prototype.hasOwnProperty.call(patch, key)) {
      fields.push(`${column} = $${idx++}`);
      if (key === 'amenities') values.push(JSON.stringify(patch[key] ?? []));
      else values.push(patch[key] ?? null);
    }
  }

  if (fields.length === 0) return getPropertyByIdMapped(id);

  values.push(id);
  const result = await query(
    `UPDATE properties
     SET ${fields.join(', ')}
     WHERE id = $${idx}
     RETURNING *`,
    values,
  );

  return mapPropertyRow(result.rows[0]);
}

export async function setPropertyStatus({ propertyId, status, rejectionReason = null }) {
  const result = await query(
    `UPDATE properties
     SET status = $2,
         rejection_reason = $3
     WHERE id = $1
     RETURNING *`,
    [propertyId, status, rejectionReason],
  );
  return mapPropertyRow(result.rows[0]);
}

export async function incrementPropertyViewCount(propertyId) {
  await query('UPDATE properties SET view_count = view_count + 1 WHERE id = $1', [propertyId]);
}

export async function listApprovedProperties({
  q,
  location,
  minPrice,
  maxPrice,
  propertyType,
  sort,
  page,
  limit,
}) {
  const where = [`status = 'approved'`];
  const params = [];
  let idx = 1;

  if (location) {
    where.push(`location ILIKE $${idx++}`);
    params.push(`%${location}%`);
  }

  if (q) {
    where.push(`(title ILIKE $${idx} OR description ILIKE $${idx})`);
    params.push(`%${q}%`);
    idx += 1;
  }

  if (typeof minPrice === 'number') {
    where.push(`price >= $${idx++}`);
    params.push(minPrice);
  }

  if (typeof maxPrice === 'number') {
    where.push(`price <= $${idx++}`);
    params.push(maxPrice);
  }

  if (propertyType) {
    where.push(`property_type = $${idx++}`);
    params.push(propertyType);
  }

  const offset = (page - 1) * limit;
  params.push(limit, offset);

  const orderBy =
    sort === 'price_asc'
      ? 'price ASC NULLS LAST'
      : sort === 'price_desc'
        ? 'price DESC NULLS LAST'
        : 'created_at DESC';

  const result = await query(
    `SELECT p.*,
            (
              SELECT image_url
              FROM property_images i
              WHERE i.property_id = p.id
              ORDER BY i.created_at ASC
              LIMIT 1
            ) AS thumbnail_url
     FROM properties p
     WHERE ${where.join(' AND ')}
     ORDER BY ${orderBy}
     LIMIT $${idx++}
     OFFSET $${idx++}`,
    params,
  );

  return result.rows.map(mapPropertyRow);
}

export async function listSellerProperties(sellerId) {
  const result = await query(
    `SELECT p.*,
            (
              SELECT image_url
              FROM property_images i
              WHERE i.property_id = p.id
              ORDER BY i.created_at ASC
              LIMIT 1
            ) AS thumbnail_url
     FROM properties p
     WHERE p.seller_id = $1
     ORDER BY p.created_at DESC`,
    [sellerId],
  );
  return result.rows.map(mapPropertyRow);
}

export async function listPendingProperties({ sellerId = null, page = 1, limit = 20 } = {}) {
  const where = [`p.status = 'pending'`];
  const params = [];
  let idx = 1;

  if (sellerId) {
    where.push(`p.seller_id = $${idx++}`);
    params.push(sellerId);
  }

  const offset = (page - 1) * limit;
  params.push(limit, offset);

  const result = await query(
    `SELECT p.*,
            u.name AS seller_name,
            (
              SELECT image_url
              FROM property_images i
              WHERE i.property_id = p.id
              ORDER BY i.created_at ASC
              LIMIT 1
            ) AS thumbnail_url
     FROM properties p
     LEFT JOIN users u ON u.id = p.seller_id
     WHERE ${where.join(' AND ')}
     ORDER BY p.created_at ASC
     LIMIT $${idx++}
     OFFSET $${idx++}`,
    params,
  );

  return result.rows.map(mapPropertyRow);
}

export async function listAdminProperties({
  status,
  sellerId,
  q,
  sort = 'newest',
  page = 1,
  limit = 20,
} = {}) {
  const where = [];
  const params = [];
  let idx = 1;

  if (status) {
    where.push(`p.status = $${idx++}`);
    params.push(status);
  }

  if (sellerId) {
    where.push(`p.seller_id = $${idx++}`);
    params.push(sellerId);
  }

  if (q) {
    where.push(`(p.title ILIKE $${idx} OR p.description ILIKE $${idx})`);
    params.push(`%${q}%`);
    idx += 1;
  }

  const offset = (page - 1) * limit;
  params.push(limit, offset);

  const orderBy =
    sort === 'price_asc'
      ? 'p.price ASC NULLS LAST'
      : sort === 'price_desc'
        ? 'p.price DESC NULLS LAST'
        : 'p.created_at DESC';

  const result = await query(
    `SELECT p.*,
            u.name AS seller_name,
            (
              SELECT image_url
              FROM property_images i
              WHERE i.property_id = p.id
              ORDER BY i.created_at ASC
              LIMIT 1
            ) AS thumbnail_url
     FROM properties p
     LEFT JOIN users u ON u.id = p.seller_id
     ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
     ORDER BY ${orderBy}
     LIMIT $${idx++}
     OFFSET $${idx++}`,
    params,
  );

  return result.rows.map(mapPropertyRow);
}

export async function hasActiveDeal(propertyId) {
  try {
    const result = await query(
      `SELECT 1
       FROM deals
       WHERE property_id = $1 AND status = 'open'
       LIMIT 1`,
      [propertyId],
    );
    return Boolean(result.rows[0]);
  } catch (err) {
    // If deals aren't implemented yet, treat as no active deal.
    if (err?.code === '42P01') return false;
    throw err;
  }
}
