export function apiAbsoluteUrl(maybeRelativeUrl) {
  if (!maybeRelativeUrl) return null;
  if (typeof maybeRelativeUrl !== 'string') return null;

  if (/^https?:\/\//i.test(maybeRelativeUrl)) return maybeRelativeUrl;

  const base = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5001';
  if (maybeRelativeUrl.startsWith('/')) return `${base}${maybeRelativeUrl}`;
  return `${base}/${maybeRelativeUrl}`;
}
