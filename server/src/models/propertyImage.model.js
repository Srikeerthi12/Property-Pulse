import { query } from '../config/db.js';

export async function addPropertyImages(propertyId, imageUrls) {
  if (!Array.isArray(imageUrls) || imageUrls.length === 0) return [];

  const values = [];
  const params = [];
  let idx = 1;

  for (const url of imageUrls) {
    values.push(`($${idx++}, $${idx++})`);
    params.push(propertyId, url);
  }

  const result = await query(
    `INSERT INTO property_images (property_id, image_url)
     VALUES ${values.join(', ')}
     RETURNING id, property_id AS "propertyId", image_url AS "imageUrl", created_at AS "createdAt"`,
    params,
  );

  return result.rows;
}

export async function listPropertyImages(propertyId) {
  const result = await query(
    `SELECT id, property_id AS "propertyId", image_url AS "imageUrl", created_at AS "createdAt"
     FROM property_images
     WHERE property_id = $1
     ORDER BY created_at ASC`,
    [propertyId],
  );
  return result.rows;
}

export async function getPropertyImageById(imageId) {
  const result = await query(
    `SELECT id, property_id AS "propertyId", image_url AS "imageUrl"
     FROM property_images
     WHERE id = $1
     LIMIT 1`,
    [imageId],
  );
  return result.rows[0] || null;
}

export async function deletePropertyImageById(imageId) {
  const result = await query('DELETE FROM property_images WHERE id = $1 RETURNING id', [imageId]);
  return result.rows[0] || null;
}

export async function deleteAllImagesForProperty(propertyId) {
  const result = await query(
    `DELETE FROM property_images
     WHERE property_id = $1
     RETURNING image_url AS "imageUrl"`,
    [propertyId],
  );
  return result.rows;
}
