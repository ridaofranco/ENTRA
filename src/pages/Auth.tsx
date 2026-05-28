import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/src/context/AuthContext';
import { AlertCircle, Eye, EyeOff, Loader2, MessageCircle, Mail, ArrowLeft, Check } from 'lucide-react';

type AuthView = 'buttons' | 'email-login' | 'email-register' | 'forgot' | 'complete-profile';

export default function Auth() {
  const { 
    user, 
    profile, 
    loading: authLoading, 
    login, 
    loginWithEmail, 
    registerWithEmail, 
    resetPassword 
  } = useAuth();
  
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirect = searchParams.get('redirect') || '/perfil';

  // ======================== STATE ========================
  const [view, setView] = useState<AuthView>('buttons');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [phone, setPhone] = useState('');
  const [dni, setDni] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [adentroFeedback, setAdentroFeedback] = useState(false);

  // ======================== ACTIONS & REDIRECT ========================
  useEffect(() => {
    if (user && profile) {
      // Check if profile is missing critical buyer info
      const isProfileIncomplete = !profile.phone || !profile.dni;
      
      if (isProfileIncomplete && view !== 'complete-profile') {
        // Set info if we have some from user
        setDisplayName(profile.displayName || user.displayName || '');
        setPhone(profile.phone || '');
        setDni(profile.dni || '');
        setView('complete-profile');
        return;
      }

      if (!isProfileIncomplete) {
        // Trigger sober "Estás adentro" feedback
        setAdentroFeedback(true);
        const timer = setTimeout(() => {
          navigate(redirect);
        }, 1200);
        return () => clearTimeout(timer);
      }
    }
  }, [user, profile, navigate, redirect, view]);

  const handleGoogleLogin = async () => {
    setError(null);
    setSubmitting(true);
    try {
      await login();
      // On success, useEffect takes over
    } catch (err: any) {
      if (err.code !== 'auth/popup-closed-by-user' && err.code !== 'auth/cancelled-popup-request') {
        setError(getFirebaseErrorMessage(err.code));
      }
      setSubmitting(false);
    }
  };

  const handleAppleMockLogin = () => {
    setError('El inicio con Apple se encuentra temporalmente en mantenimiento. Por favor, usá Google o Mail.');
    setTimeout(() => setError(null), 4000);
  };

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!email.trim() || !password) {
      setError('Completá tu email y contraseña.');
      return;
    }
    setSubmitting(true);
    try {
      await loginWithEmail(email.trim(), password);
    } catch (err: any) {
      setError(getFirebaseErrorMessage(err.code));
      setSubmitting(false);
    }
  };

  const handleEmailRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!displayName.trim() || !email.trim() || !password || !phone.trim() || !dni.trim()) {
      setError('Completá todos los campos para registrarte.');
      return;
    }
    if (password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Las contraseñas no coinciden.');
      return;
    }

    setSubmitting(true);
    try {
      await registerWithEmail(
        email.trim(), 
        password, 
        displayName.trim(), 
        phone.trim(), 
        dni.trim()
      );
    } catch (err: any) {
      setError(getFirebaseErrorMessage(err.code));
      setSubmitting(false);
    }
  };

  const handleCompleteProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setError(null);
    if (!phone.trim() || !dni.trim()) {
      setError('Por favor, completá tu teléfono y DNI.');
      return;
    }
    setSubmitting(true);
    try {
      const { doc, updateDoc } = await import('firebase/firestore');
      const { db } = await import('@/src/lib/firebase');
      await updateDoc(doc(db, 'users', user.uid), {
        phone: phone.trim(),
        dni: dni.trim(),
        displayName: displayName.trim() || user.displayName || '',
        updatedAt: new Date(),
      });
      // The profile update will trigger the useEffect to set "Estás adentro"
    } catch (err) {
      console.error('Error completing profile:', err);
      setError('No pudimos guardar los datos. Reintentá.');
      setSubmitting(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!email.trim()) {
      setError('Ingresá tu email para continuar.');
      return;
    }
    setSubmitting(true);
    try {
      await resetPassword(email.trim());
      setSuccess('Te enviamos un enlace de recuperación. Revisá tu mail.');
      setSubmitting(false);
      setTimeout(() => {
        setSuccess(null);
        setView('email-login');
      }, 3000);
    } catch (err : any) {
      setError(getFirebaseErrorMessage(err.code));
      setSubmitting(false);
    }
  };

  const getFirebaseErrorMessage = (errorCode: string): string => {
    const messages: Record<string, string> = {
      'auth/email-already-in-use': 'Ya existe una cuenta con este email.',
      'auth/invalid-email': 'El formato del email es incorrecto.',
      'auth/user-disabled': 'Esta cuenta ha sido suspendida.',
      'auth/user-not-found': 'No hay registro con este email.',
      'auth/wrong-password': 'La contraseña es incorrecta.',
      'auth/invalid-credential': 'Email o contraseña incorrectos.',
      'auth/weak-password': 'Elegí una contraseña más segura (mínimo 6 caracteres).',
    };
    return messages[errorCode] || 'Hubo un inconveniente. Reintentá en unos segundos.';
  };

  // Skip rendering if checking state first
  if (authLoading && !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#09090b]">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col justify-center items-center bg-[#09090b] text-foreground relative px-6 overflow-hidden pt-20">
      {/* Background aesthetics */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-primary/5 rounded-full blur-[160px] opacity-70" />
      </div>

      <AnimatePresence mode="wait">
        {adentroFeedback ? (
          <motion.div
            key="inside"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            className="text-center z-10 py-16"
          >
            <h1 className="text-5xl md:text-6xl lg:text-7xl font-heading font-black tracking-tighter leading-none uppercase">
              Estás <span className="orange-text-gradient">adentro.</span>
            </h1>
            <p className="text-sm font-sans tracking-widest text-[#a0a0aa] uppercase mt-4">
              Activando accesos seguros
            </p>
          </motion.div>
        ) : (
          <motion.div
            key="portal"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            className="w-full max-w-sm z-10 relative flex flex-col items-center"
          >
            {/* Header titles */}
            <div className="text-center mb-10 space-y-2">
              <h1 className="text-6xl font-heading font-black tracking-tighter leading-none uppercase select-none">
                ENTR<span className="orange-text-gradient">Á</span>
              </h1>
              <p className="text-xs font-sans tracking-[0.3em] text-primary uppercase font-bold">
                ACTIVÁ TU ACCESO
              </p>
            </div>

            {/* Error notifications */}
            {error && (
              <div className="w-full mb-6 bg-red-950/20 border border-red-500/20 rounded-2xl p-4 flex gap-3 items-start animate-in fade-in duration-200">
                <AlertCircle className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" />
                <p className="text-xs text-red-300 font-sans leading-snug">{error}</p>
              </div>
            )}

            {success && (
              <div className="w-full mb-6 bg-emerald-950/20 border border-emerald-500/20 rounded-2xl p-4 flex gap-3 items-start animate-in fade-in duration-200">
                <Check className="w-4 h-4 text-emerald-400 mt-0.5 flex-shrink-0" />
                <p className="text-xs text-emerald-300 font-sans leading-snug">{success}</p>
              </div>
            )}

            <div className="w-full">
              {/* PRIMARY GATEWAY BUTTONS */}
              {view === 'buttons' && (
                <div className="space-y-3">
                  {/* Google */}
                  <button
                    disabled={submitting}
                    onClick={handleGoogleLogin}
                    className="w-full h-14 bg-white hover:bg-zinc-200 text-black font-heading font-black text-xs uppercase tracking-widest rounded-2xl flex items-center justify-between px-6 transition duration-200 group active:scale-98"
                  >
                    <span>Continuar con Google</span>
                    {submitting ? (
                      <Loader2 className="w-4 h-4 animate-spin text-black" />
                    ) : (
                      <svg className="w-4 h-4 fill-current text-black opacity-80 group-hover:opacity-100 transition-opacity" viewBox="0 0 24 24">
                        <path d="M12.24 10.285V13.4h6.86c-.277 1.56-1.602 4.585-6.86 4.585-4.54 0-8.24-3.765-8.24-8.4s3.7-8.4 8.24-8.4c2.58 0 4.307 1.095 5.298 2.045l2.465-2.37C18.435 1.21 15.62 0 12.24 0 5.58 0 0.18 5.37 0.18 12s5.4 12 12.06 12c6.96 0 11.58-4.89 11.58-11.79 0-.795-.085-1.4-.195-1.925H12.24z"/>
                      </svg>
                    )}
                  </button>

                  {/* Apple */}
                  <button
                    onClick={handleAppleMockLogin}
                    className="w-full h-14 bg-[#18181b] border border-white/5 hover:border-white/10 text-white font-heading font-black text-xs uppercase tracking-widest rounded-2xl flex items-center justify-between px-6 transition duration-200 group active:scale-98"
                  >
                    <span>Continuar con Apple</span>
                    <svg className="w-4 h-4 fill-current text-white opacity-80 group-hover:opacity-100 transition-opacity" viewBox="0 0 24 24">
                      <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M15.97 4.17c.66-.81 1.11-1.93.99-3.06-1 .04-2.2.67-2.92 1.49-.62.71-1.16 1.85-1.01 2.96 1.12.09 2.27-.58 2.94-1.39z"/>
                    </svg>
                  </button>

                  <div className="relative py-4 flex items-center justify-center">
                    <span className="bg-[#09090b] px-4 text-[10px] font-sans tracking-[0.2em] text-[#52525b] font-bold uppercase">
                      o por credenciales
                    </span>
                  </div>

                  {/* Mail */}
                  <button
                    onClick={() => setView('email-login')}
                    className="w-full h-14 bg-[#18181b] border border-[#ff5c00]/20 hover:border-[#ff5c00]/40 text-primary font-heading font-black text-xs uppercase tracking-widest rounded-2xl flex items-center justify-between px-6 transition duration-200 active:scale-98"
                  >
                    <span>Ingresar por Mail</span>
                    <Mail className="w-4 h-4 text-primary" />
                  </button>
                </div>
              )}

              {/* EMAIL LOGIN FORM */}
              {view === 'email-login' && (
                <form onSubmit={handleEmailLogin} className="space-y-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-[#71717a] uppercase tracking-wider block">Email</label>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="tu@email.com"
                      className="w-full h-12 bg-white/[0.02] border border-white/10 rounded-xl px-4 text-sm font-sans focus:outline-none focus:border-primary/50 transition-colors"
                    />
                  </div>

                  <div className="space-y-1">
                    <div className="flex justify-between items-center">
                      <label className="text-[10px] font-bold text-[#71717a] uppercase tracking-wider block">Contraseña</label>
                      <button 
                        type="button" 
                        onClick={() => setView('forgot')}
                        className="text-[10px] text-zinc-500 hover:text-primary transition-colors uppercase tracking-wider"
                      >
                        ¿Olvidaste?
                      </button>
                    </div>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full h-12 bg-white/[0.02] border border-white/10 rounded-xl px-4 pr-11 text-sm font-sans focus:outline-none focus:border-primary/50 transition-colors"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-600 hover:text-zinc-400"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <div className="pt-2 space-y-3">
                    <Button
                      type="submit"
                      disabled={submitting}
                      className="w-full h-13 orange-gradient border-none font-heading font-black text-xs uppercase tracking-widest rounded-xl shadow-lg shadow-[#ff5c00]/10"
                    >
                      {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Entrar'}
                    </Button>

                    <button
                      type="button"
                      onClick={() => setView('buttons')}
                      className="w-full h-10 text-xs font-sans text-muted-foreground hover:text-white flex items-center justify-center gap-1.5 transition-colors"
                    >
                      <ArrowLeft className="w-3.5 h-3.5" /> Volver
                    </button>
                  </div>

                  <div className="text-center pt-2">
                    <p className="text-xs text-zinc-600">
                      ¿No tenés cuenta?{' '}
                      <button
                        type="button"
                        onClick={() => setView('email-register')}
                        className="text-primary font-bold hover:underline"
                      >
                        Registrate gratis
                      </button>
                    </p>
                  </div>
                </form>
              )}

              {/* EMAIL REGISTER FORM */}
              {view === 'email-register' && (
                <form onSubmit={handleEmailRegister} className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-[#71717a] uppercase tracking-wider block">Nombre completo</label>
                    <input
                      type="text"
                      required
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      placeholder="Juan Pérez"
                      className="w-full h-11 bg-white/[0.02] border border-white/10 rounded-xl px-4 text-sm font-sans focus:outline-none focus:border-primary/50 transition-colors"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-[#71717a] uppercase tracking-wider block">Email</label>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="tu@email.com"
                      className="w-full h-11 bg-white/[0.02] border border-white/10 rounded-xl px-4 text-sm font-sans focus:outline-none focus:border-primary/50 transition-colors"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-[#71717a] uppercase tracking-wider block">Teléfono</label>
                    <input
                      type="tel"
                      required
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="Ej: 1155443322"
                      className="w-full h-11 bg-white/[0.02] border border-white/10 rounded-xl px-4 text-sm font-sans focus:outline-none focus:border-primary/50 transition-colors"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-[#71717a] uppercase tracking-wider block">DNI / Pasaporte</label>
                    <input
                      type="text"
                      required
                      value={dni}
                      onChange={(e) => setDni(e.target.value)}
                      placeholder="Sin espacios ni puntos"
                      className="w-full h-11 bg-white/[0.02] border border-white/10 rounded-xl px-4 text-sm font-sans focus:outline-none focus:border-primary/50 transition-colors"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-[#71717a] uppercase tracking-wider block">Contraseña</label>
                    <input
                      type="password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Mínimo 6 caracteres"
                      className="w-full h-11 bg-white/[0.02] border border-white/10 rounded-xl px-4 text-sm font-sans focus:outline-none focus:border-primary/50 transition-colors"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-[#71717a] uppercase tracking-wider block">Confirmar Contraseña</label>
                    <input
                      type="password"
                      required
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Volvé a ingresarla"
                      className="w-full h-11 bg-white/[0.02] border border-white/10 rounded-xl px-4 text-sm font-sans focus:outline-none focus:border-primary/50 transition-colors"
                    />
                  </div>

                  <div className="pt-2 space-y-3">
                    <Button
                      type="submit"
                      disabled={submitting}
                      className="w-full h-13 orange-gradient border-none font-heading font-black text-xs uppercase tracking-widest rounded-xl shadow-lg shadow-[#ff5c00]/10"
                    >
                      {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Crear Cuenta'}
                    </Button>

                    <button
                      type="button"
                      onClick={() => setView('email-login')}
                      className="w-full h-10 text-xs font-sans text-muted-foreground hover:text-white flex items-center justify-center gap-1.5 transition-colors"
                    >
                      Ya tengo cuenta, iniciar sesión
                    </button>
                  </div>
                </form>
              )}

              {/* PASSWORD RESET FORM */}
              {view === 'forgot' && (
                <form onSubmit={handleResetPassword} className="space-y-4">
                  <p className="text-xs text-muted-foreground font-sans leading-relaxed text-center mb-2">
                    Te enviaremos un email con un link para reestablecer tu acceso de forma inmediata.
                  </p>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-[#71717a] uppercase tracking-wider block">Email</label>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="tu@email.com"
                      className="w-full h-12 bg-white/[0.02] border border-white/10 rounded-xl px-4 text-sm font-sans focus:outline-none focus:border-primary/50 transition-colors"
                    />
                  </div>

                  <div className="pt-2 space-y-3">
                    <Button
                      type="submit"
                      disabled={submitting}
                      className="w-full h-13 orange-gradient border-none font-heading font-black text-xs uppercase tracking-widest rounded-xl"
                    >
                      {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Enviar Enlace'}
                    </Button>

                    <button
                      type="button"
                      onClick={() => setView('email-login')}
                      className="w-full h-10 text-xs font-sans text-muted-foreground hover:text-white flex items-center justify-center gap-1.5 transition-colors"
                    >
                      <ArrowLeft className="w-3.5 h-3.5" /> Volver
                    </button>
                  </div>
                </form>
              )}

              {/* COMPLETE PROFILE (Google Flow Post-auth details completion) */}
              {view === 'complete-profile' && (
                <form onSubmit={handleCompleteProfile} className="space-y-4 animate-in fade-in duration-200">
                  <div className="text-center mb-2">
                    <p className="text-xs text-zinc-400 font-sans">
                      Completá estos campos mínimos requeridos únicamente para habilitar el envío oficial de tus futuras entradas.
                    </p>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-[#71717a] uppercase tracking-wider block">Nombre completo</label>
                    <input
                      type="text"
                      required
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      className="w-full h-12 bg-white/[0.02] border border-white/10 rounded-xl px-4 text-sm font-sans focus:outline-none focus:border-primary/50 transition-colors"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-[#71717a] uppercase tracking-wider block">Teléfono</label>
                    <input
                      type="tel"
                      required
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="Ej: 1155443322"
                      className="w-full h-12 bg-white/[0.02] border border-white/10 rounded-xl px-4 text-sm font-sans focus:outline-none focus:border-primary/50 transition-colors"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-[#71717a] uppercase tracking-wider block">DNI / Pasaporte</label>
                    <input
                      type="text"
                      required
                      value={dni}
                      onChange={(e) => setDni(e.target.value)}
                      placeholder="Sin espacios ni puntos"
                      className="w-full h-12 bg-white/[0.02] border border-white/10 rounded-xl px-4 text-sm font-sans focus:outline-none focus:border-primary/50 transition-colors"
                    />
                  </div>

                  <div className="pt-2">
                    <Button
                      type="submit"
                      disabled={submitting}
                      className="w-full h-13 orange-gradient border-none font-heading font-black text-xs uppercase tracking-widest rounded-xl shadow-lg shadow-[#ff5c00]/10"
                    >
                      {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Confirmar y ENTRAR'}
                    </Button>
                  </div>
                </form>
              )}
            </div>

            {/* Support / Quick CTAs */}
            {view === 'buttons' && (
              <div className="w-full mt-10">
                <div className="border border-white/5 bg-white/[0.01] rounded-2xl p-5 text-center">
                  <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest leading-none mb-1">
                    ¿Sos organizador?
                  </p>
                  <p className="text-[10px] text-zinc-500 mb-4 leading-relaxed font-sans">
                    Te activamos tu cuenta para publicar y vender accesos en un clic.
                  </p>
                  <div className="flex gap-2">
                    <a
                      href="https://wa.me/5491171540675?text=Hola!%20Quiero%20poner%20a%20la%20venta%20mis%20eventos%20con%20ENTRÁ"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 h-9 bg-zinc-900 border border-white/5 text-white text-[10px] font-black uppercase tracking-wider flex items-center justify-center gap-1.5 rounded-lg hover:border-emerald-500/30 transition-colors"
                    >
                      <MessageCircle className="w-3.5 h-3.5 text-emerald-400" />
                      WhatsApp
                    </a>
                    <a
                      href="mailto:organizadores@entra.com.ar"
                      className="flex-1 h-9 bg-zinc-900 border border-white/5 text-white text-[10px] font-black uppercase tracking-wider flex items-center justify-center gap-1.5 rounded-lg hover:border-orange-500/30 transition-colors"
                    >
                      <Mail className="w-3.5 h-3.5 text-primary" />
                      Email
                    </a>
                  </div>
                </div>
              </div>
            )}

            <p className="text-center text-[10px] text-[#52525b] mt-8 font-sans max-w-[280px]">
              Al iniciar sesión, estás aceptando de forma oficial nuestros <Link to="/ayuda" className="text-zinc-400 hover:underline">Términos de Servicio</Link> y <Link to="/ayuda" className="text-zinc-400 hover:underline">Políticas de Privacidad</Link>.
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
