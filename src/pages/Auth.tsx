import { useEffect } from 'react';
import { motion } from 'framer-motion';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/src/context/AuthContext';
import { MessageCircle, Mail } from 'lucide-react';

export default function Auth() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirect = searchParams.get('redirect') || '/perfil';

  useEffect(() => {
    if (user) {
      navigate(redirect);
    }
  }, [user, navigate, redirect]);

  const handleGoogleLogin = async () => {
    try {
      await login();
    } catch (error) {
      console.error('Login failed:', error);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center pt-20 px-6 relative overflow-hidden">
      <div className="absolute inset-0 z-0">
        <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] bg-primary/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[60%] h-[60%] bg-primary/5 rounded-full blur-[120px]" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md relative z-10"
      >
        <div className="text-center mb-10">
          <Link to="/" className="inline-flex items-center gap-2 mb-6 group">
            <div className="w-12 h-12 bg-primary rounded-2xl flex items-center justify-center text-white font-black text-2xl shadow-xl shadow-primary/20 group-hover:scale-110 transition-transform">
              E
            </div>
            <span className="font-heading font-black text-3xl tracking-tighter">
              ENTR<span className="text-primary">Á</span>
            </span>
          </Link>
          <h1 className="text-2xl font-heading font-bold mb-2">Bienvenido a ENTRÁ</h1>
          <p className="text-muted-foreground">Comprá entradas y gestioná tus eventos desde un solo lugar.</p>
        </div>

        <Card className="glass p-8 rounded-[2.5rem] border-white/10 shadow-2xl">
          <div className="space-y-6">
            <Button
              onClick={handleGoogleLogin}
              className="w-full h-14 bg-white hover:bg-gray-100 text-gray-800 font-bold text-lg rounded-xl shadow-lg flex items-center justify-center gap-3"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              Continuar con Google
            </Button>

            <div className="relative py-2">
              <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-white/5"></div></div>
            </div>

            {/* Organizer contact notice */}
            <div className="bg-white/5 rounded-2xl p-4 border border-white/10">
              <p className="text-xs font-bold text-center mb-3 text-zinc-300">¿Querés vender eventos con ENTRÁ?</p>
              <div className="flex gap-2">
                <a
                  href="https://wa.me/5491112345678?text=Hola!%20Quiero%20vender%20mis%20eventos%20con%20ENTRÁ"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white text-xs font-bold py-2.5 rounded-xl transition-all"
                >
                  <MessageCircle className="w-3.5 h-3.5" />
                  WhatsApp
                </a>
                <a
                  href="mailto:organizadores@entra.com.ar"
                  className="flex-1 flex items-center justify-center gap-2 bg-white/5 border border-white/10 text-xs font-bold py-2.5 rounded-xl hover:border-orange-500/30 transition-all"
                >
                  <Mail className="w-3.5 h-3.5" />
                  Email
                </a>
              </div>
              <p className="text-[10px] text-zinc-500 text-center mt-2">Te creamos tu cuenta de organizador personalizada</p>
            </div>

            <p className="text-center text-xs text-muted-foreground">
              Al iniciar sesión, aceptás nuestros{' '}
              <a href="#" className="text-primary hover:underline">Términos de Servicio</a> y{' '}
              <a href="#" className="text-primary hover:underline">Política de Privacidad</a>.
            </p>
          </div>
        </Card>

        <p className="text-center text-sm text-muted-foreground mt-8">
          ¿Necesitás ayuda?{' '}
          <Link to="/contacto" className="text-primary hover:underline font-bold">Contactanos</Link>
        </p>
      </motion.div>
    </div>
  );
}

