import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import { api } from '../../services/api.js';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card.jsx';
import { Button } from '../../components/ui/button.jsx';
import { RefreshCw } from 'lucide-react';

function Stat({ label, value }) {
  return (
    <div className="rounded-lg border bg-background p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-lg font-semibold">{value ?? 0}</div>
    </div>
  );
}

export default function AdminDashboard() {
  const [stats, setStats] = useState(null);
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  async function refresh() {
    setIsLoading(true);
    setError(null);
    try {
      const [statsRes] = await Promise.all([api.get('/api/admin/stats')]);
      setStats(statsRes?.data?.stats ?? null);
    } catch (err) {
      const status = err?.response?.status;
      const url = err?.config?.url;
      const baseURL = err?.config?.baseURL;
      const apiError = err?.response?.data?.error;
      const message = apiError || err?.message || 'Failed to load admin data';
      setError(
        `${status ? `(${status}) ` : ''}${baseURL ? `${baseURL}` : ''}${url ? `${url}: ` : ''}${message}`,
      );
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);


  return (
    <main className="grid gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Admin dashboard</CardTitle>
          <CardDescription>Overview and shortcuts to admin tools.</CardDescription>
        </CardHeader>
        <CardContent>
          {error ? (
            <div role="alert" className="mb-4 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm">
              {error}
            </div>
          ) : null}

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Total" value={stats?.total} />
            <Stat label="Active" value={stats?.active} />
            <Stat label="Inactive" value={stats?.inactive} />
            <Stat label="Admins" value={stats?.admins} />
          </div>

          <div className="mt-4 flex items-center justify-end">
            <Button variant="outline" onClick={refresh} disabled={isLoading}>
              <RefreshCw className="h-4 w-4" />
              {isLoading ? 'Refreshing…' : 'Refresh'}
            </Button>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <Link to="/admin/users" className="rounded-lg border bg-background p-3 hover:bg-accent/20">
              <div className="text-sm font-medium">Users</div>
              <div className="mt-1 text-xs text-muted-foreground">Activate/deactivate accounts.</div>
            </Link>
            <Link to="/admin/properties" className="rounded-lg border bg-background p-3 hover:bg-accent/20">
              <div className="text-sm font-medium">Properties</div>
              <div className="mt-1 text-xs text-muted-foreground">Approve/reject and moderate listings.</div>
            </Link>
            <Link to="/admin/leads" className="rounded-lg border bg-background p-3 hover:bg-accent/20">
              <div className="text-sm font-medium">Leads</div>
              <div className="mt-1 text-xs text-muted-foreground">Review and reassign inquiries.</div>
            </Link>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
