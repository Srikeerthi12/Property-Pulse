import { api } from './api.js';

export async function addFavorite(propertyId) {
  const { data } = await api.post('/api/favorites', { propertyId });
  return data;
}

export async function listFavorites() {
  const { data } = await api.get('/api/favorites');
  return data;
}

export async function removeFavorite(favoriteId) {
  const { data } = await api.delete(`/api/favorites/${favoriteId}`);
  return data;
}
