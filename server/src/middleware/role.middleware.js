function normalizeRoles(roles) {
  if (!roles) return [];
  if (Array.isArray(roles)) return roles.map((r) => String(r).toLowerCase());
  return [String(roles).toLowerCase()];
}

export function roleMiddleware(roles = []) {
  const allowed = normalizeRoles(roles);

  return (req, res, next) => {
    const role = req.auth?.role ? String(req.auth.role).toLowerCase() : null;

    if (!role) return res.status(401).json({ error: 'Unauthorized' });
    if (allowed.length === 0) return next();

    if (!allowed.includes(role)) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    return next();
  };
}
