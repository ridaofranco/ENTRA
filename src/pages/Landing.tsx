import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowRight, Calendar, MapPin, Search, Music, QrCode } from 'lucide-react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '@/src/lib/firebase';
import { seedEventsIfMissing } from '@/src/services/eventService';
import { useAuth } from '@/src/context/AuthContext';
import HeroAtmosphere from '@/src/components/HeroAtmosphere';
import PosterFallback from '@/src/components/PosterFallback';
import { eventPath } from '@/src/lib/slug';
import { isEventFinished } from '@/src/lib/utils';
import { useLang, textos, dateLocale } from '@/src/lib/i18n';

interface Event {
  id: string;
  title: string;
  date: any;
  venue: string;
  location: string;
  price: number;
  image: string;
  category: string;
  status?: string;
}

export default function Landing() {
  const { user } = useAuth();
  const lang = useLang();
  const t = textos(lang);
  const loc = dateLocale(lang);
  const [featuredEvents, setFeaturedEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);

  // La home cambia de cara segun haya o no cartelera.
  // Sin eventos a la venta, el unico visitante que puede dejar plata es un productor,
  // asi que el hero le habla a el. Cuando entra el primer evento vuelve solo al modo
  // comprador, sin que nadie tenga que acordarse de deshacer nada.
  // Arranca en modo productor a proposito: es el estado real mientras la cartelera este
  // vacia, y asi no parpadea en el caso de hoy (que es el 100% de las visitas).
  const modoProductor = loading || featuredEvents.length === 0;

  useEffect(() => {
    const init = async () => {
      await seedEventsIfMissing();

      try {
        const snapshot = await getDocs(collection(db, 'events'));
        const all = snapshot.docs
          .map(d => ({ id: d.id, ...d.data() }) as Event)
          // Un evento finalizado no puede seguir ofreciendose en la home:
          // sale de la cartelera (el detalle por URL directa sigue visible).
          .filter(e => (!e.status || e.status === 'active') && !(e as any).hidden && !isEventFinished(e))
          .sort((a, b) => {
            const da = a.date?.toDate?.()?.getTime?.() || 0;
            const db2 = b.date?.toDate?.()?.getTime?.() || 0;
            return da - db2;
          })
          .slice(0, 6);

        setFeaturedEvents(all);
      } catch (error) {
        console.error('[Landing] Error fetching events:', error);
      } finally {
        setLoading(false);
      }
    };

    init();
  }, []);

  const formatDate = (date: any) => {
    if (date?.toDate) {
      return date.toDate().toLocaleDateString(loc, {
        weekday: 'short', day: 'numeric', month: 'short'
      });
    }
    return '';
  };

  // 4 real Argentine scene raw photograph concepts (authentic concert lights, atmosphere)
  const culturalImages = [
    { url: 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=600&auto=format&fit=crop&q=80', caption: 'backstage / cabina' },
    { url: 'https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?w=600&auto=format&fit=crop&q=80', caption: 'crowd real' },
    { url: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=600&auto=format&fit=crop&q=80', caption: 'nightlife sound' },
    { url: 'https://images.unsplash.com/photo-1506157786151-b8491531f063?w=600&auto=format&fit=crop&q=80', caption: 'cemento y luces' }
  ];

  return (
    <div className="bg-[#09090b] text-foreground min-h-screen">
      
      {/* 1. HERO — full screen, dark, atmospheric */}
      <section className="relative min-h-screen flex flex-col justify-center overflow-hidden px-6">
        {/* Atmósfera de marca: glows que respiran + brasas sutiles (detrás del texto) */}
        <HeroAtmosphere />

        <div className="max-w-7xl mx-auto w-full pt-20 relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="space-y-8"
          >
            {modoProductor ? (
              <>
                <div className="space-y-6">
                  <h1 className="text-[clamp(2rem,10vw,2.75rem)] sm:text-6xl md:text-7xl lg:text-[84px] font-heading font-black tracking-tighter leading-[0.95] sm:leading-[0.88] uppercase select-none break-words">
                    {t.home.prodTituloA}<br />
                    {t.home.prodTituloB}<br />
                    {t.home.prodTituloC}<span className="orange-text-gradient">100%</span>{t.home.prodTituloD}
                  </h1>
                  <p className="max-w-2xl text-base sm:text-lg text-muted-foreground leading-relaxed font-sans">
                    {t.home.prodBajada}
                  </p>
                </div>

                <div className="flex flex-col sm:flex-row sm:flex-wrap gap-4 pt-4">
                  {/* Al alta directa, no a WhatsApp: crear la cuenta es un clic y el
                      evento igual pasa por revisión antes de salir a la venta. */}
                  <Link to="/crear-evento" className="w-full sm:w-auto">
                    <Button className="w-full sm:w-auto h-14 px-6 sm:px-10 orange-gradient border-none text-white text-sm sm:text-base rounded-xl transition-all hover:brightness-110 font-heading font-black uppercase tracking-wide">
                      {t.home.prodCta}
                    </Button>
                  </Link>
                  <Link to="/eventos" className="w-full sm:w-auto">
                    <Button variant="outline" className="w-full sm:w-auto h-14 px-6 sm:px-10 rounded-xl bg-white/[0.03] border border-white/10 text-white text-sm sm:text-base hover:bg-white/[0.06] hover:border-white/20 transition-all font-heading font-black uppercase tracking-wide">
                      {t.home.verCartelera}
                    </Button>
                  </Link>
                </div>
              </>
            ) : (
              <>
                <div className="space-y-6">
                  <h1 className="text-[clamp(2rem,11vw,3rem)] sm:text-7xl md:text-8xl lg:text-[100px] font-heading font-black tracking-tighter leading-[0.9] sm:leading-[0.85] uppercase select-none break-words">
                    {t.home.compradorTituloA}<br />
                    <span className="orange-text-gradient">{t.home.compradorTituloB}</span><br />
                    {t.home.compradorTituloC}
                  </h1>
                  <p className="max-w-xl text-base sm:text-lg text-muted-foreground leading-relaxed font-sans">
                    {t.home.compradorBajada}
                  </p>
                </div>

                <div className="flex flex-col sm:flex-row sm:flex-wrap gap-4 pt-4">
                  <Link to="/eventos" className="w-full sm:w-auto">
                    <Button className="w-full sm:w-auto h-14 px-6 sm:px-10 orange-gradient border-none text-white text-sm sm:text-base rounded-xl transition-all hover:brightness-110 font-heading font-black uppercase tracking-wide">
                      {t.home.verCartelera}
                    </Button>
                  </Link>
                  <Link to={user ? "/perfil" : "/auth/login"} className="w-full sm:w-auto">
                    <Button variant="outline" className="w-full sm:w-auto h-14 px-6 sm:px-10 rounded-xl bg-white/[0.03] border border-white/10 text-white text-sm sm:text-base hover:bg-white/[0.06] hover:border-white/20 transition-all font-heading font-black uppercase tracking-wide">
                      {t.home.misTickets}
                    </Button>
                  </Link>
                </div>
              </>
            )}
          </motion.div>
        </div>
      </section>

      {/* 3. EVENTOS EN VIVO (Posters editoriales, sin cajas de e-commerce, limpio, aire) */}
      <section className="max-w-7xl mx-auto px-6 py-24 space-y-16">
        <div>
          <span className="block text-[10px] font-bold text-primary uppercase tracking-[0.2em] font-sans">{t.home.enCartelera}</span>
          <h2 className="text-4xl md:text-5xl font-heading font-black tracking-tighter uppercase mt-5" style={{ lineHeight: '1.15' }}>
            {t.home.loQueViene}
          </h2>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[1, 2, 3].map(i => (
              <div key={i} className="aspect-[4/5] bg-white/[0.02] border border-white/5 rounded-3xl animate-pulse" />
            ))}
          </div>
        ) : featuredEvents.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {featuredEvents.map((event, i) => {
              // Etiqueta de stock REAL según disponibilidad de las entradas
              const tks: any[] = (event as any).tickets || [];
              const totalAvail = tks.reduce((s, t) => s + (Number(t.available) || 0), 0);
              const soldOut = tks.length > 0 && tks.every(t => (Number(t.available) || 0) <= 0);
              let statusText = t.home.abierto;
              let statusClasses = "border-primary/20 text-primary";
              if (soldOut) {
                statusText = t.home.agotado;
                statusClasses = "border-white/10 text-muted-foreground";
              } else if (totalAvail > 0 && totalAvail < 10) {
                statusText = t.home.ultimos;
                statusClasses = "border-orange-500/30 text-orange-400 bg-orange-950/20";
              }

              return (
                <motion.div
                  key={event.id}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1 }}
                  className="group"
                >
                  <Link to={eventPath(event)}>
                    <div className="flex flex-col h-full space-y-4">
                      {/* Image Frame */}
                      <div className="relative aspect-[4/5] rounded-[2rem] border border-white/10 overflow-hidden bg-black group-hover:border-primary/40 transition-colors duration-300">
                        {event.image ? (
                          <img
                            src={event.image}
                            alt={event.title}
                            className="w-full h-full object-cover transition duration-500"
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <PosterFallback />
                        )}
                        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/10 to-transparent opacity-80" />
                        
                        {/* Status Label */}
                        <div className="absolute top-6 left-6">
                          <span className={`text-[10px] font-sans font-bold tracking-widest px-3.5 py-1.5 rounded-full border backdrop-blur-md uppercase ${statusClasses}`}>
                            {statusText}
                          </span>
                        </div>

                        {/* Location Details inside visual */}
                        <div className="absolute bottom-6 left-6 right-6 space-y-1 text-white">
                          <p className="text-[10px] font-bold text-primary uppercase tracking-[0.2em] font-sans">
                            {event.isDateTBD ? t.comun.proximamente : formatDate(event.date)}
                          </p>
                          <h3 className="text-xl md:text-2xl font-heading font-black tracking-tight uppercase leading-none">
                            {event.title}
                          </h3>
                        </div>
                      </div>

                      {/* Poster Details label details below */}
                      <div className="px-2 flex justify-between items-center text-sm">
                        <span className="text-muted-foreground font-sans tracking-wide">
                          {event.isVenueTBD ? t.comun.lugarPorConfirmar : event.venue}
                        </span>
                        <span className="font-heading font-black text-primary text-base">
                          ${(event.price || 0).toLocaleString('es-AR')}
                        </span>
                      </div>
                    </div>
                  </Link>
                </motion.div>
              );
            })}
          </div>
        ) : (
          /* Cartelera vacia: en vez de pedirle paciencia al que llega, se le pide algo.
             El unico que puede convertir con la cartelera vacia es un productor. */
          <div className="glass rounded-[2rem] border-white/5 p-16 text-center max-w-xl mx-auto space-y-4">
            <Music className="w-10 h-10 text-primary mx-auto opacity-40" />
            <h3 className="font-heading font-black text-xl uppercase">{t.home.vacioTitulo}</h3>
            <p className="text-sm text-muted-foreground leading-relaxed font-sans">
              {t.home.vacioTexto}
            </p>
            <div className="pt-2">
              <Link to="/crear-evento">
                <Button className="h-12 px-8 orange-gradient border-none text-white rounded-xl transition-all hover:brightness-110 font-heading font-black uppercase text-xs tracking-wide">
                  {t.home.vacioCta}
                </Button>
              </Link>
            </div>
          </div>
        )}
      </section>

      {/* 4. EL ACCESO (Antifraude, contado emocional, no técnico) */}
      <section className="bg-black py-28 border-y border-white/5">
        <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className=""
          >
            <span className="block text-[10px] font-bold text-primary uppercase tracking-[0.3em] font-sans">
              {t.home.seguridadKicker}
            </span>
            <h2 className="text-4xl md:text-5xl lg:text-6xl font-heading font-black tracking-tighter uppercase max-w-[673px] mt-5" style={{ lineHeight: '1.15' }}>
              {t.home.seguridadTituloA}<br />
              {t.home.seguridadTituloB}
            </h2>
            <p className="text-lg text-muted-foreground font-sans leading-relaxed mt-6">
              {t.home.seguridadTexto}
            </p>
          </motion.div>

          {/* Genuine Big QR code card, clean, no hype decoration */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            className="flex justify-center"
          >
            <div className="glass p-10 rounded-[3rem] border-white/10 relative overflow-hidden bg-white/[0.01]">
              <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full filter blur-xl pointer-events-none" />
              <div className="border border-white/10 rounded-2xl p-6 bg-white/[0.02]">
                {/* Genuine styled vector look of a clean QR */}
                <QrCode className="w-64 h-64 text-white font-thin" strokeWidth={1} />
              </div>
              <div className="text-center mt-6">
                <span className="inline-flex items-center gap-2 text-[10px] font-sans font-bold uppercase tracking-[0.25em] text-primary bg-primary/5 px-4 py-1.5 rounded-full border border-primary/20">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                  {t.home.qrUnico}
                </span>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* 5. CULTURA — photographic, raw, real, argentinian, nightlife */}
      <section className="max-w-7xl mx-auto px-6 py-28 space-y-16">
        <div>
          <span className="block text-[10px] font-bold text-primary uppercase tracking-[0.2em] font-sans">{t.home.escenaKicker}</span>
          <h2 className="text-4xl md:text-5xl font-heading font-black tracking-tighter uppercase mt-5" style={{ lineHeight: '1.15' }}>
            {t.home.escenaTitulo}
          </h2>
        </div>

        {/* Photomontage grid (4 images, editorial flow, high negative space feel) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {culturalImages.map((img, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 15 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="relative aspect-square rounded-[1.5rem] overflow-hidden border border-white/5 bg-white/[0.01] group"
            >
              <img
                src={img.url}
                alt={img.caption}
                className="w-full h-full object-cover transition duration-500"
                referrerPolicy="no-referrer"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />
              <span className="absolute bottom-4 left-4 text-[10px] font-sans font-bold uppercase tracking-[0.2em] text-white/50 group-hover:text-primary transition-colors">
                {img.caption}
              </span>
            </motion.div>
          ))}
        </div>
      </section>

      {/* 6. FRANJA PRODUCTORES (Discreto, al final, único guiño B2B) */}
      <section className="border-t border-white/5 bg-[#0b0b0d] py-16 px-6">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-start md:items-center gap-8">
          <div>
            <span className="block text-[10px] font-sans font-bold tracking-widest text-primary uppercase">
              {t.home.organizasKicker}
            </span>
            <p className="text-xl md:text-2xl font-heading font-black text-white uppercase tracking-tight mt-4">
              {t.home.organizasTexto}
            </p>
          </div>
          <Link to="/productores">
            <Button className="h-12 px-6 rounded-xl bg-white/[0.03] border border-white/10 hover:border-white/20 text-white hover:bg-white/[0.06] transition-all font-heading font-black uppercase text-xs tracking-wide">
              {t.home.organizasCta} &rarr;
            </Button>
          </Link>
        </div>
      </section>

      {/* 7. FINAL CTA — minimal, black, huge space, focus */}
      <section className="bg-black py-40 border-t border-white/5 text-center px-6">
        <div className="max-w-4xl mx-auto space-y-12">
          <h2 className="text-7xl sm:text-8xl md:text-[10rem] font-heading font-black tracking-tighter leading-none uppercase text-white select-none">
            ENTR<span className="orange-text-gradient">Á.</span>
          </h2>
          <div>
            <Link to="/eventos">
              <Button className="h-16 px-12 orange-gradient border-none text-white text-lg rounded-xl transition-all hover:brightness-110 font-heading font-black uppercase tracking-wide">
                {t.home.verEventos}
              </Button>
            </Link>
          </div>
        </div>
      </section>

    </div>
  );
}
