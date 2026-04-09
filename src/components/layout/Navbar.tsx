import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Ticket, Menu, User, Search, LogOut } from 'lucide-react';
import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/src/context/AuthContext';

export function Navbar() {
  const [isScrolled, setIsScrolled] = useState(false);
  const { user, profile, login, logout } = useAuth();

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
        <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center text-white font-black text-xl shadow-lg shadow-primary/20 group-hover:scale-110 transition-transform">
          E
        </div>
        <span className="font-heading font-black text-2xl tracking-tighter">
          ENTR<span className="text-primary">Á</span>
        </span>
      </Link>

      <div className="hidden md:flex items-center gap-8">
        <Link to="/eventos" className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors uppercase tracking-widest">Eventos</Link>
        <Link to="/crear-evento" className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors uppercase tracking-widest">Vender</Link>
        <Link to="/contacto" className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors uppercase tracking-widest">Contacto</Link>
        <a href="#" className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors uppercase tracking-widest">Nosotros</a>
        <a href="#" className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors uppercase tracking-widest">Ayuda</a>
        {user && (
          <Link to="/dashboard" className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors uppercase tracking-widest">Dashboard</Link>
        )}
      </div>

      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" className="hidden sm:flex text-muted-foreground hover:text-primary">
          <Search className="w-5 h-5" />
        </Button>
        
        {user ? (
          <div className="flex items-center gap-4">
            <Link to="/perfil" className="flex items-center gap-2 hover:text-primary transition-colors">
              <img src={user.photoURL || ''} alt="Avatar" className="w-8 h-8 rounded-full border border-primary/20" />
              <span className="text-sm font-bold hidden lg:inline-block">{user.displayName}</span>
            </Link>
            <Button variant="ghost" size="icon" onClick={logout} className="text-muted-foreground hover:text-red-500">
              <LogOut className="w-5 h-5" />
            </Button>
          </div>
        ) : (
          <Button variant="ghost" onClick={login} className="hidden sm:flex font-semibold hover:text-primary">
            Iniciar Sesión
          </Button>
        )}

        <Link to="/eventos">
          <Button className="orange-gradient border-none font-bold px-6 shadow-lg shadow-primary/20 hover:scale-105 transition-transform">
            Comprar Entradas
          </Button>
        </Link>
        <Button variant="ghost" size="icon" className="md:hidden">
          <Menu className="w-6 h-6" />
        </Button>
      </div>
    </nav>
  );
}
