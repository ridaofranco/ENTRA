import { Link } from 'react-router-dom';

export function Footer() {
  return (
    <footer className="bg-[#09090b] border-t border-white/5 py-16 px-6 font-sans">
      <div className="max-w-7xl mx-auto flex flex-col items-center text-center space-y-8">
        {/* Brand & Power Line */}
        <div className="flex items-center gap-3">
          <span className="font-heading font-black text-2xl tracking-tighter uppercase text-white">
            ENTR<span className="text-primary">Á</span>
          </span>
          <span className="text-white/20">|</span>
          <span className="text-xs uppercase tracking-widest text-muted-foreground font-bold">
            Powered by Somos DER
          </span>
        </div>

        {/* Links */}
        <div className="flex flex-wrap justify-center items-center gap-x-8 gap-y-4 text-xs uppercase tracking-wider text-muted-foreground font-bold">
          <Link to="/eventos" className="hover:text-primary transition-colors">Eventos</Link>
          <Link to="/productores" className="hover:text-primary transition-colors">Productores</Link>
          <Link to="/ayuda" className="hover:text-primary transition-colors">Ayuda</Link>
          <Link to="/contacto" className="hover:text-primary transition-colors">Sobre Nosotros</Link>
          <Link to="/contacto" className="hover:text-border hover:text-white transition-colors">Términos</Link>
          <Link to="/contacto" className="hover:text-border hover:text-white transition-colors">Privacidad</Link>
        </div>

        {/* Contacts */}
        <div className="pt-4 border-t border-white/5 w-full max-w-md flex flex-col sm:flex-row justify-center items-center gap-x-6 gap-y-2 text-xs text-muted-foreground font-mono">
          <a href="mailto:contacto@somosder.com.ar" className="hover:text-primary transition-colors">
            contacto@somosder.com.ar
          </a>
          <span className="hidden sm:inline text-white/5">•</span>
          <span>+54 9 11 7154-0675</span>
        </div>
      </div>
    </footer>
  );
}
