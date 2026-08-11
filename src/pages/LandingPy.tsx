// ============================================================================
// ENTRÁ PARAGUAY — /py
// ============================================================================
// Primera plaza fuera de Argentina. Es una página propia y no un parámetro de la
// home argentina, por una razón concreta: la plata. Los eventos paraguayos
// cotizan en guaraníes y los argentinos en pesos; mezclarlos en una sola
// cartelera es la forma más rápida de que alguien lea mal un precio.
//
// ── QUÉ SE PUEDE HACER HOY, Y QUÉ NO ──
// MercadoPago no opera en Paraguay, así que todavía no hay con qué cobrar. Lo
// que SÍ funciona de punta a punta, sin ningún procesador, es la reserva sin
// cargo: create-payment resuelve los eventos gratis por su cuenta (emite los
// tickets con QR de servidor, descuenta stock y manda el mail), y en la puerta
// se escanean igual que cualquier otro. Por eso esta página habla de reservar,
// no de comprar: es lo que el sistema hace de verdad hoy.
// La bandera está en src/lib/paises.ts (`cobra: false`) y el freno duro está en
// el servidor (create-payment), no acá.

import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Calendar, Music, QrCode, Mail, ScanLine } from 'lucide-react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '@/src/lib/firebase';
import HeroAtmosphere from '@/src/components/HeroAtmosphere';
import PosterFallback from '@/src/components/PosterFallback';
import { eventPath } from '@/src/lib/slug';
import { isEventFinished, formatCurrency } from '@/src/lib/utils';
import { PAISES } from '@/src/lib/paises';

interface Event {
  id: string;
  title: string;
  date: any;
  venue: string;
  location: string;
  price: number;
  image: string;
  status?: string;
  isFree?: boolean;
  isDateTBD?: boolean;
  isVenueTBD?: boolean;
}

const PY = PAISES.PY;

const COMO_FUNCIONA = [
  {
    icon: Calendar,
    titulo: 'Publicás tu evento',
    desc: 'Creás tu cuenta y cargás fecha, lugar y cuántos lugares tenés. Lo revisamos y sale publicado.',
  },
  {
    icon: Mail,
    titulo: 'Tu público reserva',
    desc: 'Reservan su lugar sin crearse cuenta y les llega el QR al mail, con el ticket en PDF.',
  },
  {
    icon: ScanLine,
    titulo: 'Escaneás en la puerta',
    desc: 'Validás cada QR desde el celular. Se escanea una sola vez: si vuelve a pasar, lo rechaza.',
  },
];

