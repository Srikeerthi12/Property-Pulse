import { useAuth } from '../context/AuthContext.jsx';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card.jsx';

export default function Dashboard({ forceRole }) {
  const { user } = useAuth();
  const role = (forceRole ?? user?.role ?? 'user').toString();

  return (
    <main>
      <Card>
        <CardHeader>
          <CardTitle>Dashboard</CardTitle>
          <CardDescription>Signed in as {user?.email ?? 'unknown'}.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid max-w-md gap-3 rounded-lg border bg-background p-4">
            <div className="text-sm font-medium">Role</div>
            <div className="text-sm text-muted-foreground">{role}</div>
            <div className="text-sm font-medium">Account</div>
            <div className="text-sm text-muted-foreground">{user?.isActive ? 'Active' : 'Inactive'}</div>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
