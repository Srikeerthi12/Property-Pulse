import dotenv from 'dotenv';
import bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';

dotenv.config();

function getArg(name) {
  const prefix = `--${name}=`;
  const raw = process.argv.find((a) => a.startsWith(prefix));
  if (!raw) return null;
  return raw.slice(prefix.length);
}

function requireEnv(name, value) {
  if (!value) {
    throw new Error(
      `${name} is required. Provide it via --${name.toLowerCase()}=... or env ${name}.`,
    );
  }
}

function validateStrongPassword(password) {
  if (typeof password !== 'string' || password.length < 8) return 'Password must be at least 8 characters';
  if (!/[a-z]/.test(password)) return 'Password must include a lowercase letter';
  if (!/[A-Z]/.test(password)) return 'Password must include an uppercase letter';
  if (!/\d/.test(password)) return 'Password must include a number';
  if (!/[^A-Za-z0-9]/.test(password)) return 'Password must include a special character';
  if (password.length > 200) return 'Password is too long';
  return null;
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is not set. Set it in server/.env or your shell environment.');
  }

  const name = getArg('name') || process.env.ADMIN_NAME || 'Admin';
  const email = (getArg('email') || process.env.ADMIN_EMAIL || '').trim().toLowerCase();
  const password = getArg('password') || process.env.ADMIN_PASSWORD || '';

  requireEnv('ADMIN_EMAIL', email);
  requireEnv('ADMIN_PASSWORD', password);

  const passwordIssue = validateStrongPassword(password);
  if (passwordIssue) throw new Error(passwordIssue);

  const { query, pool } = await import('../src/config/db.js');

  try {
    const existing = await query('SELECT id FROM users WHERE email = $1 LIMIT 1', [email]);

    const passwordHash = await bcrypt.hash(password, 12);

    if (existing.rows[0]?.id) {
      const id = existing.rows[0].id;
      await query(
        `UPDATE users
         SET name = $2,
             password_hash = $3,
             role = 'admin',
             is_active = true
         WHERE id = $1`,
        [id, name, passwordHash],
      );
      // eslint-disable-next-line no-console
      console.log(`Updated existing user to admin: ${email}`);
      return;
    }

    const id = uuidv4();
    await query(
      `INSERT INTO users (id, name, email, password_hash, role, is_active)
       VALUES ($1, $2, $3, $4, 'admin', true)`,
      [id, name, email, passwordHash],
    );

    // eslint-disable-next-line no-console
    console.log(`Created admin user: ${email}`);
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('Create admin failed:', err?.message || err);
  process.exit(1);
});