export default function LandingPy() {
  const [eventos, setEventos] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const traer = async () => {
      try {
        const snap = await getDocs(collection(db, 'events'));
        const py = snap.docs
          .map(d => ({ id: d.id, ...d.data() }) as Event)
          // Solo Paraguay. A diferencia de la home argentina, acá NO hay fallback:
          // un evento sin país es argentino, y no tiene nada que hacer en esta lista.
          .filter(e => (e as any).country === 'PY')
          .filter(e => (!e.status || e.status === 'active') && !(e as any).hidden && !isEventFinished(e))
          .sort((a, b) => (a.date?.toDate?.()?.getTime?.() || 0) - (b.date?.toDate?.()?.getTime?.() || 0))
          .slice(0, 6);
        setEventos(py);
      } catch (error) {
        console.error('[LandingPy] Error al traer eventos:', error);
      } finally {
        setLoading(false);
      }
    };
    traer();
  }, []);

  const fecha = (d: any) =>
    d?.toDate
      ? d.toDate().toLocaleDateString(PY.locale, { weekday: 'short', day: 'numeric', month: 'short' })
      : '';

  return (
    <div className="bg-[#09090b] text-foreground min-h-screen">

      {/* HERO */}
      <section className="relative min-h-screen flex flex-col justify-center overflow-hidden px-6">
        <HeroAtmosphere />
        <div className="max-w-7xl mx-auto w-full pt-20 relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="space-y-8"
          >
            <span className="inline-block text-[10px] font-sans font-black tracking-[0.3em] uppercase text-primary">
              ENTRÁ · Paraguay
            </span>
            <div className="space-y-6">
              <h1 className="text-[clamp(2rem,11vw,3rem)] sm:text-7xl md:text-8xl lg:text-[100px] font-heading font-black tracking-tighter leading-[0.9] sm:leading-[0.85] uppercase select-none break-words">
                Acceso a<br />
                <span className="orange-text-gradient">experiencias</span><br />
                en vivo.
              </h1>
              <p className="max-w-xl text-base sm:text-lg text-muted-foreground leading-relaxed font-sans">
                ENTRÁ llega a Paraguay. Publicás tu evento, tu público reserva su lugar sin
                crearse cuenta y recibe el QR al mail. En la puerta lo escaneás desde el celular.
              </p>
            </div>

            <div className="flex flex-wrap gap-4 pt-4">
              <Link to="/crear-evento">
                <Button className="h-14 px-10 orange-gradient border-none text-white text-base rounded-xl transition-all hover:brightness-110 font-heading font-black uppercase tracking-wide">
                  Crear mi evento
                </Button>
              </Link>
              <a href="mailto:soporte@entratickets.com?subject=ENTR%C3%81%20en%20Paraguay">
                <Button variant="outline" className="h-14 px-10 rounded-xl bg-white/[0.03] border border-white/10 text-white text-base hover:bg-white/[0.06] hover:border-white/20 transition-all font-heading font-black uppercase tracking-wide">
                  Tengo una duda
                </Button>
              </a>
            </div>
          </motion.div>
        </div>
      </section>

      {/* CARTELERA PARAGUAYA */}
      <section className="max-w-7xl mx-auto px-6 py-24 space-y-16">
        <div>
          <span className="block text-[10px] font-bold text-primary uppercase tracking-[0.2em] font-sans">
            En Cartelera · Paraguay
          </span>
          <h2 className="text-4xl md:text-5xl font-heading font-black tracking-tighter uppercase mt-5" style={{ lineHeight: '1.15' }}>
            Lo que viene.
          </h2>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[1, 2, 3].map(i => (
              <div key={i} className="aspect-[4/5] bg-white/[0.02] border border-white/5 rounded-3xl animate-pulse" />
            ))}
          </div>
        ) : eventos.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {eventos.map((evento, i) => {
              const tks: any[] = (evento as any).tickets || [];
              const disponibles = tks.reduce((s, t) => s + (Number(t.available) || 0), 0);
              const agotado = tks.length > 0 && disponibles <= 0;
              return (
                <motion.div
                  key={evento.id}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1 }}
                  className="group"
                >
                  <Link to={eventPath(evento)}>
                    <div className="flex flex-col h-full space-y-4">
                      <div className="relative aspect-[4/5] rounded-[2rem] border border-white/10 overflow-hidden bg-black group-hover:border-primary/40 transition-colors duration-300">
                        {evento.image ? (
                          <img src={evento.image} alt={evento.title} className="w-full h-full object-cover transition duration-500" referrerPolicy="no-referrer" />
                        ) : (
                          <PosterFallback />
                        )}
                        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/10 to-transparent opacity-80" />
                        <div className="absolute top-6 left-6">
                          <span className={`text-[10px] font-sans font-bold tracking-widest px-3.5 py-1.5 rounded-full border backdrop-blur-md uppercase ${agotado ? 'border-white/10 text-muted-foreground' : 'border-primary/20 text-primary'}`}>
                            {agotado ? 'Agotado' : 'Abierto'}
                          </span>
                        </div>
                        <div className="absolute bottom-6 left-6 right-6 space-y-1 text-white">
                          <p className="text-[10px] font-bold text-primary uppercase tracking-[0.2em] font-sans">
                            {evento.isDateTBD ? 'Próximamente' : fecha(evento.date)}
                          </p>
                          <h3 className="text-xl md:text-2xl font-heading font-black tracking-tight uppercase leading-none">
                            {evento.title}
                          </h3>
                        </div>
                      </div>
                      <div className="px-2 flex justify-between items-center text-sm">
                        <span className="text-muted-foreground font-sans tracking-wide">
                          {evento.isVenueTBD ? 'Lugar por confirmar' : evento.venue}
                        </span>
                        <span className="font-heading font-black text-primary text-base">
                          {evento.isFree || !evento.price ? 'Sin cargo' : formatCurrency(evento.price, 'PY')}
                        </span>
                      </div>
                    </div>
                  </Link>
                </motion.div>
              );
            })}
          </div>
        ) : (
          <div className="glass rounded-[2rem] border-white/5 p-16 text-center max-w-xl mx-auto space-y-4">
            <Music className="w-10 h-10 text-primary mx-auto opacity-40" />
            <h3 className="font-heading font-black text-xl uppercase">¿Tu evento acá?</h3>
            <p className="text-sm text-muted-foreground leading-relaxed font-sans">
              Estamos abriendo la cartelera en Paraguay. Si producís, publicá el tuyo y sos de los primeros.
            </p>
            <div className="pt-2">
              <Link to="/crear-evento">
                <Button className="h-12 px-8 orange-gradient border-none text-white rounded-xl transition-all hover:brightness-110 font-heading font-black uppercase text-xs tracking-wide">
                  Publicar mi evento
                </Button>
              </Link>
            </div>
          </div>
        )}
      </section>

      {/* CÓMO FUNCIONA */}
      <section className="bg-black py-28 border-y border-white/5 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="mb-14">
            <span className="block text-[10px] font-bold text-primary uppercase tracking-[0.3em] font-sans">Cómo funciona</span>
            <h2 className="text-4xl md:text-5xl font-heading font-black tracking-tighter uppercase text-white mt-5" style={{ lineHeight: '1.1' }}>
              Tres pasos. Nada más.
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {COMO_FUNCIONA.map((paso, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="p-7 rounded-3xl bg-white/[0.02] border border-white/5"
              >
                <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary mb-5">
                  <paso.icon className="w-6 h-6" />
                </div>
                <h3 className="font-heading font-black text-xl text-white uppercase tracking-tight mb-2">{paso.titulo}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed font-sans">{paso.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* LA ETAPA EN LA QUE ESTAMOS — dicho de frente, no escondido */}
      <section className="max-w-4xl mx-auto px-6 py-24">
        <div className="glass rounded-[2.5rem] border-white/10 p-10 md:p-12 space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
            <QrCode className="w-6 h-6" />
          </div>
          <h2 className="text-2xl md:text-3xl font-heading font-black tracking-tight uppercase">
            Arrancamos con reservas sin cargo
          </h2>
          <p className="text-muted-foreground font-sans leading-relaxed">
            En Paraguay todavía no cobramos entradas: estamos trabajando en el medio de pago local.
            Mientras tanto, todo el resto funciona igual que en Argentina — tu público reserva su
            lugar, recibe el QR por mail y en la puerta lo escaneás desde el celular, con el control
            de acceso andando incluso sin señal.
          </p>
          <p className="text-muted-foreground font-sans leading-relaxed">
            Si querés vender con cobro en Paraguay, escribinos y te avisamos apenas esté.
          </p>
          <div className="pt-2">
            <a href="mailto:soporte@entratickets.com?subject=Cobro%20en%20Paraguay">
              <Button variant="outline" className="h-12 px-8 rounded-xl bg-white/[0.03] border border-white/10 text-white hover:bg-white/[0.06] hover:border-white/20 font-heading font-black uppercase text-xs tracking-wide">
                Quiero que me avisen
              </Button>
            </a>
          </div>
        </div>
      </section>

      {/* CTA FINAL */}
      <section className="bg-black py-32 border-t border-white/5 text-center px-6">
        <div className="max-w-4xl mx-auto space-y-10">
          <h2 className="text-6xl sm:text-7xl md:text-8xl font-heading font-black tracking-tighter leading-none uppercase text-white select-none">
            ENTR<span className="orange-text-gradient">Á.</span>
          </h2>
          <Link to="/crear-evento">
            <Button className="h-16 px-12 orange-gradient border-none text-white text-lg rounded-xl transition-all hover:brightness-110 font-heading font-black uppercase tracking-wide">
              Crear mi evento
            </Button>
          </Link>
        </div>
      </section>

    </div>
  );
}
