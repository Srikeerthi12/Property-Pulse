import { api } from './api.js';

export async function createInquiry({ propertyId, message }) {
  const { data } = await api.post('/api/inquiries', { propertyId, message });
  return data;
}

export async function listMyInquiries({ page = 1, limit = 20 } = {}) {
  const { data } = await api.get('/api/inquiries/my', { params: { page, limit } });
  return data;
}

export async function listAgentLeads({ status, q, page = 1, limit = 20 } = {}) {
  const params = { page, limit };
  if (status) params.status = status;
  if (q) params.q = q;
  const { data } = await api.get('/api/agent/leads', { params });
  return data;
}

export async function updateInquiryStatus(inquiryId, status) {
  const { data } = await api.patch(`/api/inquiries/${inquiryId}/status`, { status });
  return data;
}

export async function addInquiryNote(inquiryId, note) {
  const { data } = await api.post(`/api/inquiries/${inquiryId}/notes`, { note });
  return data;
}

export async function listInquiryNotes(inquiryId) {
  const { data } = await api.get(`/api/inquiries/${inquiryId}/notes`);
  return data;
}

export async function submitInquiryOffer(inquiryId, { offerPrice, message } = {}) {
  const payload = { offerPrice };
  if (message !== undefined) payload.message = message;
  const { data } = await api.patch(`/api/inquiries/${inquiryId}/offer`, payload);
  return data;
}
