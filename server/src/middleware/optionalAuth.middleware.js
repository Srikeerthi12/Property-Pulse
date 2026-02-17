import { verifyToken } from '../utils/jwt.js';
import { findUserById } from '../models/user.model.js';

function getBearerToken(req) {
  const header = req.headers?.authorization;
  if (!header || typeof header !== 'string') return null;

  const [scheme, token] = header.split(' ');
  if (scheme?.toLowerCase() !== 'bearer' || !token) return null;
  return token;
}

export async function optionalAuthMiddleware(req, _res, next) {
  const token = getBearerToken(req);
  if (!token) return next();

  const secret = process.env.JWT_ACCESS_SECRET || 'dev-secret-change-me';

  try {
    const decoded = verifyToken(token, secret);
    const user = await findUserById(decoded?.sub);
    if (!user || !user.isActive) return next();

    req.auth = decoded;
    req.user = user;
    return next();
  } catch {
    return next();
  }
}
