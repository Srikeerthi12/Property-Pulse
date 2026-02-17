import { useEffect, useMemo, useState } from 'react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card.jsx';
import { Button } from '../../components/ui/button.jsx';
import StatusBadge from '../../components/common/StatusBadge.jsx';
import DealDocumentsModal from '../../components/deal/DealDocumentsModal.jsx';
import DealProgress from '../../components/deal/DealProgress.jsx';
import * as dealService from '../../services/dealService.js';

function formatMoney(value) {
  if (typeof value !== 'number') return '—';
  return `₹${value.toLocaleString()}`;
}

export default function SellerDeals() {
  const [items, setItems] = useState([]);
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  const [docsOpen, setDocsOpen] = useState(false);
  const [docsDeal, setDocsDeal] = useState(null);

  async function refresh() {
    setIsLoading(true);
    setError(null);
    try {
      const data = await dealService.listDeals({ page: 1, limit: 200 });
      setItems(data?.items ?? []);
    } catch (err) {
      const msg = err?.response?.data?.error || err?.message || 'Failed to load deals';
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  function openDocuments(d) {
    setDocsDeal(d);
    setDocsOpen(true);
  }

  const metrics = useMemo(() => {
    const active = items.filter((d) => !['closed_won', 'closed_lost', 'cancelled'].includes(d.status));
    const closedWon = items.filter((d) => d.status === 'closed_won');
    const closedAny = items.filter((d) => ['closed_won', 'closed_lost'].includes(d.status));
    const totalSales = closedWon.reduce((sum, d) => sum + (typeof d.finalPrice === 'number' ? d.finalPrice : 0), 0);

    return {
      total: items.length,
      active: active.length,
      closed: closedAny.length,
      totalSales,
    };
  }, [items]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Deals</h1>
        <p className="text-sm text-muted-foreground">Monitor transaction progress across your properties.</p>
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
            <CardDescription>All deals for your properties.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">{metrics.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Active</CardTitle>
            <CardDescription>Open / negotiation / pending.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">{metrics.active}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Closed</CardTitle>
            <CardDescription>Won or lost.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">{metrics.closed}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Total sales</CardTitle>
            <CardDescription>Sum of closed-won final prices.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">{formatMoney(metrics.totalSales)}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Property deals</CardTitle>
          <CardDescription>Latest deals (up to 200).</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-3 flex justify-end">
            <Button variant="outline" onClick={refresh} disabled={isLoading}>
              Refresh
            </Button>
          </div>

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
    </div>
  );
}
