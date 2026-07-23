import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/src/context/AuthContext';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: ('buyer' | 'organizer' | 'admin' | 'superadmin')[];
}

export function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
  const { user, profile, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // Not logged in → redirect to login page
  if (!user) {
    return <Navigate to="/auth/login" state={{ from: location }} replace />;
  }

  // Cuenta suspendida por un admin → bloquear el acceso a rutas protegidas.
  // (Antes "Suspender" marcaba el flag pero no lo hacía cumplir en ningún lado.)
  if (profile?.suspended) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background px-6 text-center">
        <div className="max-w-md">
          <h1 className="text-2xl font-black mb-2">Cuenta suspendida</h1>
          <p className="text-zinc-400">
            Tu cuenta fue suspendida. Si creés que es un error, escribinos para revisarlo.
          </p>
        </div>
      </div>
    );
  }

  if (allowedRoles && profile) {
    // SuperAdmin can access everything
    if (profile.role === 'superadmin') {
      return <>{children}</>;
    }

    if (!allowedRoles.includes(profile.role)) {
      return <Navigate to="/" replace />;
    }
  }

  return <>{children}</>;
}

