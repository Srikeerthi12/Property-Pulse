import { Navigate, useLocation } from 'react-router-dom';

import { useAuth } from '../context/AuthContext.jsx';
import Dashboard from './Dashboard.jsx';
import { getHomePathForRole } from '../utils/role.js';

export default function DashboardRedirect() {
  const { user } = useAuth();
  const location = useLocation();

  const to = getHomePathForRole(user?.role);

  // Unknown role (or missing role): fall back to the generic dashboard.
  if (!to || to === '/dashboard') return <Dashboard />;

  return <Navigate to={to} replace />;
}
