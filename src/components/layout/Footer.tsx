import { Link } from 'react-router-dom';
import { useAuth } from '@/src/context/AuthContext';

export function Footer() {
  const { profile } = useAuth();
  const isOrganizer = profile?.role === 'organizer' || profile?.role === 'admin';

  return (
    <footer className="bg-background border-t border-white/5 pt-20 pb-10 px-6">
      <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-12 mb-16">
        <div className="space-y-6">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center text-white font-black text-lg">
              E
            </div>
            <span className="font-heading font-black text-xl tracking-tighter">
              ENTR<span className="text-primary">Á</span>
            </span>
          </Link>
          <p className="text-muted-foreground text-sm leading-relaxed max-w-xs">
            La ticketera que Argentina merecía. Comisiones justas, tecnología de punta y la mejor experiencia para tus asistentes.
          </p>
          <div className="flex items-center gap-2 text-xs font-bold text-muted-foreground">
            <div className="w-5 h-5 bg-primary rounded flex items-center justify-center text-[10px] text-white">D</div>
            Powered by Somos DER
          </div>
        </div>

        <div>
          <h4 className="font-heading font-bold text-primary text-sm uppercase tracking-widest mb-6">Producto</h4>
          <ul className="space-y-4 text-sm text-muted-foreground">
            <li><Link to="/eventos" className="hover:text-primary transition-colors">Explorar Eventos</Link></li>
            <li><Link to="/crear-evento" className="hover:text-primary transition-colors">Vender Entradas</Link></li>
            <li><Link to="/dashboard" className="hover:text-primary transition-colors">Dashboard</Link></li>
            <li><Link to="/perfil" className="hover:text-primary transition-colors">Mi Perfil</Link></li>
            {isOrganizer && (
              <li><Link to="/control-acceso" className="hover:text-primary transition-colors">Control de Accesos</Link></li>
            )}
            <li><a href="#" className="hover:text-primary transition-colors">White Label</a></li>
          </ul>
        </div>

        <div>
          <h4 className="font-heading font-bold text-primary text-sm uppercase tracking-widest mb-6">Empresa</h4>
          <ul className="space-y-4 text-sm text-muted-foreground">
            <li><a href="#" className="hover:text-primary transition-colors">Sobre Nosotros</a></li>
            <li><a href="https://somosder.ar" target="_blank" className="hover:text-primary transition-colors">Somos DER</a></li>
            <li><a href="#" className="hover:text-primary transition-colors">Blog</a></li>
            <li><Link to="/contacto" className="hover:text-primary transition-colors">Contacto</Link></li>
          </ul>
        </div>

        <div>
          <h4 className="font-heading font-bold text-primary text-sm uppercase tracking-widest mb-6">Legal</h4>
          <ul className="space-y-4 text-sm text-muted-foreground">
            <li><a href="#" className="hover:text-primary transition-colors">Términos y Condiciones</a></li>
            <li><a href="#" className="hover:text-primary transition-colors">Privacidad</a></li>
            <li><a href="#" className="hover:text-primary transition-colors">Política de Cookies</a></li>
          </ul>
        </div>
      </div>

      <div className="max-w-7xl mx-auto pt-8 border-t border-white/5 flex flex-col md:flex-row justify-between items-center gap-4 text-xs text-muted-foreground">
        <p>© 2026 ENTRÁ by Somos DER. Todos los derechos reservados.</p>
        <div className="flex items-center gap-6">
          <a href="mailto:contacto@somosder.com.ar" className="hover:text-primary transition-colors">contacto@somosder.com.ar</a>
          <span>+54 9 11 7154-0675</span>
        </div>
      </div>
    </footer>
  );
}
