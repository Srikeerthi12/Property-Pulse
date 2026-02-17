import { api } from './api.js';

export async function getAnalytics() {
  const { data } = await api.get('/api/analytics');
  return data;
}
