import { query } from '../config/db.js';

export async function createFavorite({ buyerId, propertyId }) {
  const result = await query(
    `INSERT INTO favorites (buyer_id, property_id)
     VALUES ($1, $2)
     RETURNING id, buyer_id AS "buyerId", property_id AS "propertyId", created_at AS "createdAt"`,
    [buyerId, propertyId],
  );
  return result.rows[0];
}

export async function deleteFavoriteById({ buyerId, favoriteId }) {
  const result = await query(
    `DELETE FROM favorites
     WHERE id = $1 AND buyer_id = $2
     RETURNING id`,
    [favoriteId, buyerId],
  );
  return result.rows[0] || null;
}

export async function listFavorites(buyerId) {
  const result = await query(
    `SELECT f.id AS "favoriteId", f.created_at AS "favoritedAt",
            p.id AS "propertyId", p.title, p.location, p.price, p.status,
            (
              SELECT image_url
              FROM property_images img
              WHERE img.property_id = p.id
              ORDER BY img.created_at ASC
              LIMIT 1
            ) AS "thumbnailUrl"
     FROM favorites f
     JOIN properties p ON p.id = f.property_id
     WHERE f.buyer_id = $1
     ORDER BY f.created_at DESC`,
    [buyerId],
  );
  return result.rows;
}

export async function favoriteExists({ buyerId, propertyId }) {
  const result = await query(
    `SELECT 1 FROM favorites WHERE buyer_id = $1 AND property_id = $2 LIMIT 1`,
    [buyerId, propertyId],
  );
  return Boolean(result.rows[0]);
}
