import { api } from './api.js';

export async function createDeal({ inquiryId, offerPrice, message }) {
  const payload = { inquiryId };
  if (offerPrice !== undefined && offerPrice !== null && String(offerPrice).trim() !== '') payload.offerPrice = offerPrice;
  if (message !== undefined) payload.message = message;
  const { data } = await api.post('/api/deals', payload);
  return data;
}

export async function listMyDeals(params = {}) {
  const { data } = await api.get('/api/deals/my', { params });
  return data;
}

export async function listAgentDeals(params = {}) {
  const { data } = await api.get('/api/deals/agent', { params });
  return data;
}

export async function listDeals(params = {}) {
  const { data } = await api.get('/api/deals', { params });
  return data;
}

export async function updateDealStatus(dealId, { status, finalPrice, notes } = {}) {
  const { data } = await api.patch(`/api/deals/${dealId}/status`, { status, finalPrice, notes });
  return data;
}

export async function updateDealOffer(dealId, { offerPrice, message } = {}) {
  const { data } = await api.patch(`/api/deals/${dealId}/offer`, { offerPrice, message });
  return data;
}

export async function cancelDeal(dealId) {
  const { data } = await api.delete(`/api/deals/${dealId}`);
  return data;
}

export async function listDealDocuments(dealId) {
  const { data } = await api.get(`/api/deals/${dealId}/documents`);
  return data;
}

export async function uploadDealDocuments(dealId, files = [], { docType } = {}) {
  const form = new FormData();
  if (docType) form.append('docType', docType);
  for (const f of files) form.append('documents', f);
  const { data } = await api.post(`/api/deals/${dealId}/documents`, form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data;
}

export async function deleteDealDocument(dealId, docId) {
  const { data } = await api.delete(`/api/deals/${dealId}/documents/${docId}`);
  return data;
}
