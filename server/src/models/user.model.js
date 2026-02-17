import { query } from '../config/db.js';

export async function findUserById(id) {
  const result = await query(
    `SELECT id, name, email, role, is_active AS "isActive", created_at AS "createdAt", updated_at AS "updatedAt"
     FROM users
     WHERE id = $1
     LIMIT 1`,
    [id],
  );
  return result.rows[0] || null;
}

export async function findUserByEmail(email) {
  const result = await query('SELECT * FROM users WHERE email = $1 LIMIT 1', [email]);
  return result.rows[0] || null;
}

export async function findUserForLoginByEmail(email) {
  const result = await query(
    `SELECT id, name, email, role, is_active AS "isActive", password_hash AS "passwordHash"
     FROM users
     WHERE email = $1
     LIMIT 1`,
    [email],
  );

  return result.rows[0] || null;
}

export async function createUser({ id, name, email, passwordHash, role, isActive }) {
  const result = await query(
    `INSERT INTO users (id, name, email, password_hash, role, is_active)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id, name, email, role, is_active AS "isActive", created_at AS "createdAt"`,
    [id, name, email, passwordHash, role, isActive],
  );

  return result.rows[0];
}

export async function getUserPasswordHashById(id) {
  const result = await query(
    `SELECT password_hash AS "passwordHash", is_active AS "isActive"
     FROM users
     WHERE id = $1
     LIMIT 1`,
    [id],
  );
  return result.rows[0] || null;
}

export async function updateUserNameById(id, name) {
  const result = await query(
    `UPDATE users
     SET name = $2
     WHERE id = $1
     RETURNING id, name, email, role, is_active AS "isActive", created_at AS "createdAt", updated_at AS "updatedAt"`,
    [id, name],
  );
  return result.rows[0] || null;
}

export async function updateUserEmailById(id, email) {
  const result = await query(
    `UPDATE users
     SET email = $2
     WHERE id = $1
     RETURNING id, name, email, role, is_active AS "isActive", created_at AS "createdAt", updated_at AS "updatedAt"`,
    [id, email],
  );
  return result.rows[0] || null;
}

export async function listUsers() {
  const result = await query(
    `SELECT id, name, email, role, is_active AS "isActive", created_at AS "createdAt", updated_at AS "updatedAt"
     FROM users
     ORDER BY created_at DESC`,
  );
  return result.rows;
}

export async function getUserStats() {
  const result = await query(
    `SELECT
       COUNT(*)::int AS total,
       SUM(CASE WHEN is_active THEN 1 ELSE 0 END)::int AS active,
       SUM(CASE WHEN NOT is_active THEN 1 ELSE 0 END)::int AS inactive,
       SUM(CASE WHEN role = 'buyer' THEN 1 ELSE 0 END)::int AS buyers,
       SUM(CASE WHEN role = 'seller' THEN 1 ELSE 0 END)::int AS sellers,
       SUM(CASE WHEN role = 'agent' THEN 1 ELSE 0 END)::int AS agents,
       SUM(CASE WHEN role = 'admin' THEN 1 ELSE 0 END)::int AS admins
     FROM users`,
  );
  return result.rows[0];
}

export async function setUserActiveById(id, isActive) {
  const result = await query(
    `UPDATE users
     SET is_active = $2
     WHERE id = $1
     RETURNING id, name, email, role, is_active AS "isActive", created_at AS "createdAt", updated_at AS "updatedAt"`,
    [id, isActive],
  );
  return result.rows[0] || null;
}

export async function deleteUserById(id) {
  const result = await query('DELETE FROM users WHERE id = $1 RETURNING id', [id]);
  return result.rows[0] || null;
}

export async function updateUserPasswordById(id, passwordHash) {
  await query(
    `UPDATE users
     SET password_hash = $2
     WHERE id = $1`,
    [id, passwordHash],
  );
}
