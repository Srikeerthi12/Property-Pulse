import { useEffect, useMemo, useState } from 'react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card.jsx';
import { Button } from '../../components/ui/button.jsx';
import StatusBadge from '../../components/common/StatusBadge.jsx';
import * as visitService from '../../services/visitService.js';

function toKey(v) {
  return v?.propertyId || v?.property?.id || '';
}

function toDateTime(visit) {
  if (visit?.scheduledAt) {
    const d = new Date(visit.scheduledAt);
    if (!Number.isNaN(d.getTime())) return d;
  }
  if (visit?.visitDate && visit?.visitTime) {
    const t = String(visit.visitTime).slice(0, 8);
    const d = new Date(`${visit.visitDate}T${t}`);
    if (!Number.isNaN(d.getTime())) return d;
  }
  return null;
}

export default function SellerVisits() {
  const [items, setItems] = useState([]);
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  async function refresh() {
    setIsLoading(true);
    setError(null);
    try {
      const data = await visitService.listVisits({ page: 1, limit: 500 });
      setItems(data?.items ?? []);
    } catch (err) {
      const message = err?.response?.data?.error || err?.message || 'Failed to load visits';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  const byProperty = useMemo(() => {
    const map = new Map();
    for (const v of items || []) {
      const key = toKey(v);
      if (!key) continue;
      if (!map.has(key)) {
        map.set(key, {
          property: v.property,
          total: 0,
          completed: 0,
          noShow: 0,
          upcoming: 0,
        });
      }
      const agg = map.get(key);
      agg.total += 1;
      if (v.status === 'completed') agg.completed += 1;
      if (v.status === 'no_show') agg.noShow += 1;
      const when = toDateTime(v);
      if (when && when.getTime() > Date.now() && v.status !== 'cancelled') agg.upcoming += 1;
    }
    return [...map.values()].sort((a, b) => (b.upcoming - a.upcoming) || (b.total - a.total));
  }, [items]);

  const upcoming = useMemo(() => {
    return [...(items || [])]
      .filter((v) => {
        const when = toDateTime(v);
        return when && when.getTime() > Date.now() && v.status !== 'cancelled';
      })
      .sort((a, b) => (toDateTime(a)?.getTime() ?? 0) - (toDateTime(b)?.getTime() ?? 0))
      .slice(0, 25);
  }, [items]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Visit activity</h1>
        <p className="text-sm text-muted-foreground">Monitor upcoming appointments and history per property.</p>
      </div>

      {error ? (
        <div role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm">
          {error}
        </div>
      ) : null}

      <div className="flex justify-end">
        <Button variant="outline" onClick={refresh} disabled={isLoading}>
          Refresh
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Upcoming visits</CardTitle>
          <CardDescription>Next appointments for your properties.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-sm text-muted-foreground">Loading…</div>
          ) : upcoming.length === 0 ? (
            <div className="text-sm text-muted-foreground">No upcoming visits.</div>
          ) : (
            <div className="grid gap-2">
              {upcoming.map((v) => (
                <div key={v.id} className="rounded-lg border bg-background p-3">
                  <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium">{v?.property?.title || 'Property'}</div>
                      <div className="truncate text-xs text-muted-foreground">{v?.property?.location || '—'}</div>
                      <div className="text-xs text-muted-foreground">
                        {v.visitDate || '—'} {v.visitTime ? `• ${String(v.visitTime).slice(0, 5)}` : ''}
                      </div>
                      <div className="text-xs text-muted-foreground">Buyer: {v?.buyer?.name || '—'}</div>
                      <div className="text-xs text-muted-foreground">Agent: {v?.agent?.name || '—'}</div>
                    </div>
                    <div className="mt-2 sm:mt-0">
                      <StatusBadge status={v.status} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Property visit history</CardTitle>
          <CardDescription>Totals by property.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-sm text-muted-foreground">Loading…</div>
          ) : byProperty.length === 0 ? (
            <div className="text-sm text-muted-foreground">No visits yet.</div>
          ) : (
            <div className="grid gap-2">
              {byProperty.map((p) => (
                <div key={p.property?.id} className="rounded-lg border bg-background p-3">
                  <div className="truncate text-sm font-medium">{p.property?.title || 'Property'}</div>
                  <div className="truncate text-xs text-muted-foreground">{p.property?.location || '—'}</div>
                  <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
                    <div className="rounded-md border bg-background p-2">
                      <div className="text-[11px] text-muted-foreground">Visits</div>
                      <div className="text-sm font-semibold">{p.total}</div>
                    </div>
                    <div className="rounded-md border bg-background p-2">
                      <div className="text-[11px] text-muted-foreground">Upcoming</div>
                      <div className="text-sm font-semibold">{p.upcoming}</div>
                    </div>
                    <div className="rounded-md border bg-background p-2">
                      <div className="text-[11px] text-muted-foreground">Completed</div>
                      <div className="text-sm font-semibold">{p.completed}</div>
                    </div>
                    <div className="rounded-md border bg-background p-2">
                      <div className="text-[11px] text-muted-foreground">No show</div>
                      <div className="text-sm font-semibold">{p.noShow}</div>
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
