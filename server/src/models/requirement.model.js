import { query } from '../config/db.js';

export async function listRequirements() {
  const result = await query('SELECT * FROM requirements ORDER BY created_at DESC', []);
  return result.rows;
}
