import { api } from './api.js';

export async function createVisit({ inquiryId, visitDate, visitTime, notes }) {
  const { data } = await api.post('/api/visits', { inquiryId, visitDate, visitTime, notes });
  return data;
}

export async function listMyVisits({ status, page = 1, limit = 50 } = {}) {
  const { data } = await api.get('/api/visits/my', { params: { status, page, limit } });
  return data;
}

export async function listAgentVisits({ status, startDate, endDate, agentId, page = 1, limit = 200 } = {}) {
  const { data } = await api.get('/api/visits/agent', {
    params: { status, startDate, endDate, agentId, page, limit },
  });
  return data;
}

// Admin uses this; seller also uses it to list visits for their properties
export async function listVisits({ status, agentId, buyerId, propertyId, startDate, endDate, page = 1, limit = 100 } = {}) {
  const { data } = await api.get('/api/visits', {
    params: { status, agentId, buyerId, propertyId, startDate, endDate, page, limit },
  });
  return data;
}

export async function updateVisitStatus(visitId, { status, notes }) {
  const { data } = await api.patch(`/api/visits/${visitId}/status`, { status, notes });
  return data;
}

export async function rescheduleVisit(visitId, { visitDate, visitTime, notes }) {
  const { data } = await api.patch(`/api/visits/${visitId}/reschedule`, { visitDate, visitTime, notes });
  return data;
}

export async function cancelVisit(visitId) {
  const { data } = await api.delete(`/api/visits/${visitId}`);
  return data;
}

export async function reassignVisit(visitId, { agentId }) {
  const { data } = await api.patch(`/api/visits/${visitId}/reassign`, { agentId });
  return data;
}
