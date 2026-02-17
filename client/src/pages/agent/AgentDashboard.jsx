import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import { useAuth } from '../../context/AuthContext.jsx';
import { api } from '../../services/api.js';
import { Button } from '../../components/ui/button.jsx';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card.jsx';
import { CheckCircle2, ExternalLink, Plus, RefreshCw, Send } from 'lucide-react';

export default function AgentDashboard() {
  const { user } = useAuth();

  const [items, setItems] = useState([]);
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  const [title, setTitle] = useState('');
  const [price, setPrice] = useState('');
  const [location, setLocation] = useState('');
  const [propertyType, setPropertyType] = useState('');
  const [submitNow, setSubmitNow] = useState(false);
  const [images, setImages] = useState(null);

  function errorFrom(err, fallback) {
    const data = err?.response?.data;
    if (data?.issues && Array.isArray(data.issues) && data.issues.length > 0) {
      const first = data.issues[0];
      const field = Array.isArray(first.path) && first.path.length ? String(first.path.join('.')) : '';
      const msg = first.message ? String(first.message) : 'Invalid payload';
      return field ? `${msg} (${field})` : msg;
    }
    return data?.error || err?.message || fallback;
  }

  async function refresh() {
    setIsLoading(true);
    setError(null);
    try {
      const { data } = await api.get('/api/properties/mine');
      setItems(data?.items ?? []);
    } catch (err) {
      const message = err?.response?.data?.error || err?.message || 'Failed to load your listings';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  async function createListing(e) {
    e.preventDefault();
    setError(null);
    try {
      const form = new FormData();
      form.set('title', title);
      if (price) form.set('price', price);
      if (location) form.set('location', location);
      if (propertyType) form.set('propertyType', propertyType);
      if (submitNow) form.set('submit', 'true');
      if (images && images.length) {
        for (const file of images) form.append('images', file);
      }

      await api.post('/api/properties', form, { headers: { 'Content-Type': 'multipart/form-data' } });

      setTitle('');
      setPrice('');
      setLocation('');
      setPropertyType('');
      setSubmitNow(false);
      setImages(null);

      await refresh();
    } catch (err) {
      setError(errorFrom(err, 'Failed to create listing'));
    }
  }

  async function submitListing(id) {
    setError(null);
    try {
      await api.post(`/api/properties/${id}/submit`);
      await refresh();
    } catch (err) {
      const message = err?.response?.data?.error || err?.message || 'Failed to submit listing';
      setError(message);
    }
  }

  async function inactivateListing(id) {
    setError(null);
    try {
      await api.patch(`/api/properties/${id}/inactive`);
      await refresh();
    } catch (err) {
      const message = err?.response?.data?.error || err?.message || 'Failed to inactivate listing';
      setError(message);
    }
  }

  return (
    <main className="grid gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Agent dashboard</CardTitle>
          <CardDescription>Signed in as {user?.email ?? 'unknown'}.</CardDescription>
        </CardHeader>
        <CardContent>
          {error ? (
            <div role="alert" className="mb-4 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm">
              {error}
            </div>
          ) : null}

          <form onSubmit={createListing} className="grid gap-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="text-xs text-muted-foreground">Title</label>
                <input
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Price</label>
                <input
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  inputMode="numeric"
                  className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Location</label>
                <input
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Property type</label>
                <select
                  value={propertyType}
                  onChange={(e) => setPropertyType(e.target.value)}
                  className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"
                >
                  <option value="">Select…</option>
                  <option value="flat">Flat</option>
                  <option value="villa">Villa</option>
                  <option value="land">Land</option>
                </select>
              </div>
            </div>

            <div>
              <label className="text-xs text-muted-foreground">Images</label>
              <input
                type="file"
                accept="image/png,image/jpeg"
                multiple
                onChange={(e) => setImages(e.target.files)}
                className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"
              />
              <div className="mt-1 text-xs text-muted-foreground">JPG/PNG only, up to 10 files, 5MB each.</div>
            </div>

            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={submitNow} onChange={(e) => setSubmitNow(e.target.checked)} />
              Submit for approval immediately
            </label>

            <div className="flex justify-end">
              <Button type="submit">
                <Plus className="h-4 w-4" />
                Create listing
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Your managed listings</CardTitle>
          <CardDescription>Drafts, pending approvals, and approved listings.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-3 flex items-center justify-end">
            <Button variant="outline" onClick={refresh} disabled={isLoading}>
              <RefreshCw className="h-4 w-4" />
              {isLoading ? 'Refreshing…' : 'Refresh'}
            </Button>
          </div>

          {items.length === 0 ? (
            <div className="text-sm text-muted-foreground">No listings yet.</div>
          ) : (
            <div className="grid gap-2">
              {items.map((p) => (
                <div key={p.id} className="flex flex-col gap-2 rounded-lg border bg-background p-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <div className="truncate font-serif text-sm font-medium">{p.title}</div>
                    <div className="text-xs text-muted-foreground">Status: {p.status}</div>
                    {p.rejectionReason ? (
                      <div className="text-xs text-destructive">Rejection: {p.rejectionReason}</div>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button asChild variant="outline">
                      <Link to={`/properties/${p.id}`}>
                        <ExternalLink className="h-4 w-4" />
                        Open
                      </Link>
                    </Button>
                    {['draft', 'rejected'].includes(p.status) ? (
                      <Button variant="outline" onClick={() => submitListing(p.id)}>
                        <Send className="h-4 w-4" />
                        Submit
                      </Button>
                    ) : null}
                    {p.status !== 'inactive' && p.status !== 'sold' ? (
                      <Button variant="outline" onClick={() => inactivateListing(p.id)}>
                        <CheckCircle2 className="h-4 w-4" />
                        Inactivate
                      </Button>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
