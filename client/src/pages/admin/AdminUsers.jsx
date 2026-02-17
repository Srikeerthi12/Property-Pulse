import { useEffect, useState } from 'react';

import { api } from '../../services/api.js';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card.jsx';
import { Button } from '../../components/ui/button.jsx';
import { RefreshCw, UserMinus, UserPlus } from 'lucide-react';

export default function AdminUsers() {
  const [users, setUsers] = useState([]);
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  async function loadUsers() {
    setIsLoading(true);
    setError(null);
    try {
      const res = await api.get('/api/admin/users');
      setUsers(res?.data?.users ?? []);
    } catch (err) {
      const status = err?.response?.status;
      const url = err?.config?.url;
      const baseURL = err?.config?.baseURL;
      const apiError = err?.response?.data?.error;
      const message = apiError || err?.message || 'Failed to load users';
      setError(`${status ? `(${status}) ` : ''}${baseURL ? `${baseURL}` : ''}${url ? `${url}: ` : ''}${message}`);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadUsers();
  }, []);

  async function setActive(userId, isActive) {
    setError(null);
    try {
      const { data } = await api.patch(`/api/admin/users/${userId}/active`, { isActive });
      const updated = data?.user;
      if (updated) {
        setUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)));
      }
    } catch (err) {
      const status = err?.response?.status;
      const url = err?.config?.url;
      const baseURL = err?.config?.baseURL;
      const apiError = err?.response?.data?.error;
      const message = apiError || err?.message || 'Failed to update user';
      setError(`${status ? `(${status}) ` : ''}${baseURL ? `${baseURL}` : ''}${url ? `${url}: ` : ''}${message}`);
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Users</h1>
        <p className="text-sm text-muted-foreground">Activate/deactivate accounts.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>User management</CardTitle>
          <CardDescription>Manage access for agents, sellers, and buyers.</CardDescription>
        </CardHeader>
        <CardContent>
          {error ? (
            <div role="alert" className="mb-4 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm">
              {error}
            </div>
          ) : null}

          <div className="mb-3 flex items-center justify-end">
            <Button variant="outline" onClick={loadUsers} disabled={isLoading}>
              <RefreshCw className="h-4 w-4" />
              {isLoading ? 'Refreshing…' : 'Refresh'}
            </Button>
          </div>

          <div className="max-h-[70vh] overflow-y-auto pr-1">
            <div className="grid gap-2">
              {users.length === 0 ? (
                <div className="text-sm text-muted-foreground">No users found.</div>
              ) : (
                users.map((u) => (
                  <div
                    key={u.id}
                    className="flex flex-col gap-2 rounded-lg border bg-background p-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium">
                        {u.name} <span className="text-muted-foreground">({u.role})</span>
                      </div>
                      <div className="truncate text-xs text-muted-foreground">{u.email}</div>
                      <div className="text-xs text-muted-foreground">Status: {u.isActive ? 'Active' : 'Inactive'}</div>
                    </div>
                    <div className="flex gap-2">
                      {u.isActive ? (
                        <Button variant="outline" onClick={() => setActive(u.id, false)}>
                          <UserMinus className="h-4 w-4" />
                          Deactivate
                        </Button>
                      ) : (
                        <Button variant="outline" onClick={() => setActive(u.id, true)}>
                          <UserPlus className="h-4 w-4" />
                          Activate
                        </Button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
