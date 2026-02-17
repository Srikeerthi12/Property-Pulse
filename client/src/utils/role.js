export function getHomePathForRole(role) {
  const r = (role ?? '').toString().toLowerCase();
  if (r === 'admin') return '/admin';
  if (r === 'agent') return '/agent';
  if (r === 'seller') return '/seller';
  if (r === 'buyer') return '/buyer';
  return '/dashboard';
}
