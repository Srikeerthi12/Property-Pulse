import bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';

import {
  createUser,
  findUserByEmail,
  findUserById,
  findUserForLoginByEmail,
  getUserPasswordHashById,
  setUserActiveById,
  updateUserEmailById,
  updateUserNameById,
  updateUserPasswordById,
} from '../models/user.model.js';
import { signToken } from '../utils/jwt.js';
import {
  changePasswordSchema,
  deactivateMeSchema,
  loginSchema,
  reactivateSchema,
  registerSchema,
  updateProfileSchema,
} from '../utils/validators.js';

function buildAccessTokenPayload(user) {
  return {
    sub: user.id,
    role: user.role,
    email: user.email,
    name: user.name,
  };
}

export async function login(req, res) {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid payload', issues: parsed.error.issues });
  }

  const { email, password } = parsed.data;

  const user = await findUserForLoginByEmail(email);
  if (!user) return res.status(401).json({ error: 'Invalid email or password' });

  if (!user.isActive) {
    return res.status(403).json({
      error: 'Account is deactivated',
      code: 'ACCOUNT_DEACTIVATED',
      canReactivate: user.role !== 'admin',
    });
  }

  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) return res.status(401).json({ error: 'Invalid email or password' });

  const accessMinutes = Number(process.env.JWT_ACCESS_TTL_MINUTES || 60);
  const accessToken = signToken(
    buildAccessTokenPayload(user),
    process.env.JWT_ACCESS_SECRET || 'dev-secret-change-me',
    { expiresIn: `${accessMinutes}m` },
  );

  const { passwordHash: _passwordHash, ...safeUser } = user;
  return res.json({ user: safeUser, accessToken });

}

export async function reactivate(req, res) {
  const parsed = reactivateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid payload', issues: parsed.error.issues });
  }

  const { email, password } = parsed.data;

  const user = await findUserForLoginByEmail(email);
  if (!user) return res.status(401).json({ error: 'Invalid email or password' });

  if (String(user.role).toLowerCase() === 'admin') {
    return res.status(403).json({ error: 'Admins must be reactivated by an admin' });
  }

  // Confirm password before reactivating.
  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) return res.status(401).json({ error: 'Invalid email or password' });

  if (!user.isActive) {
    await setUserActiveById(user.id, true);
  }

  const accessMinutes = Number(process.env.JWT_ACCESS_TTL_MINUTES || 60);
  const accessToken = signToken(
    buildAccessTokenPayload({ ...user, isActive: true }),
    process.env.JWT_ACCESS_SECRET || 'dev-secret-change-me',
    { expiresIn: `${accessMinutes}m` },
  );

  const { passwordHash: _passwordHash, ...safeUser } = { ...user, isActive: true };
  return res.json({ user: safeUser, accessToken });
}

export async function register(_req, res) {
  const parsed = registerSchema.safeParse(_req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid payload', issues: parsed.error.issues });
  }

  const { name, email, password, role, autoLogin } = parsed.data;

  const existing = await findUserByEmail(email);
  if (existing) return res.status(409).json({ error: 'Email already in use' });

  const passwordHash = await bcrypt.hash(password, 12);
  const userId = uuidv4();

  const isActive = true;
  let created;

  try {
    created = await createUser({
      id: userId,
      name,
      email,
      passwordHash,
      role,
      isActive,
    });
  } catch (err) {
    if (err?.code === '23505') {
      return res.status(409).json({ error: 'Email already in use' });
    }
    throw err;
  }

  if (autoLogin) {
    // (Optional) auto-login: issue access token; refresh token only if configured.
    const accessMinutes = Number(process.env.JWT_ACCESS_TTL_MINUTES || 60);
    const accessSecret = process.env.JWT_ACCESS_SECRET || 'dev-secret-change-me';
    const accessToken = signToken(
      buildAccessTokenPayload(created),
      accessSecret,
      { expiresIn: `${accessMinutes}m` },
    );

    if (process.env.JWT_REFRESH_SECRET) {
      const refreshDays = Number(process.env.JWT_REFRESH_TTL_DAYS || 30);
      const refreshToken = signToken(
        { sub: created.id, role: created.role, email: created.email, typ: 'refresh' },
        process.env.JWT_REFRESH_SECRET,
        { expiresIn: `${refreshDays}d` },
      );
      return res.status(201).json({ user: created, accessToken, refreshToken });
    }

    return res.status(201).json({ user: created, accessToken });
  }

  return res.status(201).json({ user: created });
}

export async function logout(_req, res) {
  return res.json({ ok: true });
}

export async function me(_req, res) {
  const userId = _req.auth?.sub;
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  const user = await findUserById(userId);
  if (!user) return res.status(404).json({ error: 'User not found' });

  return res.json({ user });
}

export async function updateMe(req, res) {
  const userId = req.auth?.sub;
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  const parsed = updateProfileSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid payload', issues: parsed.error.issues });
  }

  const { name, email } = parsed.data;

  try {
    let updated = null;
    if (typeof name === 'string') {
      updated = await updateUserNameById(userId, name);
    }
    if (typeof email === 'string') {
      const existing = await findUserByEmail(email);
      if (existing && existing.id !== userId) {
        return res.status(409).json({ error: 'Email already in use' });
      }
      updated = await updateUserEmailById(userId, email);
    }

    if (!updated) return res.status(404).json({ error: 'User not found' });
    return res.json({ user: updated });
  } catch (err) {
    if (err?.code === '23505') {
      return res.status(409).json({ error: 'Email already in use' });
    }
    throw err;
  }
}

export async function changePassword(req, res) {
  const userId = req.auth?.sub;
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  const parsed = changePasswordSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid payload', issues: parsed.error.issues });
  }

  const { currentPassword, newPassword } = parsed.data;

  const row = await getUserPasswordHashById(userId);
  if (!row) return res.status(404).json({ error: 'User not found' });
  if (!row.isActive) return res.status(403).json({ error: 'Account is inactive' });

  const ok = await bcrypt.compare(currentPassword, row.passwordHash);
  if (!ok) return res.status(401).json({ error: 'Current password is incorrect' });

  const newHash = await bcrypt.hash(newPassword, 12);
  await updateUserPasswordById(userId, newHash);

  return res.json({ ok: true });
}

export async function deactivateMe(req, res) {
  const userId = req.auth?.sub;
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  // authMiddleware attaches current user
  const role = req.user?.role ? String(req.user.role).toLowerCase() : null;
  if (role === 'admin') return res.status(403).json({ error: 'Admins cannot self-deactivate' });

  const parsed = deactivateMeSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid payload', issues: parsed.error.issues });
  }

  const row = await getUserPasswordHashById(userId);
  if (!row) return res.status(404).json({ error: 'User not found' });
  if (!row.isActive) return res.status(403).json({ error: 'Account is inactive' });

  const ok = await bcrypt.compare(parsed.data.password, row.passwordHash);
  if (!ok) return res.status(401).json({ error: 'Password is incorrect' });

  await setUserActiveById(userId, false);

  // JWT is effectively invalidated because auth middleware checks is_active on each request.
  return res.json({ ok: true });
}
