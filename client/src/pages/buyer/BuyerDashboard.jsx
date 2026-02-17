import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import { useAuth } from '../../context/AuthContext.jsx';
import { api } from '../../services/api.js';
import { apiAbsoluteUrl } from '../../utils/apiUrl.js';
import * as inquiryService from '../../services/inquiryService.js';
import * as favoriteService from '../../services/favoriteService.js';
import { Button } from '../../components/ui/button.jsx';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card.jsx';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export default function BuyerDashboard() {
  const { user } = useAuth();

  const [items, setItems] = useState([]);
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  const [inquiries, setInquiries] = useState([]);
  const [favorites, setFavorites] = useState([]);
  const [crmError, setCrmError] = useState(null);
  const [isCrmLoading, setIsCrmLoading] = useState(false);

  const [q, setQ] = useState('');
  const [location, setLocation] = useState('');
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [propertyType, setPropertyType] = useState('');
  const [sort, setSort] = useState('newest');
  const [page, setPage] = useState(1);

  const query = useMemo(
    () => ({
      q,
      location,
      minPrice: minPrice ? Number(minPrice) : undefined,
      maxPrice: maxPrice ? Number(maxPrice) : undefined,
      propertyType: propertyType || undefined,
      sort,
      page,
      limit: 10,
    }),
    [q, location, minPrice, maxPrice, propertyType, sort, page],
  );

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setIsLoading(true);
      setError(null);
      try {
        const { data } = await api.get('/api/properties', { params: query });
        if (!cancelled) setItems(data?.items ?? []);
      } catch (err) {
        const message = err?.response?.data?.error || err?.message || 'Failed to load properties';
        if (!cancelled) setError(message);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [query]);

  async function loadCrm() {
    setIsCrmLoading(true);
    setCrmError(null);
    try {
      const [inq, fav] = await Promise.all([
        inquiryService.listMyInquiries({ page: 1, limit: 50 }),
        favoriteService.listFavorites(),
      ]);
      setInquiries(inq?.items ?? []);
      setFavorites(fav?.items ?? []);
    } catch (err) {
      const message = err?.response?.data?.error || err?.message || 'Failed to load CRM data';
      setCrmError(message);
    } finally {
      setIsCrmLoading(false);
    }
  }

  useEffect(() => {
    loadCrm();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <main className="grid gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Buyer dashboard</CardTitle>
          <CardDescription>Signed in as {user?.email ?? 'unknown'}.</CardDescription>
        </CardHeader>
        <CardContent>
          {crmError ? (
            <div
              role="alert"
              className="mb-4 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm"
            >
              {crmError}
            </div>
          ) : null}

          <div className="grid gap-3 md:grid-cols-3">
            <Link to="/buyer/inquiries" className="rounded-lg border bg-background p-3 hover:bg-accent/20">
              <div className="text-sm font-medium">My inquiries</div>
              <div className="mt-1 text-xs text-muted-foreground">View your inquiry pipeline.</div>
              <div className="mt-3 text-lg font-semibold">{isCrmLoading ? '—' : inquiries.length}</div>
            </Link>

            <Link to="/buyer/saved" className="rounded-lg border bg-background p-3 hover:bg-accent/20">
              <div className="text-sm font-medium">Saved properties</div>
              <div className="mt-1 text-xs text-muted-foreground">Your wishlist.</div>
              <div className="mt-3 text-lg font-semibold">{isCrmLoading ? '—' : favorites.length}</div>
            </Link>

            <div className="rounded-lg border bg-background p-3">
              <div className="text-sm font-medium">Quick actions</div>
              <div className="mt-1 text-xs text-muted-foreground">Jump to your CRM pages.</div>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button asChild variant="outline">
                  <Link to="/buyer/inquiries">Open inquiries</Link>
                </Button>
                <Button asChild variant="outline">
                  <Link to="/buyer/saved">Open saved</Link>
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Search filters</CardTitle>
          <CardDescription>Find approved listings.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <label className="text-xs text-muted-foreground">Search</label>
              <input
                value={q}
                onChange={(e) => {
                  setPage(1);
                  setQ(e.target.value);
                }}
                placeholder="Title / description"
                className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Location</label>
              <input
                value={location}
                onChange={(e) => {
                  setPage(1);
                  setLocation(e.target.value);
                }}
                placeholder="City / area"
                className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Min price</label>
              <input
                value={minPrice}
                onChange={(e) => {
                  setPage(1);
                  setMinPrice(e.target.value);
                }}
                inputMode="numeric"
                placeholder="0"
                className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Max price</label>
              <input
                value={maxPrice}
                onChange={(e) => {
                  setPage(1);
                  setMaxPrice(e.target.value);
                }}
                inputMode="numeric"
                placeholder="Any"
                className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Property type</label>
              <select
                value={propertyType}
                onChange={(e) => {
                  setPage(1);
                  setPropertyType(e.target.value);
                }}
                className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm"
              >
                <option value="">All</option>
                <option value="flat">Flat</option>
                <option value="villa">Villa</option>
                <option value="land">Land</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Sort</label>
              <select
                value={sort}
                onChange={(e) => {
                  setPage(1);
                  setSort(e.target.value);
                }}
                className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm"
              >
                <option value="newest">Newest</option>
                <option value="price_asc">Price: low → high</option>
                <option value="price_desc">Price: high → low</option>
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Marketplace</CardTitle>
          <CardDescription>Approved listings.</CardDescription>
        </CardHeader>
        <CardContent>
          {error ? (
            <div
              role="alert"
              className="mb-4 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm"
            >
              {error}
            </div>
          ) : null}

          {isLoading ? (
            <div className="text-sm text-muted-foreground">Loading…</div>
          ) : items.length === 0 ? (
            <div className="text-sm text-muted-foreground">No approved properties found.</div>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {items.map((p) => (
                <Link
                  key={p.id}
                  to={`/properties/${p.id}`}
                  className="flex gap-3 rounded-lg border bg-background p-3 hover:bg-accent/20"
                >
                  <div className="h-20 w-28 flex-shrink-0 overflow-hidden rounded-md border bg-muted">
                    {p.thumbnailUrl ? (
                      <img
                        src={apiAbsoluteUrl(p.thumbnailUrl)}
                        alt={p.title}
                        className="h-full w-full object-cover"
                        loading="lazy"
                      />
                    ) : null}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-serif text-sm font-medium">{p.title}</div>
                    <div className="truncate text-xs text-muted-foreground">{p.location || '—'}</div>
                    <div className="mt-1 text-sm">
                      {typeof p.price === 'number' ? `₹${p.price.toLocaleString()}` : 'Price on request'}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}

          <div className="mt-4 flex items-center justify-between">
            <Button variant="outline" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1 || isLoading}>
              <ChevronLeft className="h-4 w-4" />
              Prev
            </Button>
            <div className="text-xs text-muted-foreground">Page {page}</div>
            <Button variant="outline" onClick={() => setPage((p) => p + 1)} disabled={isLoading || items.length < 10}>
              Next
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
