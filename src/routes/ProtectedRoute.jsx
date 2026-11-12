import React from 'react';
import { useSelector } from 'react-redux';
import { Navigate, Outlet } from 'react-router-dom';

export function ProtectedRoute({ allowedRoles = null }) {
  const { user, accessToken } = useSelector((state) => state.auth);

  if (!accessToken || !user) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user.primaryRole)) {
    return <Navigate to="/dashboard" replace />;
  }

  return <Outlet />;
}
