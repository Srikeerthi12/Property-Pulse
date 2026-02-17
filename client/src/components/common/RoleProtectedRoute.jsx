import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';

export default function RoleProtectedRoute({ allowedRoles = [], children }) {
  const { user, isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) return null;

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  const role = user?.role ? String(user.role).toLowerCase() : null;
  const allowed = Array.isArray(allowedRoles)
    ? allowedRoles.map((r) => String(r).toLowerCase())
    : [String(allowedRoles).toLowerCase()];

  if (allowed.length > 0 && (!role || !allowed.includes(role))) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}
