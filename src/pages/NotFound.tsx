import { Link } from 'react-router-dom';
import { Button } from '@/src/components/ui/button';
import { Card } from '@/src/components/ui/card';
import { Compass } from 'lucide-react';

// Catch-all 404. Antes cualquier URL rota (incluido /login, que no existe:
// el login real vive en /auth/login) renderizaba solo header y footer, una
// pantalla "viva" pero vacía y sin salida. Ahora hay cartel claro y CTA.
export default function NotFound() {
  return (
    <div className="pt-32 pb-20 px-6 max-w-xl mx-auto">
      <Card className="glass p-10 rounded-[2.5rem] border-white/10 text-center space-y-6">
        <div className="flex justify-center">
          <div className="w-20 h-20 rounded-full flex items-center justify-center bg-primary/15 text-primary">
            <Compass className="w-10 h-10" />
          </div>
        </div>

        <div className="space-y-2">
          <h1 className="text-3xl font-heading font-black tracking-tighter uppercase">
            Esta página no existe
          </h1>
          <p className="text-muted-foreground text-sm leading-relaxed">
            El link puede estar mal escrito o ser viejo. Lo bueno sigue estando: mirá los eventos o volvé al inicio.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
          <Link to="/eventos">
            <Button className="w-full sm:w-auto rounded-full font-bold orange-gradient border-none">
              Ver los eventos
            </Button>
          </Link>
          <Link to="/">
            <Button
              variant="ghost"
              className="w-full sm:w-auto rounded-full hover:bg-primary/10 hover:text-primary"
            >
              Ir al inicio
            </Button>
          </Link>
        </div>
      </Card>
    </div>
  );
}
