import { useEffect, useState } from 'react';

import { api } from '../../services/api.js';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card.jsx';
import { Button } from '../../components/ui/button.jsx';
import { Check, ChevronLeft, ChevronRight, Filter, RefreshCw, Trash2, X } from 'lucide-react';

export default function AdminProperties() {
  const [pendingProperties, setPendingProperties] = useState([]);
  const [pendingSellerId, setPendingSellerId] = useState('');

  const [allProperties, setAllProperties] = useState([]);
  const [allPage, setAllPage] = useState(1);
  const [allStatus, setAllStatus] = useState('');
  const [allSellerId, setAllSellerId] = useState('');
  const [allQ, setAllQ] = useState('');
  const [allSort, setAllSort] = useState('newest');
  const [rejectReasons, setRejectReasons] = useState({});

  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  async function loadPending(sellerIdOverride) {
    const sellerId = typeof sellerIdOverride === 'string' ? sellerIdOverride : pendingSellerId;
    const params = {};
    if (sellerId?.trim()) params.sellerId = sellerId.trim();
    const pendingRes = await api.get('/api/admin/properties/pending', { params });
    setPendingProperties(pendingRes?.data?.items ?? []);
  }

  async function loadAll(pageOverride) {
    const params = {
      page: pageOverride ?? allPage,
      limit: 10,
      sort: allSort,
    };
    if (allStatus) params.status = allStatus;
    if (allSellerId?.trim()) params.sellerId = allSellerId.trim();
    if (allQ?.trim()) params.q = allQ.trim();
    const res = await api.get('/api/admin/properties', { params });
    setAllProperties(res?.data?.items ?? []);
  }

  async function refresh() {
    setIsLoading(true);
    setError(null);
    try {
      await Promise.all([loadPending(''), loadAll(1)]);
      setPendingSellerId('');
      setAllPage(1);
    } catch (err) {
      const status = err?.response?.status;
      const url = err?.config?.url;
      const baseURL = err?.config?.baseURL;
      const apiError = err?.response?.data?.error;
      const message = apiError || err?.message || 'Failed to load admin properties';
      setError(`${status ? `(${status}) ` : ''}${baseURL ? `${baseURL}` : ''}${url ? `${url}: ` : ''}${message}`);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function approveProperty(propertyId) {
    setError(null);
    try {
      await api.patch(`/api/admin/properties/${propertyId}/approve`);
      await refresh();
    } catch (err) {
      const status = err?.response?.status;
      const url = err?.config?.url;
      const baseURL = err?.config?.baseURL;
      const apiError = err?.response?.data?.error;
      const message = apiError || err?.message || 'Failed to approve property';
      setError(`${status ? `(${status}) ` : ''}${baseURL ? `${baseURL}` : ''}${url ? `${url}: ` : ''}${message}`);
    }
  }

  async function rejectProperty(propertyId) {
    setError(null);
    try {
      const reason = (rejectReasons[propertyId] || '').trim();
      await api.patch(`/api/admin/properties/${propertyId}/reject`, { reason });
      setRejectReasons((prev) => ({ ...prev, [propertyId]: '' }));
      await refresh();
    } catch (err) {
      const status = err?.response?.status;
      const url = err?.config?.url;
      const baseURL = err?.config?.baseURL;
      const apiError = err?.response?.data?.error;
      const message = apiError || err?.message || 'Failed to reject property';
      setError(`${status ? `(${status}) ` : ''}${baseURL ? `${baseURL}` : ''}${url ? `${url}: ` : ''}${message}`);
    }
  }

  async function removeProperty(propertyId) {
    setError(null);
    try {
      await api.delete(`/api/admin/properties/${propertyId}`);
      await Promise.all([loadPending(), loadAll(allPage)]);
    } catch (err) {
      const status = err?.response?.status;
      const url = err?.config?.url;
      const baseURL = err?.config?.baseURL;
      const apiError = err?.response?.data?.error;
      const message = apiError || err?.message || 'Failed to remove property';
      setError(`${status ? `(${status}) ` : ''}${baseURL ? `${baseURL}` : ''}${url ? `${url}: ` : ''}${message}`);
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Properties</h1>
        <p className="text-sm text-muted-foreground">Approve, reject, and moderate listings.</p>
      </div>

      {error ? (
        <div role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm">
          {error}
        </div>
      ) : null}

      <div className="flex items-center justify-end">
        <Button variant="outline" onClick={refresh} disabled={isLoading}>
          <RefreshCw className="h-4 w-4" />
          {isLoading ? 'Refreshing…' : 'Refresh'}
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Pending properties</CardTitle>
          <CardDescription>Approve or reject listings submitted by sellers.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-4 grid gap-3 sm:grid-cols-2">
            <div>
              <label className="text-xs text-muted-foreground">Filter by seller/agent id (optional)</label>
              <input
                value={pendingSellerId}
                onChange={(e) => setPendingSellerId(e.target.value)}
                placeholder="UUID"
                className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"
              />
            </div>
            <div className="flex items-end justify-end">
              <Button
                variant="outline"
                onClick={async () => {
                  setError(null);
                  try {
                    await loadPending();
                  } catch (err) {
                    const apiError = err?.response?.data?.error;
                    setError(apiError || err?.message || 'Failed to load pending properties');
                  }
                }}
              >
                <Filter className="h-4 w-4" />
                Apply
              </Button>
            </div>
          </div>

          <div className="grid gap-2">
            {pendingProperties.length === 0 ? (
              <div className="text-sm text-muted-foreground">No pending properties.</div>
            ) : (
              pendingProperties.map((p) => (
                <div key={p.id} className="rounded-lg border bg-background p-3">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium">{p.title}</div>
                      <div className="truncate text-xs text-muted-foreground">{p.location || '—'}</div>
                      <div className="text-xs text-muted-foreground">Seller: {p.sellerName || p.sellerId}</div>
                      <div className="text-xs text-muted-foreground">
                        Submitted: {p.createdAt ? new Date(p.createdAt).toLocaleString() : '—'}
                      </div>
                      <div className="text-xs text-muted-foreground">Images: {p.images?.length ?? 0}</div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button variant="outline" onClick={() => approveProperty(p.id)}>
                        <Check className="h-4 w-4" />
                        Approve
                      </Button>
                      <Button variant="outline" onClick={() => removeProperty(p.id)}>
                        <Trash2 className="h-4 w-4" />
                        Remove
                      </Button>
                    </div>
                  </div>

                  <div className="mt-3 grid gap-2">
                    <label className="text-xs text-muted-foreground">Rejection reason (required to reject)</label>
                    <input
                      value={rejectReasons[p.id] ?? ''}
                      onChange={(e) => setRejectReasons((prev) => ({ ...prev, [p.id]: e.target.value }))}
                      placeholder="Explain what needs to change"
                      className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                    />
                    <div className="flex justify-end">
                      <Button variant="outline" onClick={() => rejectProperty(p.id)}>
                        <X className="h-4 w-4" />
                        Reject
                      </Button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>All listings</CardTitle>
          <CardDescription>View and moderate all properties (any status).</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-4">
            <div>
              <label className="text-xs text-muted-foreground">Status</label>
              <select
                value={allStatus}
                onChange={(e) => {
                  setAllPage(1);
                  setAllStatus(e.target.value);
                }}
                className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm"
              >
                <option value="">All</option>
                <option value="draft">Draft</option>
                <option value="pending">Pending</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
                <option value="inactive">Inactive</option>
                <option value="sold">Sold</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Seller/agent id</label>
              <input
                value={allSellerId}
                onChange={(e) => {
                  setAllPage(1);
                  setAllSellerId(e.target.value);
                }}
                placeholder="UUID"
                className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Search</label>
              <input
                value={allQ}
                onChange={(e) => {
                  setAllPage(1);
                  setAllQ(e.target.value);
                }}
                placeholder="Title or description"
                className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Sort</label>
              <select
                value={allSort}
                onChange={(e) => {
                  setAllPage(1);
                  setAllSort(e.target.value);
                }}
                className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm"
              >
                <option value="newest">Newest</option>
                <option value="price_asc">Price: low → high</option>
                <option value="price_desc">Price: high → low</option>
              </select>
            </div>
          </div>

          <div className="mt-3 flex items-center justify-end gap-2">
            <Button
              variant="outline"
              onClick={async () => {
                setError(null);
                try {
                  await loadAll(1);
                } catch (err) {
                  const apiError = err?.response?.data?.error;
                  setError(apiError || err?.message || 'Failed to load properties');
                }
              }}
            >
              <Filter className="h-4 w-4" />
              Apply
            </Button>
          </div>

          <div className="mt-4 grid gap-2">
            {allProperties.length === 0 ? (
              <div className="text-sm text-muted-foreground">No properties found.</div>
            ) : (
              allProperties.map((p) => (
                <div
                  key={p.id}
                  className="flex flex-col gap-2 rounded-lg border bg-background p-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">{p.title}</div>
                    <div className="text-xs text-muted-foreground">Status: {p.status}</div>
                    <div className="text-xs text-muted-foreground">Seller: {p.sellerName || p.sellerId}</div>
                    <div className="text-xs text-muted-foreground">Views: {p.viewCount ?? 0}</div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" onClick={() => removeProperty(p.id)}>
                      <Trash2 className="h-4 w-4" />
                      Remove
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="mt-4 flex items-center justify-between">
            <Button
              variant="outline"
              onClick={async () => {
                const next = Math.max(1, allPage - 1);
                setAllPage(next);
                await loadAll(next);
              }}
              disabled={allPage <= 1}
            >
              <ChevronLeft className="h-4 w-4" />
              Prev
            </Button>
            <div className="text-xs text-muted-foreground">Page {allPage}</div>
            <Button
              variant="outline"
              onClick={async () => {
                const next = allPage + 1;
                setAllPage(next);
                await loadAll(next);
              }}
              disabled={allProperties.length < 10}
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
