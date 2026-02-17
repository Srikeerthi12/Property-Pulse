import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import { listFavorites } from '../../services/favoriteService.js';

export default function BuyerSaved() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        const data = await listFavorites();
        const rows = Array.isArray(data) ? data : data?.items ?? [];
        if (mounted) setItems(rows);
      } catch (e) {
        if (mounted) setError(e?.response?.data?.message || e?.message || 'Failed to load saved properties');
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Saved Properties</h1>
        <p className="text-sm text-muted-foreground">Quick access to properties you’ve saved.</p>
      </div>

      {error ? <div className="text-sm text-red-600">{error}</div> : null}
      {loading ? (
        <div className="text-sm text-muted-foreground">Loading…</div>
      ) : items.length === 0 ? (
        <div className="text-sm text-muted-foreground">No saved properties.</div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {items.map((fav) => {
            const id = fav?.propertyId || fav?.property_id;
            const title = fav?.title || fav?.propertyTitle || fav?.property_title || 'Property';
            const location = fav?.location || fav?.address || '';
            return (
              <Link
                key={fav?.favoriteId || fav?.favorite_id || `${id}`}
                to={id ? `/properties/${id}` : '#'}
                className="rounded-lg border bg-card p-4 hover:bg-accent/30"
              >
                <div className="font-medium">{title}</div>
                {location ? <div className="text-sm text-muted-foreground">{location}</div> : null}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
