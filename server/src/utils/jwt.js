import jwt from 'jsonwebtoken';

export function signToken(payload, secret, options = {}) {
  return jwt.sign(payload, secret, options);
}

export function verifyToken(token, secret) {
  return jwt.verify(token, secret);
}
