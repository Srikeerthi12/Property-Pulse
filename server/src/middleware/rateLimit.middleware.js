import rateLimit from 'express-rate-limit';

export function rateLimitMiddleware() {
  return rateLimit({
    windowMs: 60 * 1000,
    limit: 120,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
  });
}

export function loginRateLimitMiddleware() {
  // Stricter limiter to reduce brute-force attempts.
  return rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: { error: 'Too many login attempts. Please try again later.' },
  });
}
