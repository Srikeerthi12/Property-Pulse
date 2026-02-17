import { useEffect, useMemo, useState } from 'react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card.jsx';
import { Button } from '../../components/ui/button.jsx';
import StatusBadge from '../../components/common/StatusBadge.jsx';
import * as visitService from '../../services/visitService.js';
import { api } from '../../services/api.js';

export default function AdminVisits() {
  const [items, setItems] = useState([]);
  const [agents, setAgents] = useState([]);
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  const [status, setStatus] = useState('');
  const [agentId, setAgentId] = useState('');
  const [propertyId, setPropertyId] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  async function loadAgents() {
    const res = await api.get('/api/admin/users');
    const users = res?.data?.users ?? [];
    setAgents(users.filter((u) => String(u.role || '').toLowerCase() === 'agent'));
  }

  async function refresh() {
    setIsLoading(true);
    setError(null);
    try {
      const data = await visitService.listVisits({
        status: status || undefined,
        agentId: agentId || undefined,
        propertyId: propertyId?.trim() ? propertyId.trim() : undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        page: 1,
        limit: 200,
      });
      setItems(data?.items ?? []);
    } catch (err) {
      const message = err?.response?.data?.error || err?.message || 'Failed to load visits';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        await loadAgents();
        if (mounted) await refresh();
      } catch (err) {
        if (mounted) setError(err?.response?.data?.error || err?.message || 'Failed to load admin data');
      }
    })();
    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const agentOptions = useMemo(() => {
    return [{ id: '', name: 'All' }, ...agents.map((a) => ({ id: a.id, name: a.name || a.email || a.id }))];
  }, [agents]);

  async function reassign(v, newAgentId) {
    setError(null);
    setIsLoading(true);
    try {
      await visitService.reassignVisit(v.id, { agentId: newAgentId || null });
      await refresh();
    } catch (err) {
      const message = err?.response?.data?.error || err?.message || 'Failed to reassign';
      setError(message);
      setIsLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Visits</h1>
        <p className="text-sm text-muted-foreground">Manage all appointments across the system.</p>
      </div>

      {error ? (
        <div role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm">
          {error}
        </div>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
          <CardDescription>Filter by agent, property, date, and status.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <div>
              <label className="text-xs text-muted-foreground">Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm"
              >
                <option value="">All</option>
                <option value="scheduled">Scheduled</option>
                <option value="confirmed">Confirmed</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
                <option value="rescheduled">Rescheduled</option>
                <option value="no_show">No show</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Agent</label>
              <select
                value={agentId}
                onChange={(e) => setAgentId(e.target.value)}
                className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm"
              >
                {agentOptions.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Property id</label>
              <input
                value={propertyId}
                onChange={(e) => setPropertyId(e.target.value)}
                placeholder="UUID"
                className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Start date</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">End date</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div className="mt-3 flex items-center justify-end gap-2">
            <Button variant="outline" onClick={refresh} disabled={isLoading}>
              Apply
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>All visits</CardTitle>
          <CardDescription>Latest visits (up to 200).</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-sm text-muted-foreground">Loading…</div>
          ) : items.length === 0 ? (
            <div className="text-sm text-muted-foreground">No visits found.</div>
          ) : (
            <div className="grid gap-2">
              {items.map((v) => (
                <div key={v.id} className="rounded-lg border bg-background p-3">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium">{v?.property?.title || 'Property'}</div>
                      <div className="truncate text-xs text-muted-foreground">{v?.property?.location || '—'}</div>
                      <div className="text-xs text-muted-foreground">
                        {v.visitDate || '—'} {v.visitTime ? `• ${String(v.visitTime).slice(0, 5)}` : ''}
                      </div>
                      <div className="text-xs text-muted-foreground">Buyer: {v?.buyer?.email || '—'}</div>
                      <div className="text-xs text-muted-foreground">Agent: {v?.agent?.email || '—'}</div>
                      {v?.notes ? <div className="mt-2 whitespace-pre-wrap text-xs text-muted-foreground">{v.notes}</div> : null}
                    </div>

                    <div className="flex flex-col gap-2 sm:items-end">
                      <StatusBadge status={v.status} />
                      <div className="grid gap-1">
                        <div className="text-[11px] text-muted-foreground">Reassign agent</div>
                        <select
                          value={v.agentId || ''}
                          onChange={(e) => reassign(v, e.target.value)}
                          className="h-9 rounded-md border bg-background px-2 text-xs"
                        >
                          {agentOptions.map((a) => (
                            <option key={a.id} value={a.id}>
                              {a.id ? a.name : 'Unassigned'}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
