import * as React from 'react';
import { motion } from 'framer-motion';
import { Card } from '@/src/components/ui/card';
import { Button } from '@/src/components/ui/button';
import { Input } from '@/src/components/ui/input';
import { Textarea } from '@/src/components/ui/textarea';
import { Mail, MessageSquare, Instagram, Twitter, MapPin, Send } from 'lucide-react';

export default function Contact() {
  // ⚠️ ESTE FORMULARIO NO HACÍA NADA HASTA EL 7/9/2026. No tenía `onSubmit`, ni
  // `name` en los campos, ni destino: la persona escribía, apretaba "Enviar
  // Mensaje" y el mensaje no llegaba a ningún lado. Es peor que no tener
  // formulario, porque aparenta funcionar y la persona se queda esperando una
  // respuesta que nunca iba a llegar.
  //
  // Ahora manda a /api/lead, que es el puente al receptor único del ecosistema:
  // el lead queda guardado en la misma lista que los de somosder.ar, el aviso va
  // a contacto@ con [ENTRA] en el asunto, y la confirmación le llega al cliente
  // con la marca ENTRÁ.
  const [enviando, setEnviando] = React.useState(false);
  const [listo, setListo] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const name = String(fd.get('name') || '').trim();
    const email = String(fd.get('email') || '').trim();
    const mensaje = String(fd.get('mensaje') || '').trim();

    setError(null);
    if (!name || !email || !mensaje) return setError('Completá tu nombre, tu email y el mensaje.');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return setError('Ese email no parece válido. Revisalo.');

    setEnviando(true);
    try {
      // El destino tarda unos segundos: manda dos mails y escribe en la base
      // antes de contestar. Por eso el botón avisa que está enviando.
      const r = await fetch('/api/lead', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          email,
          asunto: String(fd.get('asunto') || '').trim(),
          mensaje,
          sitio: String(fd.get('sitio') || ''),
        }),
      });
      if (r.ok) { setListo(true); return; }
      setError(r.status === 429
        ? 'Recibimos varios envíos seguidos. Esperá un minuto y probá de nuevo.'
        : 'No pudimos enviarlo. Probá de nuevo, o escribinos a contacto@somosder.com.ar.');
    } catch {
      setError('No pudimos enviarlo. Probá de nuevo, o escribinos a contacto@somosder.com.ar.');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="pt-40 pb-20 px-6 max-w-7xl mx-auto">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-20">
        {/* Left: Info */}
        <div className="space-y-12">
          <div>
            <h1 className="text-5xl md:text-7xl font-heading font-black tracking-tighter uppercase mb-6">
              Hablemos de tu <span className="orange-text-gradient">Próximo Evento</span>
            </h1>
            <p className="text-xl text-muted-foreground leading-relaxed">
              Estamos acá para ayudarte a que tu evento sea un éxito. Escribinos y nuestro equipo se pondrá en contacto con vos en menos de 24hs.
            </p>
          </div>

          <div className="space-y-8">
            <div className="flex items-center gap-6 group">
              <div className="w-14 h-14 bg-primary/10 rounded-2xl flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
                <Mail className="w-6 h-6" />
              </div>
              <div>
                <div className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-1">Email Directo</div>
                <a href="mailto:contacto@somosder.com.ar" className="text-xl font-bold hover:text-primary transition-colors">contacto@somosder.com.ar</a>
              </div>
            </div>

            <div className="flex items-center gap-6 group">
              <div className="w-14 h-14 bg-primary/10 rounded-2xl flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
                <MapPin className="w-6 h-6" />
              </div>
              <div>
                <div className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-1">Oficinas</div>
                {/* Decisión de Franco (31/7): el domicilio es el mismo en TODOS los
                    productos, el de SOMOS DER. Antes acá decía "Palermo Soho, CABA"
                    y en somosder.ar "Aráoz 1146, Palermo, CABA": dos direcciones
                    distintas para la misma empresa. Si cambia, cambia en los cinco. */}
                <div className="text-xl font-bold">Aráoz 1146, Palermo, CABA, Argentina</div>
              </div>
            </div>
          </div>

          <div className="flex gap-4">
            {[Instagram, Twitter].map((Icon, i) => (
              <Button key={i} variant="outline" size="icon" className="w-14 h-14 rounded-2xl border-white/10 hover:border-primary hover:text-primary transition-all">
                <Icon className="w-6 h-6" />
              </Button>
            ))}
          </div>
        </div>

        {/* Right: Form */}
        <Card className="glass p-10 rounded-[3rem] border-white/5">
          {listo ? (
            <div className="text-center py-10">
              <div className="text-3xl font-heading font-black uppercase tracking-tighter mb-4">Listo, nos llegó</div>
              <p className="text-lg text-muted-foreground leading-relaxed">
                Te escribimos a la casilla que dejaste, dentro de las 24 horas hábiles.
                Revisá también el correo no deseado, por las dudas.
              </p>
            </div>
          ) : (
          <form className="space-y-6" method="post" onSubmit={onSubmit}>
            {/* Honeypot: invisible para una persona, tentador para un script. */}
            <input type="text" name="sitio" tabIndex={-1} autoComplete="off" aria-hidden="true"
                   className="absolute left-[-9999px] w-px h-px overflow-hidden" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Nombre</label>
                <Input name="name" required maxLength={120} autoComplete="name" placeholder="Tu nombre" className="bg-white/5 border-white/10 h-14 rounded-2xl" />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Email</label>
                <Input name="email" type="email" required maxLength={200} autoComplete="email" placeholder="tu@email.com" className="bg-white/5 border-white/10 h-14 rounded-2xl" />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Asunto</label>
              <Input name="asunto" maxLength={200} placeholder="¿En qué podemos ayudarte?" className="bg-white/5 border-white/10 h-14 rounded-2xl" />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Mensaje</label>
              <Textarea name="mensaje" required maxLength={2000} placeholder="Contanos más detalles..." className="bg-white/5 border-white/10 min-h-[150px] rounded-2xl" />
            </div>
            {error && (
              <p className="text-sm text-red-400 border-l-2 border-red-400 pl-3">{error}</p>
            )}
            <Button type="submit" disabled={enviando} className="w-full h-16 orange-gradient border-none font-bold text-lg rounded-2xl transition-all disabled:opacity-60">
              <Send className="w-5 h-5 mr-2" />
              {enviando ? 'Enviando...' : 'Enviar Mensaje'}
            </Button>
          </form>
          )}
        </Card>
      </div>
    </div>
  );
}
