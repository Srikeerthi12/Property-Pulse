import fs from 'node:fs';
import path from 'node:path';

export function getUploadsRoot() {
  // Keep uploads inside the server project under src/uploads
  return path.join(process.cwd(), 'src', 'uploads');
}

export function ensureUploadsDir() {
  const root = getUploadsRoot();
  fs.mkdirSync(root, { recursive: true });
  return root;
}

export function ensurePropertyUploadsDir(propertyId) {
  const root = ensureUploadsDir();
  const dir = path.join(root, 'properties', String(propertyId));
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export function ensureDealUploadsDir(dealId) {
  const root = ensureUploadsDir();
  const dir = path.join(root, 'deals', String(dealId));
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export function toPublicUploadUrl(absFilePath) {
  const root = getUploadsRoot();
  const rel = path.relative(root, absFilePath).split(path.sep).join('/');
  return `/uploads/${rel}`;
}

export function isWithinUploadsRoot(absFilePath) {
  const root = getUploadsRoot();
  const rel = path.relative(root, absFilePath);
  return !!rel && !rel.startsWith('..') && !path.isAbsolute(rel);
}
