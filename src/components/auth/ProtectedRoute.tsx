import React, { useState } from 'react';
import { Navigate, Link, useLocation } from 'react-router-dom';
import { useAuth } from '@/src/context/AuthContext';
import { Button } from '@/src/components/ui/button';
import { Mail } from 'lucide-react';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: ('buyer' | 'organizer' | 'admin' | 'superadmin')[];
}

// Pantalla para compradores que intentan entrar al panel de productor.
//
// ANTES: la cuenta nacia como "buyer", el panel exigia "organizer" y el alta se
// hacia A MANO por WhatsApp. O sea que para empezar a vender entradas habia que
// esperar a que alguien de ENTRA estuviera del otro lado. Con eso se perdia al
// que decidia a las once de la noche que queria publicar su evento.
//
// AHORA: el alta es de un clic. El freno no esta en la cuenta, esta donde
// importa de verdad: el evento nace en "pending" (lo obliga la propia regla de
// Firestore) y no se ve en la cartelera ni se puede comprar hasta que ENTRA lo
// aprueba. Abrir la puerta no es abrir la mano.
function ProducerActivationScreen() {
  const { profile, user, updateRole, resendVerification } = useAuth();
  const [activando, setActivando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [verificacionEnviada, setVerificacionEnviada] = useState(false);

  // El mail verificado NO es un capricho: la regla de Firestore que permite
  // crear eventos exige `isVerified()`. Sin esto, el productor se activaria,
  // cargaria todo el evento y recien al guardar le explotaria un error de
  // permisos que no puede entender. Mejor decirselo antes.
  const mailVerificado = user?.emailVerified === true;

  const activar = async () => {
    setActivando(true);
    setError(null);
    try {
      await updateRole('organizer');
      // El perfil se refresca solo por el contexto y la ruta deja de rebotar.
      // Aviso de bienvenida: si falla, no se toca la activacion, que ya paso.
      fetch('/api/organizador', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'welcome',
          email: user?.email || '',
          nombre: profile?.displayName || user?.displayName || '',
        }),
      }).catch(() => {});
    } catch (e: any) {
      setError(e?.message || 'No pudimos activar la cuenta. Probá de nuevo.');
      setActivando(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-6 pt-32 pb-20">
      <div className="glass rounded-[2.5rem] border border-white/10 p-10 md:p-12 max-w-md w-full text-center space-y-6 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-transparent pointer-events-none" />
        <div className="relative space-y-6">
          <span className="block text-[10px] font-sans font-black tracking-[0.3em] uppercase text-primary">
            ENTRÁ · PRODUCTORES
          </span>

          <h1 className="text-3xl md:text-4xl font-heading font-black tracking-tighter uppercase text-white leading-none">
            Empezá a vender{' '}
            <span className="orange-text-gradient">tus entradas.</span>
          </h1>

          <p className="text-sm text-muted-foreground font-sans leading-relaxed">
            Activá tu cuenta de productor y cargá tu evento cuando quieras. Al terminar
            lo revisamos y lo publicamos, normalmente el mismo día. Si necesitás una mano,
            escribinos a soporte@entratickets.com y lo vemos juntos.
          </p>

          {!mailVerificado && (
            <div className="rounded-2xl border border-yellow-500/30 bg-yellow-950/30 p-4 text-left space-y-2">
              <p className="text-xs text-yellow-200 leading-relaxed">
                Antes de publicar un evento tenés que <b>verificar tu mail</b>. Te mandamos un
                link cuando te registraste{user?.email ? ` a ${user.email}` : ''}.
              </p>
              <button
                type="button"
                onClick={async () => { await resendVerification(); setVerificacionEnviada(true); }}
                className="text-xs font-bold text-yellow-400 underline"
              >
                {verificacionEnviada ? 'Te lo reenviamos, revisá el correo' : 'Reenviarme el mail de verificación'}
              </button>
            </div>
          )}

          {error && <p className="text-xs text-red-400">{error}</p>}

          <div className="flex flex-col gap-3 pt-2">
            <Button
              onClick={activar}
              disabled={activando}
              className="w-full h-14 orange-gradient border-none text-white rounded-xl font-heading font-black uppercase tracking-wide transition-all hover:brightness-110"
            >
              {activando ? 'Activando…' : 'Activar mi cuenta de productor'}
            </Button>
            <a href="mailto:soporte@entratickets.com?subject=Consulta%20para%20vender%20entradas%20con%20ENTR%C3%81" className="w-full">
              <Button
                variant="outline"
                className="w-full h-12 rounded-xl bg-white/[0.03] border border-white/10 text-white hover:bg-white/[0.06] hover:border-white/20 font-bold text-xs uppercase tracking-wider gap-2"
              >
                <Mail className="w-4 h-4" />
                Escribir a soporte
              </Button>
            </a>
            <Link to="/" className="w-full">
              <Button
                variant="outline"
                className="w-full h-12 rounded-xl bg-transparent border-0 text-muted-foreground hover:text-white font-bold text-xs uppercase tracking-wider"
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

  // Not logged in → redirect to login page.
  //
  // El destino va por `?redirect=`, que es lo que Auth.tsx lee de verdad. Antes
  // se mandaba en `state.from` y NADIE lo leía: el que tocaba "Crear mi evento"
  // sin sesión se logueaba y aterrizaba en su perfil, justo en el momento de más
  // intención. Se manda igual el state por si algo más lo usa.
  if (!user) {
    const destino = `${location.pathname}${location.search}`;
    return (
      <Navigate
        to={`/auth/login?redirect=${encodeURIComponent(destino)}`}
        state={{ from: location }}
        replace
      />
    );
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
