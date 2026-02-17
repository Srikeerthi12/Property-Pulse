import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import { api } from '../../services/api.js';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card.jsx';
import { Button } from '../../components/ui/button.jsx';
import { Check, ChevronLeft, ChevronRight, RefreshCw } from 'lucide-react';

export default function AdminLeads() {
  const [users, setUsers] = useState([]);
  const [leads, setLeads] = useState([]);
  const [leadPage, setLeadPage] = useState(1);
  const [leadStatus, setLeadStatus] = useState('');
  const [leadAgentId, setLeadAgentId] = useState('');
  const [leadQ, setLeadQ] = useState('');
  const [leadAssignDrafts, setLeadAssignDrafts] = useState({});
  const [leadError, setLeadError] = useState(null);
  const [isLeadLoading, setIsLeadLoading] = useState(false);

  async function loadUsers() {
    const usersRes = await api.get('/api/admin/users');
    setUsers(usersRes?.data?.users ?? []);
  }

  async function loadLeads(pageOverride) {
    setIsLeadLoading(true);
    setLeadError(null);
    try {
      const params = {
        page: pageOverride ?? leadPage,
        limit: 20,
      };
      if (leadStatus) params.status = leadStatus;
      if (leadAgentId) params.agentId = leadAgentId;
      if (leadQ?.trim()) params.q = leadQ.trim();

      const res = await api.get('/api/admin/leads', { params });
      setLeads(res?.data?.items ?? []);
      setLeadPage(res?.data?.page ?? (pageOverride ?? leadPage));
    } catch (err) {
      const status = err?.response?.status;
      const url = err?.config?.url;
      const baseURL = err?.config?.baseURL;
      const apiError = err?.response?.data?.error;
      const message = apiError || err?.message || 'Failed to load leads';
      setLeadError(`${status ? `(${status}) ` : ''}${baseURL ? `${baseURL}` : ''}${url ? `${url}: ` : ''}${message}`);
    } finally {
      setIsLeadLoading(false);
    }
  }

  useEffect(() => {
    (async () => {
      try {
        await loadUsers();
        await loadLeads(1);
      } catch (err) {
        const status = err?.response?.status;
        const url = err?.config?.url;
        const baseURL = err?.config?.baseURL;
        const apiError = err?.response?.data?.error;
        const message = apiError || err?.message || 'Failed to load admin leads';
        setLeadError(`${status ? `(${status}) ` : ''}${baseURL ? `${baseURL}` : ''}${url ? `${url}: ` : ''}${message}`);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    loadLeads(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leadStatus, leadAgentId, leadQ]);

  async function assignLead(inquiryId, selectedAgentId) {
    setLeadError(null);
    setIsLeadLoading(true);
    try {
      const raw = typeof selectedAgentId === 'string' ? selectedAgentId : '';
      const agentId = raw ? String(raw) : null;
      await api.patch(`/api/admin/leads/${inquiryId}/assign`, { agentId });
      await loadLeads();
    } catch (err) {
      const status = err?.response?.status;
      const url = err?.config?.url;
      const baseURL = err?.config?.baseURL;
      const apiError = err?.response?.data?.error;
      const message = apiError || err?.message || 'Failed to assign lead';
      setLeadError(`${status ? `(${status}) ` : ''}${baseURL ? `${baseURL}` : ''}${url ? `${url}: ` : ''}${message}`);
    } finally {
      setIsLeadLoading(false);
    }
  }

  const activeAgents = users.filter((u) => u.role === 'agent' && u.isActive);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Leads</h1>
        <p className="text-sm text-muted-foreground">Review and reassign inquiries across the platform.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Leads (CRM)</CardTitle>
          <CardDescription>Search, filter, and assign agents.</CardDescription>
        </CardHeader>
        <CardContent>
          {leadError ? (
            <div role="alert" className="mb-4 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm">
              {leadError}
            </div>
          ) : null}

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="sm:col-span-2">
              <label className="text-xs text-muted-foreground">Search</label>
              <input
                value={leadQ}
                onChange={(e) => setLeadQ(e.target.value)}
                placeholder="Property, buyer, agent"
                className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Status</label>
              <select
                value={leadStatus}
                onChange={(e) => setLeadStatus(e.target.value)}
                className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm"
              >
                <option value="">All</option>
                <option value="new">New</option>
                <option value="contacted">Contacted</option>
                <option value="visit_scheduled">Visit scheduled</option>
                <option value="negotiation">Negotiation</option>
                <option value="closed">Closed</option>
                <option value="dropped">Dropped</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Agent</label>
              <select
                value={leadAgentId}
                onChange={(e) => setLeadAgentId(e.target.value)}
                className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm"
              >
                <option value="">All</option>
                {activeAgents.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} ({u.email})
                  </option>
                ))}
              </select>
            </div>
            <div className="sm:col-span-2 flex items-end justify-end">
              <Button
                variant="outline"
                onClick={async () => {
                  await loadUsers();
                  await loadLeads(1);
                }}
                disabled={isLeadLoading}
              >
                <RefreshCw className="h-4 w-4" />
                {isLeadLoading ? 'Refreshing…' : 'Refresh'}
              </Button>
            </div>
          </div>

          {isLeadLoading && leads.length === 0 ? (
            <div className="mt-4 text-sm text-muted-foreground">Loading…</div>
          ) : leads.length === 0 ? (
            <div className="mt-4 text-sm text-muted-foreground">No leads found.</div>
          ) : (
            <div className="mt-4 grid gap-2">
              {leads.map((l) => (
                <div key={l.id} className="rounded-lg border bg-background p-3">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium">
                        <Link className="underline" to={`/properties/${l.propertyId}`}>
                          {l.property?.title || 'Property'}
                        </Link>
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        Buyer: {l.buyer?.name || '—'} ({l.buyer?.email || '—'})
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Agent: {l.agent?.name || 'Unassigned'} {l.agent?.email ? `(${l.agent.email})` : ''}
                      </div>
                      <div className="text-xs text-muted-foreground">Status: {l.status}</div>
                      {l.message ? <div className="mt-2 whitespace-pre-wrap text-xs text-muted-foreground">{l.message}</div> : null}
                    </div>

                    <div className="w-full sm:w-[320px]">
                      <label className="text-xs text-muted-foreground">Assign/reassign</label>
                      <div className="mt-1 flex gap-2">
                        <select
                          value={leadAssignDrafts[l.id] ?? (l.agent?.id ?? '')}
                          onChange={(e) =>
                            setLeadAssignDrafts((prev) => ({
                              ...prev,
                              [l.id]: e.target.value,
                            }))
                          }
                          className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                        >
                          <option value="">Unassigned</option>
                          {activeAgents.map((u) => (
                            <option key={u.id} value={u.id}>
                              {u.name}
                            </option>
                          ))}
                        </select>
                        <Button
                          variant="outline"
                          onClick={() => assignLead(l.id, leadAssignDrafts[l.id] ?? (l.agent?.id ?? ''))}
                          disabled={isLeadLoading}
                        >
                          <Check className="h-4 w-4" />
                          Apply
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="mt-4 flex items-center justify-between">
            <Button
              variant="outline"
              onClick={() => {
                const next = Math.max(1, leadPage - 1);
                setLeadPage(next);
                loadLeads(next);
              }}
              disabled={isLeadLoading || leadPage <= 1}
            >
              <ChevronLeft className="h-4 w-4" />
              Prev
            </Button>
            <div className="text-xs text-muted-foreground">Page {leadPage}</div>
            <Button
              variant="outline"
              onClick={() => {
                const next = leadPage + 1;
                setLeadPage(next);
                loadLeads(next);
              }}
              disabled={isLeadLoading}
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
