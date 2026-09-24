import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import AppLoader from '../components/common/AppLoader';
import { getDashboardRoute } from '../utils/normalizeRole';

const ProtectedRoute = ({ allowedRoles = [], isForceResetRoute = false }) => {
  const { user, role, authInitialized } = useAuth();

  if (!authInitialized) {
    return <AppLoader />;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (user.mustResetPassword === true && !isForceResetRoute) {
    return <Navigate to="/force-reset-password" replace />;
  }

  if (user.mustResetPassword === false && isForceResetRoute) {
    return <Navigate to={getDashboardRoute(user.role)} replace />;
  }

  const normalizedUserRole = role ? String(role).toLowerCase().trim() : '';
  const isAllowed =
    allowedRoles.length === 0 ||
    allowedRoles.some((r) => String(r).toLowerCase().trim() === normalizedUserRole);

  if (!isAllowed) {
    return <Navigate to={getDashboardRoute(user?.role)} replace />;
  }

  return <Outlet />;
};

export default ProtectedRoute;
