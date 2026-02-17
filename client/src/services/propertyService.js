import { api } from './api.js';

export async function getPropertyById(id) {
  const { data } = await api.get(`/api/properties/${id}`);
  return data;
}
