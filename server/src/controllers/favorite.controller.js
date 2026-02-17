import { z } from 'zod';

import { createFavorite, deleteFavoriteById, favoriteExists, listFavorites } from '../models/favorite.model.js';
import { getPropertyByIdMapped } from '../models/property.model.js';
import { createFavoriteSchema } from '../utils/inquiry.validators.js';

export async function add(req, res) {
  const parsed = createFavoriteSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid payload', issues: parsed.error.issues });

  const buyerId = req.auth?.sub;
  if (!buyerId) return res.status(401).json({ error: 'Unauthorized' });

  const property = await getPropertyByIdMapped(parsed.data.propertyId);
  if (!property || property.status !== 'approved') return res.status(404).json({ error: 'Property not found' });

  if (await favoriteExists({ buyerId, propertyId: property.id })) {
    return res.status(200).json({ ok: true });
  }

  try {
    const favorite = await createFavorite({ buyerId, propertyId: property.id });
    return res.status(201).json({ favorite });
  } catch (err) {
    if (err?.code === '23505') return res.status(200).json({ ok: true });
    throw err;
  }
}

export async function remove(req, res) {
  const parsedParams = z.object({ id: z.string().uuid() }).safeParse(req.params);
  if (!parsedParams.success) return res.status(400).json({ error: 'Invalid favorite id' });

  const buyerId = req.auth?.sub;
  if (!buyerId) return res.status(401).json({ error: 'Unauthorized' });

  const deleted = await deleteFavoriteById({ buyerId, favoriteId: parsedParams.data.id });
  if (!deleted) return res.status(404).json({ error: 'Favorite not found' });
  return res.json({ ok: true });
}

export async function list(req, res) {
  const buyerId = req.auth?.sub;
  if (!buyerId) return res.status(401).json({ error: 'Unauthorized' });

  const items = await listFavorites(buyerId);
  return res.json({ items });
}
