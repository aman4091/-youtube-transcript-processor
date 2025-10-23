import { Navigate } from 'react-router-dom';
import { useUserStore } from '../stores/userStore';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export default function ProtectedRoute({ children }: ProtectedRouteProps) {
  const isAuthenticated = useUserStore((state) => state.isAuthenticated);

  if (!isAuthenticated) {
    // Redirect to login if not authenticated
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}
