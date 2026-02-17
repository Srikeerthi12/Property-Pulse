import fs from 'node:fs/promises';
import path from 'node:path';

export async function ensureUploadsDir() {
  const uploadsDir = path.resolve('src', 'uploads');
  await fs.mkdir(uploadsDir, { recursive: true });
  return uploadsDir;
}
