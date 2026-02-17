import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import * as sellerLeadService from '../../services/sellerLeadService.js';
import { Button } from '../ui/button.jsx';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card.jsx';
import { ExternalLink, RefreshCw } from 'lucide-react';

export default function SellerLeadAnalytics() {
  const [leadSummary, setLeadSummary] = useState([]);
  const [leadDetail, setLeadDetail] = useState(null);
  const [selectedPropertyId, setSelectedPropertyId] = useState('');
  const [leadError, setLeadError] = useState(null);
  const [isLeadLoading, setIsLeadLoading] = useState(false);

  async function refreshLeadSummary() {
    setIsLeadLoading(true);
    setLeadError(null);
    try {
      const data = await sellerLeadService.listSellerPropertyLeads();
      setLeadSummary(data?.items ?? []);
    } catch (err) {
      const message = err?.response?.data?.error || err?.message || 'Failed to load lead summary';
      setLeadError(message);
    } finally {
      setIsLeadLoading(false);
    }
  }

  async function loadLeadDetail(propertyId) {
    if (!propertyId) {
      setLeadDetail(null);
      return;
    }

    setIsLeadLoading(true);
    setLeadError(null);
    try {
      const data = await sellerLeadService.getSellerPropertyLeadDetail(propertyId);
      const pct = Math.round((Number(data?.conversionRate || 0) * 100 + Number.EPSILON) * 10) / 10;
      const p = data?.property || {};

      setLeadDetail({
        property: p,
        conversionRatePct: pct,
        statusCounts: {
          new: Number(p.new || 0),
          contacted: Number(p.contacted || 0),
          visit_scheduled: Number(p.visitScheduled || 0),
          negotiation: Number(p.negotiation || 0),
          closed: Number(p.closed || 0),
          dropped: Number(p.dropped || 0),
        },
      });
    } catch (err) {
      const message = err?.response?.data?.error || err?.message || 'Failed to load lead detail';
      setLeadError(message);
    } finally {
      setIsLeadLoading(false);
    }
  }

  useEffect(() => {
    refreshLeadSummary();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Lead Analytics</CardTitle>
        <CardDescription>Inquiry interest across your listings.</CardDescription>
      </CardHeader>
      <CardContent>
        {leadError ? (
          <div role="alert" className="mb-4 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm">
            {leadError}
          </div>
        ) : null}

        <div className="flex items-center justify-end">
          <Button variant="outline" onClick={refreshLeadSummary} disabled={isLeadLoading}>
            <RefreshCw className="h-4 w-4" />
            {isLeadLoading ? 'Refreshing…' : 'Refresh'}
          </Button>
        </div>

        {isLeadLoading && leadSummary.length === 0 ? (
          <div className="mt-4 text-sm text-muted-foreground">Loading…</div>
        ) : leadSummary.length === 0 ? (
          <div className="mt-4 text-sm text-muted-foreground">No inquiry data yet.</div>
        ) : (
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            {leadSummary.map((p) => (
              <div key={p.propertyId} className="rounded-lg border bg-background p-3">
                <div className="truncate text-sm font-medium">{p.title || `Property ${p.propertyId}`}</div>
                <div className="mt-1 grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <div className="text-muted-foreground">Total</div>
                    <div className="font-medium">{p.totalInquiries ?? 0}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Active</div>
                    <div className="font-medium">
                      {Math.max(0, Number(p.totalInquiries || 0) - Number(p.closed || 0) - Number(p.dropped || 0))}
                    </div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Closed</div>
                    <div className="font-medium">{Number(p.closed || 0)}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Dropped</div>
                    <div className="font-medium">{Number(p.dropped || 0)}</div>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setSelectedPropertyId(String(p.propertyId));
                      loadLeadDetail(String(p.propertyId));
                    }}
                  >
                    View
                  </Button>
                  <Button asChild variant="outline">
                    <Link to={`/properties/${p.propertyId}`}>
                      <ExternalLink className="h-4 w-4" />
                      Open
                    </Link>
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <div>
            <label className="text-xs text-muted-foreground">Property</label>
            <select
              value={selectedPropertyId}
              onChange={(e) => {
                const next = e.target.value;
                setSelectedPropertyId(next);
                loadLeadDetail(next);
              }}
              className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm"
            >
              <option value="">—</option>
              {leadSummary.map((p) => (
                <option key={p.propertyId} value={String(p.propertyId)}>
                  {p.title || `Property ${p.propertyId}`}
                </option>
              ))}
            </select>
          </div>
          <div className="rounded-lg border bg-background p-3">
            <div className="text-xs text-muted-foreground">Conversion</div>
            <div className="text-lg font-semibold">{leadDetail?.conversionRatePct ?? 0}%</div>
            <div className="text-xs text-muted-foreground">(closed / total inquiries)</div>
          </div>
        </div>

        {leadDetail?.statusCounts ? (
          <div className="mt-4 rounded-lg border bg-background p-3">
            <div className="text-sm font-medium">Status breakdown</div>
            <div className="mt-2 grid gap-2 sm:grid-cols-3 text-xs">
              {Object.entries(leadDetail.statusCounts).map(([k, v]) => (
                <div key={k} className="rounded-md border bg-background p-2">
                  <div className="text-muted-foreground">{k}</div>
                  <div className="font-medium">{v}</div>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
