import { query } from '../config/db.js';

export async function listReviewsForProperty(propertyId) {
  const result = await query('SELECT * FROM reviews WHERE property_id = $1 ORDER BY created_at DESC', [propertyId]);
  return result.rows;
}
