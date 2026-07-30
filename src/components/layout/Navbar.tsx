import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Menu, X, User, Search, LogOut } from 'lucide-react';
import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/src/context/AuthContext';
import { useLang, textos } from '@/src/lib/i18n';
import { LangSwitcher } from '@/src/components/LangSwitcher';

export function Navbar() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const lang = useLang();
  const t = textos(lang);
  const { user, profile, logout } = useAuth();
  const isOrganizer = profile?.role === 'organizer' || profile?.role === 'admin' || profile?.role === 'superadmin';
  const isAdmin = profile?.role === 'admin' || profile?.role === 'superadmin';

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const navLinks = [
    { to: '/eventos', label: t.nav.eventos, show: true, highlight: false },
    { to: '/productores', label: t.nav.productores, show: true, highlight: false },
    { to: '/ayuda', label: t.nav.ayuda, show: true, highlight: false },
    { to: '/dashboard', label: 'Dashboard', show: isOrganizer, highlight: false },
    { to: '/crear-evento', label: 'Crear Evento', show: isOrganizer, highlight: false },
    { to: '/control-acceso', label: 'Control Acceso', show: isOrganizer, highlight: false },
    { to: '/admin/dashboard', label: 'Admin', show: isAdmin, highlight: true },
  ].filter((l) => l.show);

  return (
    <nav className={cn(
      "fixed top-0 w-full z-50 transition-all duration-300 px-6 h-20 flex items-center justify-between",
      (isScrolled || mobileOpen) ? "bg-background/80 backdrop-blur-xl border-b border-white/5" : "bg-transparent"
    )}>
      <Link to="/" className="flex items-center gap-2 group" onClick={() => setMobileOpen(false)}>
        <span className="font-heading font-black text-2xl tracking-tighter">
          ENTR<span className="text-primary">Á</span>
        </span>
      </Link>

      <div className="hidden md:flex items-center gap-6">
        {navLinks.map((l) => (
          <Link
            key={l.to}
            to={l.to}
            className={cn(
              "text-[10px] font-bold transition-colors uppercase tracking-[0.2em] font-sans",
              l.highlight ? "text-primary hover:text-primary/80" : "text-muted-foreground hover:text-primary"
            )}
          >
            {l.label}
          </Link>
        ))}
      </div>

      <div className="flex items-center gap-3 sm:gap-4">
        <LangSwitcher className="hidden sm:flex" />
        <Link to="/eventos">
          <Button variant="ghost" size="icon" className="hidden sm:flex text-muted-foreground hover:text-primary">
            <Search className="w-5 h-5" />
          </Button>
        </Link>

        {user ? (
          <div className="flex items-center gap-3 sm:gap-4">
            <Link to="/perfil" className="flex items-center gap-2 hover:text-primary transition-colors">
              {user.photoURL ? (
                <img src={user.photoURL || null} alt="Avatar" className="w-8 h-8 rounded-full border border-primary/20" referrerPolicy="no-referrer" />
              ) : (
                <div className="w-8 h-8 rounded-full border border-primary/20 flex items-center justify-center bg-white/5">
                  <User className="w-4 h-4 text-muted-foreground" />
                </div>
              )}
              <span className="text-sm font-bold hidden lg:inline-block font-sans">{user.displayName}</span>
            </Link>
            <Button variant="ghost" size="icon" onClick={logout} className="hidden md:flex text-muted-foreground hover:text-red-500">
              <LogOut className="w-5 h-5" />
            </Button>
          </div>
        ) : null}

        {/* El boton mas destacado del sitio no puede ser una puerta al login: el visitante
            nuevo no tiene cuenta y el producto presume de no necesitarla. Queda como acceso
            secundario y con el nombre de lo que hace. Al usuario logueado ya lo lleva a su
            perfil el avatar de al lado, asi que aca no se repite. */}
        {!user && (
          <Link to="/auth/login" className="hidden sm:block">
            <Button variant="outline" className="bg-white/[0.03] border border-white/10 text-white hover:bg-white/[0.06] hover:border-white/20 px-5 sm:px-7 py-5 text-xs sm:text-sm uppercase tracking-wide rounded-xl transition-all font-heading font-black">
              {t.nav.cuenta}
            </Button>
          </Link>
        )}

        <Button
          variant="ghost"
          size="icon"
          className="md:hidden text-white"
          onClick={() => setMobileOpen((v) => !v)}
          aria-label={mobileOpen ? 'Cerrar menú' : 'Abrir menú'}
        >
          {mobileOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </Button>
      </div>

      {/* Panel mobile desplegable */}
      {mobileOpen && (
        <div className="md:hidden absolute top-full left-0 w-full bg-background/95 backdrop-blur-xl border-b border-white/10 px-6 py-6 flex flex-col gap-1">
          {navLinks.map((l) => (
            <Link
              key={l.to}
              to={l.to}
              onClick={() => setMobileOpen(false)}
              className={cn(
                "py-3 px-2 rounded-lg text-sm font-heading font-black uppercase tracking-wide transition-colors",
                l.highlight ? "text-primary" : "text-white hover:bg-white/5"
              )}
            >
              {l.label}
            </Link>
          ))}
          {/* En movil el acceso a la cuenta vive aca y no en la barra: arriba solo compite
              con el CTA del hero, y el que ya es cliente lo busca en el menu. */}
          {!user && (
            <Link
              to="/auth/login"
              onClick={() => setMobileOpen(false)}
              className="py-3 px-2 rounded-lg text-sm font-heading font-black uppercase tracking-wide text-muted-foreground hover:bg-white/5 transition-colors"
            >
              {t.nav.cuenta}
            </Link>
          )}
          {user && (
            <button
              onClick={() => { setMobileOpen(false); logout(); }}
              className="mt-2 py-3 px-2 rounded-lg text-sm font-heading font-black uppercase tracking-wide text-red-400 hover:bg-red-500/10 flex items-center gap-2 text-left"
            >
              <LogOut className="w-4 h-4" /> Cerrar sesión
            </button>
          )}
          <LangSwitcher className="mt-3 px-2" />
        </div>
      )}
    </nav>
  );
}
