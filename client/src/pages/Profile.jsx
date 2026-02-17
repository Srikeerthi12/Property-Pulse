import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { useAuth } from '../context/AuthContext.jsx';
import { api } from '../services/api.js';
import { Button } from '../components/ui/button.jsx';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card.jsx';
import { Input } from '../components/ui/input.jsx';
import { Label } from '../components/ui/label.jsx';
import { KeyRound, Save, UserX } from 'lucide-react';

export default function Profile() {
  const { user, setUser, logout } = useAuth();
  const navigate = useNavigate();

  const [name, setName] = useState(user?.name ?? '');
  const [email, setEmail] = useState(user?.email ?? '');
  const [profileError, setProfileError] = useState(null);
  const [profileSuccess, setProfileSuccess] = useState(null);
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [passwordError, setPasswordError] = useState(null);
  const [passwordSuccess, setPasswordSuccess] = useState(null);
  const [isSavingPassword, setIsSavingPassword] = useState(false);

  const [deactivatePassword, setDeactivatePassword] = useState('');
  const [deactivateError, setDeactivateError] = useState(null);
  const [isDeactivating, setIsDeactivating] = useState(false);

  useEffect(() => {
    setName(user?.name ?? '');
    setEmail(user?.email ?? '');
  }, [user?.name, user?.email]);

  async function onSaveProfile(e) {
    e.preventDefault();
    setProfileError(null);
    setProfileSuccess(null);
    setIsSavingProfile(true);

    try {
      const payload = { name, email };
      const { data } = await api.patch('/api/auth/me', payload);
      if (data?.user) setUser(data.user);
      setProfileSuccess('Profile updated.');
    } catch (err) {
      const apiError = err?.response?.data;
      const issues = Array.isArray(apiError?.issues)
        ? apiError.issues.map((i) => i?.message).filter(Boolean).join(', ')
        : null;
      setProfileError(issues || apiError?.error || err?.message || 'Failed to update profile');
    } finally {
      setIsSavingProfile(false);
    }
  }

  async function onChangePassword(e) {
    e.preventDefault();
    setPasswordError(null);
    setPasswordSuccess(null);
    setIsSavingPassword(true);

    try {
      await api.patch('/api/auth/me/password', { currentPassword, newPassword });
      setCurrentPassword('');
      setNewPassword('');
      setPasswordSuccess('Password updated.');
    } catch (err) {
      const apiError = err?.response?.data;
      const issues = Array.isArray(apiError?.issues)
        ? apiError.issues.map((i) => i?.message).filter(Boolean).join(', ')
        : null;
      setPasswordError(issues || apiError?.error || err?.message || 'Failed to change password');
    } finally {
      setIsSavingPassword(false);
    }
  }

  return (
    <main className="p-6">
      <h1 className="text-xl font-semibold">Profile</h1>

      <div className="mt-6 grid gap-6 max-w-xl">
        <Card>
          <CardHeader>
            <CardTitle>Profile details</CardTitle>
            <CardDescription>View your role and account status, and update your name.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-2 text-sm">
              <div>
                <span className="text-muted-foreground">Email: </span>
                <span className="font-medium">{user?.email}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Role: </span>
                <span className="font-medium">{user?.role}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Status: </span>
                <span className="font-medium">{user?.isActive ? 'Active' : 'Inactive'}</span>
              </div>
            </div>

            <form onSubmit={onSaveProfile} className="mt-4 grid gap-3">
              <div className="grid gap-2">
                <Label htmlFor="name">Name</Label>
                <Input id="name" value={name} onChange={(e) => setName(e.target.value)} />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
              </div>

              {profileError ? (
                <div role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm">
                  {profileError}
                </div>
              ) : null}
              {profileSuccess ? (
                <div role="status" className="rounded-md border px-3 py-2 text-sm">
                  {profileSuccess}
                </div>
              ) : null}

              <Button type="submit" disabled={isSavingProfile}>
                <Save className="h-4 w-4" />
                {isSavingProfile ? 'Saving…' : 'Save'}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Change password</CardTitle>
            <CardDescription>Your password will be re-hashed and stored securely.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={onChangePassword} className="grid gap-3">
              <div className="grid gap-2">
                <Label htmlFor="currentPassword">Current password</Label>
                <Input
                  id="currentPassword"
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  autoComplete="current-password"
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="newPassword">New password</Label>
                <Input
                  id="newPassword"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  autoComplete="new-password"
                />
              </div>

              {passwordError ? (
                <div role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm">
                  {passwordError}
                </div>
              ) : null}
              {passwordSuccess ? (
                <div role="status" className="rounded-md border px-3 py-2 text-sm">
                  {passwordSuccess}
                </div>
              ) : null}

              <Button type="submit" disabled={isSavingPassword}>
                <KeyRound className="h-4 w-4" />
                {isSavingPassword ? 'Updating…' : 'Update password'}
              </Button>
            </form>
          </CardContent>
        </Card>

        {String(user?.role ?? '').toLowerCase() !== 'admin' ? (
          <Card>
            <CardHeader>
              <CardTitle>Deactivate account</CardTitle>
              <CardDescription>
                This will set your account to inactive and log you out. Your data stays stored.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  setDeactivateError(null);
                  setIsDeactivating(true);
                  try {
                    await api.patch('/api/auth/me/deactivate', { password: deactivatePassword });
                    setDeactivatePassword('');
                    await logout();
                    navigate('/login', { replace: true });
                  } catch (err) {
                    const apiError = err?.response?.data;
                    const issues = Array.isArray(apiError?.issues)
                      ? apiError.issues.map((i) => i?.message).filter(Boolean).join(', ')
                      : null;
                    setDeactivateError(issues || apiError?.error || err?.message || 'Failed to deactivate account');
                  } finally {
                    setIsDeactivating(false);
                  }
                }}
                className="grid gap-3"
              >
                <div className="grid gap-2">
                  <Label htmlFor="deactivatePassword">Confirm password</Label>
                  <Input
                    id="deactivatePassword"
                    type="password"
                    value={deactivatePassword}
                    onChange={(e) => setDeactivatePassword(e.target.value)}
                    autoComplete="current-password"
                  />
                </div>

                {deactivateError ? (
                  <div
                    role="alert"
                    className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm"
                  >
                    {deactivateError}
                  </div>
                ) : null}

                <Button type="submit" variant="destructive" disabled={isDeactivating || !deactivatePassword}>
                  <UserX className="h-4 w-4" />
                  {isDeactivating ? 'Deactivating…' : 'Deactivate account'}
                </Button>
              </form>
            </CardContent>
          </Card>
        ) : null}
      </div>
    </main>
  );
}
