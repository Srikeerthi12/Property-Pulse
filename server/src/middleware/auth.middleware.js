import { verifyToken } from '../utils/jwt.js';
import { findUserById } from '../models/user.model.js';

function getBearerToken(req) {
  const header = req.headers?.authorization;
  if (!header || typeof header !== 'string') return null;

  const [scheme, token] = header.split(' ');
  if (scheme?.toLowerCase() !== 'bearer' || !token) return null;
  return token;
}

export async function authMiddleware(req, res, next) {
  const token = getBearerToken(req);
  if (!token) return res.status(401).json({ error: 'Unauthorized' });

  const secret = process.env.JWT_ACCESS_SECRET || 'dev-secret-change-me';

  try {
    const decoded = verifyToken(token, secret);
    req.auth = decoded;

    const user = await findUserById(decoded?.sub);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });
    if (!user.isActive) return res.status(403).json({ error: 'Account is inactive' });
    req.user = user;

    return next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}
