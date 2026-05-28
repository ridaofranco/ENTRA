import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Menu, User, Search, LogOut } from 'lucide-react';
import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/src/context/AuthContext';

export function Navbar() {
  const [isScrolled, setIsScrolled] = useState(false);
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

  return (
    <nav className={cn(
      "fixed top-0 w-full z-50 transition-all duration-300 px-6 h-20 flex items-center justify-between",
      isScrolled ? "bg-background/80 backdrop-blur-xl border-b border-white/5" : "bg-transparent"
    )}>
      <Link to="/" className="flex items-center gap-2 group">
        <span className="font-heading font-black text-2xl tracking-tighter">
          ENTR<span className="text-primary">Á</span>
        </span>
      </Link>

      <div className="hidden md:flex items-center gap-6">
        <Link to="/eventos" className="text-[10px] font-bold text-muted-foreground hover:text-primary transition-colors uppercase tracking-[0.2em] font-sans">Eventos</Link>
        <Link to="/productores" className="text-[10px] font-bold text-muted-foreground hover:text-primary transition-colors uppercase tracking-[0.2em] font-sans">Productores</Link>
        <Link to="/ayuda" className="text-[10px] font-bold text-muted-foreground hover:text-primary transition-colors uppercase tracking-[0.2em] font-sans">Ayuda</Link>

        {isOrganizer && (
          <Link to="/dashboard" className="text-[10px] font-bold text-muted-foreground hover:text-primary transition-colors uppercase tracking-[0.2em] font-sans">Dashboard</Link>
        )}

        {isOrganizer && (
          <Link to="/crear-evento" className="text-[10px] font-bold text-muted-foreground hover:text-primary transition-colors uppercase tracking-[0.2em] font-sans">Crear Evento</Link>
        )}

        {isAdmin && (
          <Link to="/admin/dashboard" className="text-[10px] font-bold text-primary hover:text-primary/80 transition-colors uppercase tracking-[0.2em] font-sans">Admin</Link>
        )}
      </div>

      <div className="flex items-center gap-4">
        <Link to="/eventos">
          <Button variant="ghost" size="icon" className="hidden sm:flex text-muted-foreground hover:text-primary">
            <Search className="w-5 h-5" />
          </Button>
        </Link>

        {user ? (
          <div className="flex items-center gap-4">
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
            <Button variant="ghost" size="icon" onClick={logout} className="text-muted-foreground hover:text-red-500">
              <LogOut className="w-5 h-5" />
            </Button>
          </div>
        ) : null}

        <Link to={user ? "/perfil" : "/auth/login"}>
          <Button className="orange-gradient border-none text-white px-8 py-5 text-sm uppercase tracking-wide rounded-xl transition-all hover:brightness-110 font-heading font-black">
            ENTRÁ
          </Button>
        </Link>
        <Button variant="ghost" size="icon" className="md:hidden">
          <Menu className="w-6 h-6" />
        </Button>
      </div>
    </nav>
  );
}

