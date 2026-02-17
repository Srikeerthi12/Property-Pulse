import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';

import { useAuth } from '../context/AuthContext.jsx';
import { api } from '../services/api.js';
import { apiAbsoluteUrl } from '../utils/apiUrl.js';
import { Button } from '../components/ui/button.jsx';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card.jsx';
import { PauseCircle, Save, Send, Star, Trash2 } from 'lucide-react';
import * as inquiryService from '../services/inquiryService.js';
import * as favoriteService from '../services/favoriteService.js';

export default function PropertyDetails() {
  const { id } = useParams();
  const { user } = useAuth();
  const [property, setProperty] = useState(null);
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [imagesToAdd, setImagesToAdd] = useState(null);

  const [buyerMessage, setBuyerMessage] = useState('');
  const [buyerActionError, setBuyerActionError] = useState(null);
  const [buyerActionOk, setBuyerActionOk] = useState(null);
  const [inquiry, setInquiry] = useState(null);
  const [favoriteId, setFavoriteId] = useState(null);
  const [isBuyerActionLoading, setIsBuyerActionLoading] = useState(false);

  const [edit, setEdit] = useState({
    title: '',
    price: '',
    location: '',
    area: '',
    propertyType: '',
    description: '',
    amenities: '',
  });

  const canEdit =
    property &&
    (user?.role === 'admin' || property?.sellerId === user?.id) &&
    ['draft', 'rejected'].includes(property.status);

  const isBuyer = String(user?.role || '').toLowerCase() === 'buyer';

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setIsLoading(true);
      setError(null);
      try {
        const { data } = await api.get(`/api/properties/${id}`);
        if (!cancelled) setProperty(data?.property ?? null);
      } catch (err) {
        const message = err?.response?.data?.error || err?.message || 'Failed to load property';
        if (!cancelled) setError(message);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [id]);

  useEffect(() => {
    if (!property?.id) return;
    if (property.status !== 'approved') return;

    const role = String(user?.role || '').toLowerCase();
    const isOwner = user?.id && property?.sellerId && user.id === property.sellerId;
    const isAdmin = role === 'admin';
    if (isOwner || isAdmin) return;

    const key = `pp:viewed:${property.id}`;
    const now = Date.now();
    const windowMs = 30 * 60 * 1000;

    try {
      const last = Number(localStorage.getItem(key) || '0');
      if (Number.isFinite(last) && last > 0 && now - last < windowMs) return;
      localStorage.setItem(key, String(now));
    } catch {
      // If localStorage is unavailable, we still try once.
    }

    api.post(`/api/properties/${property.id}/view`).catch(() => {
      // Best-effort only; don't block the page.
    });
  }, [property?.id, property?.status, property?.sellerId, user?.id, user?.role]);

  useEffect(() => {
    let cancelled = false;

    async function loadBuyerState() {
      if (!isBuyer || !property?.id) return;
      try {
        const fav = await favoriteService.listFavorites();
        const match = (fav?.items ?? []).find((f) => f.propertyId === property.id);
        if (!cancelled) setFavoriteId(match?.favoriteId ?? null);
      } catch {
        // ignore (wishlist is optional UI state)
      }

      try {
        const mine = await inquiryService.listMyInquiries({ page: 1, limit: 50 });
        const match = (mine?.items ?? []).find((i) => i.propertyId === property.id);
        if (!cancelled) setInquiry(match ?? null);
      } catch {
        // ignore
      }
    }

    loadBuyerState();
    return () => {
      cancelled = true;
    };
  }, [isBuyer, property?.id]);

  useEffect(() => {
    if (!property) return;
    setEdit({
      title: property.title ?? '',
      price: typeof property.price === 'number' ? String(property.price) : property.price ? String(property.price) : '',
      location: property.location ?? '',
      area: property.area ? String(property.area) : '',
      propertyType: property.propertyType ?? '',
      description: property.description ?? '',
      amenities: Array.isArray(property.amenities) ? property.amenities.join(', ') : '',
    });
  }, [property]);

  async function saveChanges() {
    setError(null);
    setIsSaving(true);
    try {
      const form = new FormData();
      if (edit.title) form.set('title', edit.title);
      if (edit.price !== '') form.set('price', edit.price);
      if (edit.location) form.set('location', edit.location);
      if (edit.area !== '') form.set('area', edit.area);
      if (edit.propertyType) form.set('propertyType', edit.propertyType);
      if (edit.description) form.set('description', edit.description);
      if (edit.amenities) {
        const list = edit.amenities
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean);
        form.set('amenities', JSON.stringify(list));
      }
      if (imagesToAdd && imagesToAdd.length) {
        for (const file of imagesToAdd) form.append('images', file);
      }

      const { data } = await api.patch(`/api/properties/${id}`, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setProperty(data?.property ?? null);
      setImagesToAdd(null);
    } catch (err) {
      const message = err?.response?.data?.error || err?.message || 'Failed to save changes';
      setError(message);
    } finally {
      setIsSaving(false);
    }
  }

  async function deleteImage(imageId) {
    setError(null);
    setIsSaving(true);
    try {
      await api.delete(`/api/properties/${id}/images/${imageId}`);
      const { data } = await api.get(`/api/properties/${id}`);
      setProperty(data?.property ?? null);
    } catch (err) {
      const message = err?.response?.data?.error || err?.message || 'Failed to delete image';
      setError(message);
    } finally {
      setIsSaving(false);
    }
  }

  async function submitForApproval() {
    setError(null);
    setIsSaving(true);
    try {
      const { data } = await api.post(`/api/properties/${id}/submit`);
      setProperty(data?.property ?? null);
    } catch (err) {
      const message = err?.response?.data?.error || err?.message || 'Failed to submit property';
      setError(message);
    } finally {
      setIsSaving(false);
    }
  }

  async function markInactive() {
    setError(null);
    setIsSaving(true);
    try {
      const { data } = await api.patch(`/api/properties/${id}/inactive`);
      setProperty(data?.property ?? null);
    } catch (err) {
      const message = err?.response?.data?.error || err?.message || 'Failed to mark inactive';
      setError(message);
    } finally {
      setIsSaving(false);
    }
  }

  async function toggleFavorite() {
    setBuyerActionError(null);
    setBuyerActionOk(null);
    setIsBuyerActionLoading(true);
    try {
      if (!property?.id) return;

      if (favoriteId) {
        await favoriteService.removeFavorite(favoriteId);
        setFavoriteId(null);
        setBuyerActionOk('Removed from favorites.');
      } else {
        const res = await favoriteService.addFavorite(property.id);
        // API returns { ok: true } on duplicate; refresh list to get id.
        if (res?.favorite?.id) {
          setFavoriteId(res.favorite.id);
        } else {
          const fav = await favoriteService.listFavorites();
          const match = (fav?.items ?? []).find((f) => f.propertyId === property.id);
          setFavoriteId(match?.favoriteId ?? null);
        }
        setBuyerActionOk('Saved to favorites.');
      }
    } catch (err) {
      const message = err?.response?.data?.error || err?.message || 'Failed to update favorites';
      setBuyerActionError(message);
    } finally {
      setIsBuyerActionLoading(false);
    }
  }

  async function sendInquiry() {
    setBuyerActionError(null);
    setBuyerActionOk(null);
    setIsBuyerActionLoading(true);
    try {
      if (!property?.id) return;
      const res = await inquiryService.createInquiry({
        propertyId: property.id,
        message: buyerMessage?.trim() ? buyerMessage.trim() : null,
      });
      setInquiry(res?.inquiry ?? null);
      setBuyerMessage('');
      setBuyerActionOk('Inquiry sent. Agent will contact you.');
    } catch (err) {
      const status = err?.response?.status;
      const message = err?.response?.data?.error || err?.message || 'Failed to send inquiry';
      setBuyerActionError(status === 409 ? 'You already sent an inquiry for this property.' : message);
    } finally {
      setIsBuyerActionLoading(false);
    }
  }

  return (
    <main className="grid gap-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-center font-serif">Property Details</CardTitle>
          <CardDescription className="text-center">Property id: {id}</CardDescription>
        </CardHeader>
        <CardContent>
          {error ? (
            <div role="alert" className="mb-4 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm">
              {error}
            </div>
          ) : null}

          {isLoading ? (
            <div className="text-sm text-muted-foreground">Loading…</div>
          ) : !property ? (
            <div className="text-sm text-muted-foreground">No property found.</div>
          ) : (
            <div className="grid gap-4">
              <div className="grid gap-2">
                <div className="text-lg font-semibold">{property.title}</div>
                <div className="text-sm text-muted-foreground">{property.location || '—'}</div>
                <div className="text-sm">
                  {typeof property.price === 'number' ? `₹${property.price.toLocaleString()}` : 'Price on request'}
                </div>
                <div className="text-xs text-muted-foreground">Status: {property.status}</div>
                <div className="text-xs text-muted-foreground">Views: {property.viewCount ?? 0}</div>
                {property.rejectionReason ? (
                  <div className="text-xs text-destructive">Rejection: {property.rejectionReason}</div>
                ) : null}
                {property.seller ? (
                  <div className="text-xs text-muted-foreground">
                    Listed by: {property.seller.name} ({property.seller.role})
                  </div>
                ) : null}
                {property.area ? (
                  <div className="text-xs text-muted-foreground">Area: {property.area}</div>
                ) : null}
                {Array.isArray(property.amenities) && property.amenities.length ? (
                  <div className="text-xs text-muted-foreground">Amenities: {property.amenities.join(', ')}</div>
                ) : null}
              </div>

              {property.images?.length ? (
                <div className="grid gap-2">
                  <div className="text-sm font-medium">Images</div>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {property.images.map((img) => (
                      <a
                        key={img.id}
                        href={apiAbsoluteUrl(img.imageUrl)}
                        target="_blank"
                        rel="noreferrer"
                        className="overflow-hidden rounded-md border bg-muted"
                      >
                        <img src={apiAbsoluteUrl(img.imageUrl)} alt="Property" className="h-32 w-full object-cover" loading="lazy" />
                      </a>
                    ))}
                  </div>
                </div>
              ) : null}

              {property.description ? (
                <div className="grid gap-2">
                  <div className="text-sm font-medium">Description</div>
                  <div className="whitespace-pre-wrap text-sm text-muted-foreground">{property.description}</div>
                </div>
              ) : null}

              {isBuyer && property.status === 'approved' ? (
                <div className="grid gap-3 rounded-lg border bg-background p-4">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <div className="text-sm font-medium">Buyer actions</div>
                      <div className="text-xs text-muted-foreground">
                        Express interest to create a lead, or save to wishlist.
                      </div>
                    </div>
                    <Button variant="outline" onClick={toggleFavorite} disabled={isBuyerActionLoading}>
                      <Star className="h-4 w-4" />
                      {favoriteId ? 'Unsave' : 'Save'}
                    </Button>
                  </div>

                  {buyerActionError ? (
                    <div role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm">
                      {buyerActionError}
                    </div>
                  ) : null}
                  {buyerActionOk ? (
                    <div className="rounded-md border bg-accent/20 px-3 py-2 text-sm">{buyerActionOk}</div>
                  ) : null}

                  <div className="grid gap-2">
                    <label className="text-xs text-muted-foreground">Message (optional)</label>
                    <textarea
                      value={buyerMessage}
                      onChange={(e) => setBuyerMessage(e.target.value)}
                      rows={3}
                      placeholder="I want to visit this property."
                      className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                    />
                    <div className="flex justify-end">
                      <Button onClick={sendInquiry} disabled={isBuyerActionLoading || Boolean(inquiry)}>
                        <Send className="h-4 w-4" />
                        {inquiry ? 'Inquiry sent' : "I'm Interested"}
                      </Button>
                    </div>
                  </div>

                  {inquiry ? (
                    <div className="grid gap-1 rounded-md border bg-background px-3 py-2 text-sm">
                      <div className="text-xs text-muted-foreground">Your lead status</div>
                      <div>Status: {inquiry.status}</div>
                      <div className="text-xs text-muted-foreground">
                        Agent: {inquiry.agent?.name || 'Unassigned'}{inquiry.agent?.email ? ` (${inquiry.agent.email})` : ''}
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : null}

              {canEdit ? (
                <div className="grid gap-3 rounded-lg border bg-background p-4">
                  <div className="text-sm font-medium">Edit listing</div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <label className="text-xs text-muted-foreground">Title</label>
                      <input
                        value={edit.title}
                        onChange={(e) => setEdit((p) => ({ ...p, title: e.target.value }))}
                        className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground">Price</label>
                      <input
                        value={edit.price}
                        onChange={(e) => setEdit((p) => ({ ...p, price: e.target.value }))}
                        inputMode="numeric"
                        className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground">Location</label>
                      <input
                        value={edit.location}
                        onChange={(e) => setEdit((p) => ({ ...p, location: e.target.value }))}
                        className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground">Area</label>
                      <input
                        value={edit.area}
                        onChange={(e) => setEdit((p) => ({ ...p, area: e.target.value }))}
                        inputMode="numeric"
                        className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground">Property type</label>
                      <select
                        value={edit.propertyType}
                        onChange={(e) => setEdit((p) => ({ ...p, propertyType: e.target.value }))}
                        className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm"
                      >
                        <option value="">—</option>
                        <option value="flat">Flat</option>
                        <option value="villa">Villa</option>
                        <option value="land">Land</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground">Amenities (comma separated)</label>
                      <input
                        value={edit.amenities}
                        onChange={(e) => setEdit((p) => ({ ...p, amenities: e.target.value }))}
                        className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-xs text-muted-foreground">Description</label>
                    <textarea
                      value={edit.description}
                      onChange={(e) => setEdit((p) => ({ ...p, description: e.target.value }))}
                      rows={4}
                      className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"
                    />
                  </div>

                  <div>
                    <label className="text-xs text-muted-foreground">Add images</label>
                    <input
                      type="file"
                      accept="image/png,image/jpeg"
                      multiple
                      onChange={(e) => setImagesToAdd(e.target.files)}
                      className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"
                    />
                  </div>

                  {property.images?.length ? (
                    <div className="grid gap-2">
                      <div className="text-xs text-muted-foreground">Remove existing images</div>
                      <div className="flex flex-wrap gap-2">
                        {property.images.map((img) => (
                          <Button key={img.id} variant="outline" onClick={() => deleteImage(img.id)} disabled={isSaving}>
                            <Trash2 className="h-4 w-4" />
                            Delete image
                          </Button>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  <div className="flex flex-wrap justify-end gap-2">
                    <Button variant="outline" onClick={saveChanges} disabled={isSaving}>
                      <Save className="h-4 w-4" />
                      {isSaving ? 'Saving…' : 'Save changes'}
                    </Button>
                    <Button onClick={submitForApproval} disabled={isSaving}>
                      <Send className="h-4 w-4" />
                      Submit for approval
                    </Button>
                    <Button variant="outline" onClick={markInactive} disabled={isSaving}>
                      <PauseCircle className="h-4 w-4" />
                      Mark inactive
                    </Button>
                  </div>
                </div>
              ) : null}
            </div>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
