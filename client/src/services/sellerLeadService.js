import { api } from './api.js';

export async function listSellerPropertyLeads() {
  const { data } = await api.get('/api/seller/property-leads');
  return data;
}

export async function getSellerPropertyLeadDetail(propertyId) {
  const { data } = await api.get(`/api/seller/property-leads/${propertyId}`);
  return data;
}
