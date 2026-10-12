import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function ProtectedRoute({ children, permission }) {
  const { user, can, authLoading } = useAuth();
  const location = useLocation();

  if (authLoading) return <div className="main"><p className="muted">Loading…</p></div>;
  if (!user) return <Navigate to="/login" state={{ from: location }} replace />;
  if (permission && !can(permission)) return <Navigate to="/unauthorized" replace />;
  return children;
}
