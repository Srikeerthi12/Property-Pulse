import { Outlet } from 'react-router-dom';

import { useAuth } from '../../context/AuthContext.jsx';
import Topbar from './Topbar.jsx';

function menuForRole(role) {
  const r = String(role || '').toLowerCase();

  if (r === 'buyer') {
    return [
      { label: 'Dashboard', to: '/buyer' },
      { label: 'My Inquiries', to: '/buyer/inquiries' },
      { label: 'Saved Properties', to: '/buyer/saved' },
      { label: 'My Visits', to: '/buyer/visits' },
      { label: 'My Deals', to: '/buyer/deals' },
    ];
  }

  if (r === 'agent') {
    return [
      { label: 'Dashboard', to: '/agent' },
      { label: 'My Leads', to: '/agent/leads' },
      { label: 'Visits', to: '/agent/visits' },
      { label: 'Deals', to: '/agent/deals' },
      { label: 'Notes / Activity', to: '/agent/activity' },
    ];
  }

  if (r === 'seller') {
    return [
      { label: 'Dashboard', to: '/seller' },
      { label: 'My Properties', to: '/seller/properties' },
      { label: 'Lead Analytics', to: '/seller/analytics' },
      { label: 'Visits', to: '/seller/visits' },
      { label: 'Deals', to: '/seller/deals' },
    ];
  }

  if (r === 'admin') {
    return [
      { label: 'Dashboard', to: '/admin' },
      { label: 'Users', to: '/admin/users' },
      { label: 'Properties', to: '/admin/properties' },
      { label: 'Leads', to: '/admin/leads' },
      { label: 'Visits', to: '/admin/visits' },
      { label: 'Deals', to: '/admin/deals' },
      { label: 'Analytics', to: '/admin/analytics' },
    ];
  }

  return [{ label: 'Dashboard', to: '/dashboard' }];
}

export default function DashboardLayout() {
  const { user } = useAuth();
  const menu = menuForRole(user?.role);

  return (
    <div className="min-h-screen bg-muted/30">
      <div className="min-h-screen">
        <Topbar menu={menu} />
        <main className="w-full p-4 lg:p-6">
          <div className="mx-auto w-full max-w-6xl">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
