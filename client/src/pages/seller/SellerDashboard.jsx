import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import { useAuth } from '../../context/AuthContext.jsx';
import { api } from '../../services/api.js';
import * as sellerLeadService from '../../services/sellerLeadService.js';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card.jsx';

export default function SellerDashboard() {
  const { user } = useAuth();
  const [propertyCount, setPropertyCount] = useState(null);
  const [totalInquiries, setTotalInquiries] = useState(null);
  const [error, setError] = useState(null);

  async function refreshOverview() {
    setError(null);
    try {
      const [mineRes, leadRes] = await Promise.all([
        api.get('/api/properties/mine'),
        sellerLeadService.listSellerPropertyLeads(),
      ]);
      const mine = mineRes?.data?.items ?? [];
      const leads = leadRes?.items ?? [];
      setPropertyCount(mine.length);
      setTotalInquiries(leads.reduce((sum, p) => sum + Number(p.totalInquiries || 0), 0));
    } catch (err) {
      const message = err?.response?.data?.error || err?.message || 'Failed to load overview';
      setError(message);
    }
  }

  useEffect(() => {
    refreshOverview();
  }, []);

  return (
    <main className="grid gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Seller dashboard</CardTitle>
          <CardDescription>Signed in as {user?.email ?? 'unknown'}.</CardDescription>
        </CardHeader>
        <CardContent>
          {error ? (
            <div role="alert" className="mb-4 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm">
              {error}
            </div>
          ) : null}

          <div className="grid gap-3 sm:grid-cols-3">
            <Link to="/seller/properties" className="rounded-lg border bg-background p-3 hover:bg-accent/20">
              <div className="text-xs text-muted-foreground">My properties</div>
              <div className="text-lg font-semibold">{propertyCount ?? '—'}</div>
              <div className="mt-1 text-xs text-muted-foreground">Create and manage listings.</div>
            </Link>

            <Link to="/seller/analytics" className="rounded-lg border bg-background p-3 hover:bg-accent/20">
              <div className="text-xs text-muted-foreground">Total inquiries</div>
              <div className="text-lg font-semibold">{totalInquiries ?? '—'}</div>
              <div className="mt-1 text-xs text-muted-foreground">View conversion and status breakdown.</div>
            </Link>

            <div className="rounded-lg border bg-background p-3">
              <div className="text-xs text-muted-foreground">Shortcuts</div>
              <div className="mt-3 flex flex-wrap gap-2">
                <Link className="rounded-md border px-3 py-2 text-sm hover:bg-accent/30" to="/seller/properties">
                  Manage properties
                </Link>
                <Link className="rounded-md border px-3 py-2 text-sm hover:bg-accent/30" to="/seller/analytics">
                  Lead analytics
                </Link>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
