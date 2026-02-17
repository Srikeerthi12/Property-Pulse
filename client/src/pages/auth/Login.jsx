import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';

import { useAuth } from '../../context/AuthContext.jsx';
import { getHomePathForRole } from '../../utils/role.js';
import { Button } from '../../components/ui/button.jsx';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card.jsx';
import { Input } from '../../components/ui/input.jsx';
import { Label } from '../../components/ui/label.jsx';
import { LogIn, RefreshCw } from 'lucide-react';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [reactivatePrompt, setReactivatePrompt] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  async function onSubmit(e) {
    e.preventDefault();
    setError(null);
    setReactivatePrompt(false);

    try {
      const result = await login({ email, password });

      const from = location.state?.from?.pathname;
      const roleNext = getHomePathForRole(result?.user?.role);
      const next = from || roleNext;

      navigate(next, { replace: true });
    } catch (err) {
      const payload = err?.response?.data;
      const message = payload?.error || err?.message || 'Login failed';
      setError(message);
      if (payload?.code === 'ACCOUNT_DEACTIVATED' && payload?.canReactivate) {
        setReactivatePrompt(true);
      }
    }
  }

  return (
    <main className="min-h-screen bg-muted/40 flex items-center justify-center p-6">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Welcome back</CardTitle>
          <CardDescription>Sign in to continue to PropertyPulse.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                placeholder="name@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                placeholder="••••••••"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
              />
            </div>

            {error ? (
              <div role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm">
                {error}
              </div>
            ) : null}

            {reactivatePrompt ? (
              <div className="grid gap-2">
                <div className="text-sm text-muted-foreground">
                  Your account is deactivated. Reactivate it to sign in.
                </div>
                <Button
                  type="button"
                  variant="outline"
                  onClick={async () => {
                    setError(null);
                    try {
                      const { reactivate } = await import('../../services/authService.js');
                      const result = await reactivate({ email, password });
                      const from = location.state?.from?.pathname;
                      const roleNext = getHomePathForRole(result?.user?.role);
                      navigate(from || roleNext, { replace: true });
                    } catch (err) {
                      const message = err?.response?.data?.error || err?.message || 'Reactivation failed';
                      setError(message);
                    }
                  }}
                >
                  <RefreshCw className="h-4 w-4" />
                  Reactivate & sign in
                </Button>
              </div>
            ) : null}

            <Button type="submit" className="w-full">
              <LogIn className="h-4 w-4" />
              Sign in
            </Button>
          </form>

          <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
            <Link className="hover:underline" to="/register">
              Create account
            </Link>
            <Link className="hover:underline" to="/forgot-password">
              Forgot password?
            </Link>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
