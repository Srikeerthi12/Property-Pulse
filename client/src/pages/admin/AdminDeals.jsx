import { useEffect, useMemo, useState } from 'react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card.jsx';
import { Button } from '../../components/ui/button.jsx';
import Modal from '../../components/common/Modal.jsx';
import StatusBadge from '../../components/common/StatusBadge.jsx';
import DealDocumentsModal from '../../components/deal/DealDocumentsModal.jsx';
import DealProgress from '../../components/deal/DealProgress.jsx';
import * as dealService from '../../services/dealService.js';
import { api } from '../../services/api.js';

function formatMoney(value) {
  if (typeof value !== 'number') return '—';
  return `₹${value.toLocaleString()}`;
}

export default function AdminDeals() {
  const [items, setItems] = useState([]);
  const [agents, setAgents] = useState([]);
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  const [status, setStatus] = useState('');
  const [agentId, setAgentId] = useState('');
  const [buyerId, setBuyerId] = useState('');
  const [propertyId, setPropertyId] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const [statusOpen, setStatusOpen] = useState(false);
  const [selectedDeal, setSelectedDeal] = useState(null);
  const [docsOpen, setDocsOpen] = useState(false);
  const [docsDeal, setDocsDeal] = useState(null);
  const [nextStatus, setNextStatus] = useState('open');
  const [finalPrice, setFinalPrice] = useState('');
  const [notes, setNotes] = useState('');

  async function loadAgents() {
    const res = await api.get('/api/admin/users');
    const users = res?.data?.users ?? [];
    setAgents(users.filter((u) => String(u.role || '').toLowerCase() === 'agent'));
  }

  async function refresh() {
    setIsLoading(true);
    setError(null);
    try {
      const data = await dealService.listDeals({
        status: status || undefined,
        agentId: agentId || undefined,
        buyerId: buyerId || undefined,
        propertyId: propertyId?.trim() ? propertyId.trim() : undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        page: 1,
        limit: 200,
      });
      setItems(data?.items ?? []);
    } catch (err) {
      const msg = err?.response?.data?.error || err?.message || 'Failed to load deals';
      setError(msg);
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

  const analytics = useMemo(() => {
    const total = items.length;
    const active = items.filter((d) => !['closed_won', 'closed_lost', 'cancelled'].includes(d.status)).length;
    const won = items.filter((d) => d.status === 'closed_won');
    const lost = items.filter((d) => d.status === 'closed_lost').length;
    const cancelled = items.filter((d) => d.status === 'cancelled').length;
    const totalValue = won.reduce((sum, d) => sum + (typeof d.finalPrice === 'number' ? d.finalPrice : 0), 0);
    const conversionRate = total > 0 ? Math.round((won.length / total) * 100) : 0;

    const byAgent = new Map();
    for (const d of items) {
      const key = d?.agent?.email || d?.agent?.name || d.agentId || 'Unassigned';
      const prev = byAgent.get(key) || { total: 0, won: 0 };
      prev.total += 1;
      if (d.status === 'closed_won') prev.won += 1;
      byAgent.set(key, prev);
    }

    const agentRows = Array.from(byAgent.entries())
      .map(([name, v]) => ({ name, ...v }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 8);

    return { total, active, won: won.length, lost, cancelled, totalValue, conversionRate, agentRows };
  }, [items]);

  function openStatusModal(d) {
    setSelectedDeal(d);
    setNextStatus(d.status || 'open');
    setFinalPrice(typeof d.finalPrice === 'number' ? String(d.finalPrice) : '');
    setNotes(d.notes || '');
    setStatusOpen(true);
  }

  function openDocuments(d) {
    setDocsDeal(d);
    setDocsOpen(true);
  }

  async function submitStatus() {
    if (!selectedDeal) return;
    setIsLoading(true);
    setError(null);
    try {
      await dealService.updateDealStatus(selectedDeal.id, {
        status: nextStatus,
        finalPrice: nextStatus === 'closed_won' ? finalPrice : undefined,
        notes: notes?.trim() ? notes.trim() : undefined,
      });
      setStatusOpen(false);
      setSelectedDeal(null);
      await refresh();
    } catch (err) {
      const msg = err?.response?.data?.error || err?.message || 'Failed to update status';
      setError(msg);
      setIsLoading(false);
    }
  }

  async function cancelDeal(d) {
    setIsLoading(true);
    setError(null);
    try {
      await dealService.cancelDeal(d.id);
      await refresh();
    } catch (err) {
      const msg = err?.response?.data?.error || err?.message || 'Failed to cancel deal';
      setError(msg);
      setIsLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Deals</h1>
        <p className="text-sm text-muted-foreground">Oversee all transactions and pipeline health.</p>
      </div>

      {error ? (
        <div role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm">
          {error}
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader>
            <CardTitle>Total deals</CardTitle>
            <CardDescription>Current filter scope.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">{analytics.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Active</CardTitle>
            <CardDescription>Open / negotiation / pending.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">{analytics.active}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Won</CardTitle>
            <CardDescription>Closed-won deals.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">{analytics.won}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Total value</CardTitle>
            <CardDescription>Sum of final prices (won).</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">{formatMoney(analytics.totalValue)}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Analytics</CardTitle>
          <CardDescription>Simple pipeline charts from the current results.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg border bg-background p-3">
              <div className="text-xs text-muted-foreground">Conversion rate</div>
              <div className="mt-1 text-lg font-semibold">{analytics.conversionRate}%</div>
              <div className="mt-2 h-2 w-full overflow-hidden rounded bg-muted">
                <div className="h-2 bg-foreground" style={{ width: `${analytics.conversionRate}%` }} />
              </div>
            </div>

            <div className="rounded-lg border bg-background p-3">
              <div className="text-xs text-muted-foreground">Status mix</div>
              <div className="mt-2 grid gap-2">
                {[
                  { label: 'Won', value: analytics.won },
                  { label: 'Lost', value: analytics.lost },
                  { label: 'Cancelled', value: analytics.cancelled },
                ].map((row) => {
                  const pct = analytics.total ? Math.round((row.value / analytics.total) * 100) : 0;
                  return (
                    <div key={row.label}>
                      <div className="flex items-center justify-between text-xs">
                        <div className="text-muted-foreground">{row.label}</div>
                        <div>{row.value}</div>
                      </div>
                      <div className="mt-1 h-2 w-full overflow-hidden rounded bg-muted">
                        <div className="h-2 bg-foreground" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="mt-3 rounded-lg border bg-background p-3">
            <div className="text-xs font-medium text-muted-foreground">Agent performance (top 8)</div>
            <div className="mt-2 grid gap-2">
              {analytics.agentRows.length === 0 ? (
                <div className="text-sm text-muted-foreground">No data.</div>
              ) : (
                analytics.agentRows.map((a) => {
                  const pct = a.total ? Math.round((a.won / a.total) * 100) : 0;
                  return (
                    <div key={a.name}>
                      <div className="flex items-center justify-between text-xs">
                        <div className="truncate text-muted-foreground">{a.name}</div>
                        <div>
                          {a.won}/{a.total} won
                        </div>
                      </div>
                      <div className="mt-1 h-2 w-full overflow-hidden rounded bg-muted">
                        <div className="h-2 bg-foreground" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
          <CardDescription>Filter by agent, property, buyer, date, and status.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
            <div>
              <label className="text-xs text-muted-foreground">Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm"
              >
                <option value="">All</option>
                <option value="open">Open</option>
                <option value="negotiation">Negotiation</option>
                <option value="agreement_pending">Agreement pending</option>
                <option value="closed_won">Closed won</option>
                <option value="closed_lost">Closed lost</option>
                <option value="cancelled">Cancelled</option>
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
              <label className="text-xs text-muted-foreground">Buyer id</label>
              <input
                value={buyerId}
                onChange={(e) => setBuyerId(e.target.value)}
                placeholder="UUID"
                className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"
              />
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
          <CardTitle>All deals</CardTitle>
          <CardDescription>Latest deals (up to 200).</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-sm text-muted-foreground">Loading…</div>
          ) : items.length === 0 ? (
            <div className="text-sm text-muted-foreground">No deals found.</div>
          ) : (
            <div className="grid gap-2">
              {items.map((d) => (
                <div key={d.id} className="rounded-lg border bg-background p-3">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium">{d?.property?.title || 'Property'}</div>
                      <div className="truncate text-xs text-muted-foreground">{d?.property?.location || '—'}</div>
                      <div className="mt-1 flex flex-wrap items-center gap-2">
                        <StatusBadge status={d.status} />
                        <div className="text-xs text-muted-foreground">Offer: {formatMoney(d.offerPrice)}</div>
                        <div className="text-xs text-muted-foreground">Final: {formatMoney(d.finalPrice)}</div>
                      </div>
                      <div className="mt-3">
                        <DealProgress status={d.status} />
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">Buyer: {d?.buyer?.email || '—'}</div>
                      <div className="text-xs text-muted-foreground">Agent: {d?.agent?.email || '—'}</div>
                      {d?.notes ? <div className="mt-2 whitespace-pre-wrap text-xs text-muted-foreground">{d.notes}</div> : null}
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <Button variant="outline" onClick={() => openDocuments(d)} disabled={isLoading}>
                        Documents
                      </Button>
                      <Button variant="outline" onClick={() => openStatusModal(d)} disabled={isLoading}>
                        Override status
                      </Button>
                      <Button variant="outline" onClick={() => cancelDeal(d)} disabled={isLoading}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <DealDocumentsModal
        open={docsOpen}
        dealId={docsDeal?.id}
        dealTitle={docsDeal?.property?.title}
        onClose={() => {
          if (isLoading) return;
          setDocsOpen(false);
          setDocsDeal(null);
        }}
      />

      <Modal
        open={statusOpen}
        title="Override deal status"
        onClose={() => {
          if (isLoading) return;
          setStatusOpen(false);
          setSelectedDeal(null);
        }}
        footer={
          <>
            <Button
              variant="outline"
              onClick={() => {
                if (isLoading) return;
                setStatusOpen(false);
                setSelectedDeal(null);
              }}
            >
              Cancel
            </Button>
            <Button variant="outline" onClick={submitStatus} disabled={isLoading || !nextStatus}>
              Save
            </Button>
          </>
        }
      >
        <div className="text-sm text-muted-foreground">
          Updating: <span className="text-foreground">{selectedDeal?.property?.title || 'Property'}</span>
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Status</label>
          <select
            value={nextStatus}
            onChange={(e) => setNextStatus(e.target.value)}
            className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm"
          >
            <option value="open">Open</option>
            <option value="negotiation">Negotiation</option>
            <option value="agreement_pending">Agreement pending</option>
            <option value="closed_won">Closed won</option>
            <option value="closed_lost">Closed lost</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
        {nextStatus === 'closed_won' ? (
          <div>
            <label className="text-xs text-muted-foreground">Final price</label>
            <input
              type="number"
              min="1"
              value={finalPrice}
              onChange={(e) => setFinalPrice(e.target.value)}
              className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"
            />
          </div>
        ) : null}
        <div>
          <label className="text-xs text-muted-foreground">Notes (optional)</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"
          />
        </div>
      </Modal>
    </div>
  );
}
