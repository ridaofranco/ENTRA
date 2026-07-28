import React from 'react';
import { Navigate, Link, useLocation } from 'react-router-dom';
import { useAuth } from '@/src/context/AuthContext';
import { Button } from '@/src/components/ui/button';
import { WhatsAppIcon } from '@/src/components/icons/WhatsAppIcon';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: ('buyer' | 'organizer' | 'admin' | 'superadmin')[];
}

// Pantalla para compradores que intentan entrar al panel de productor.
// Antes esto era un rebote mudo al home: la cuenta nacia como "buyer",
// el panel exigia "organizer" y el usuario terminaba en una pared sin
// ninguna explicacion. El alta de productor hoy es manual, con el equipo.
function ProducerActivationScreen() {
  const whatsappUrl = `https://wa.me/5491171540675?text=${encodeURIComponent(
    'Hola, quiero vender entradas con ENTRÁ'
  )}`;

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-6 pt-32 pb-20">
      <div className="glass rounded-[2.5rem] border border-white/10 p-10 md:p-12 max-w-md w-full text-center space-y-6 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-transparent pointer-events-none" />
        <div className="relative space-y-6">
          <span className="block text-[10px] font-sans font-black tracking-[0.3em] uppercase text-primary">
            ENTRÁ · PRODUCTORES
          </span>

          <h1 className="text-3xl md:text-4xl font-heading font-black tracking-tighter uppercase text-white leading-none">
            Tu cuenta de productor{' '}
            <span className="orange-text-gradient">se activa con el equipo.</span>
          </h1>

          <p className="text-sm text-muted-foreground font-sans leading-relaxed">
            Tu cuenta ya está creada, pero el panel de productor se habilita a mano
            con el equipo de ENTRÁ. Escribinos por WhatsApp y coordinamos el alta
            para que puedas vender tus entradas.
          </p>

          <div className="flex flex-col gap-3 pt-2">
            <a href={whatsappUrl} target="_blank" rel="noopener noreferrer" className="w-full">
              <Button className="w-full h-14 orange-gradient border-none text-white rounded-xl font-heading font-black uppercase tracking-wide gap-2.5 transition-all hover:brightness-110">
                <WhatsAppIcon className="w-5 h-5" />
                Hablar por WhatsApp
              </Button>
            </a>
            <Link to="/" className="w-full">
              <Button
                variant="outline"
                className="w-full h-12 rounded-xl bg-white/[0.03] border border-white/10 text-white hover:bg-white/[0.06] hover:border-white/20 font-bold text-xs uppercase tracking-wider"
              >
                Volver al inicio
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
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
      // Comprador que pide una ruta de productor → explicar como activar la
      // cuenta, en lugar de rebotarlo al home sin ningun mensaje.
      if (profile.role === 'buyer' && allowedRoles.includes('organizer')) {
        return <ProducerActivationScreen />;
      }
      // Otros casos (por ejemplo un organizer en rutas de admin) → al home.
      return <Navigate to="/" replace />;
    }
  }

  return <>{children}</>;
}
