import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowRight, Calendar, MapPin, Search, Music } from 'lucide-react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '@/src/lib/firebase';
import { useAuth } from '@/src/context/AuthContext';
import HeroAtmosphere from '@/src/components/HeroAtmosphere';
import PosterFallback from '@/src/components/PosterFallback';
import { eventPath } from '@/src/lib/slug';
import { cn, isEventFinished } from '@/src/lib/utils';
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
  const lang = useLang();
  const t = textos(lang);
  const loc = dateLocale(lang);
  const [featuredEvents, setFeaturedEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const init = async () => {
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
  return (
    <div className="bg-[#09090b] text-foreground min-h-screen">
      
      {/* 1. HERO — corto A PROPÓSITO.
          Ocupaba la pantalla ENTERA: el que entraba a comprar una entrada tenía
          que scrollear una pantalla completa de marca antes de ver un solo evento.
          En una ticketera el producto es el evento, no la portada. Ahora mide poco
          más de media pantalla, así la primera fila de la cartelera asoma sin
          scrollear y se entiende de una que acá hay algo para comprar. */}
      <section className="relative min-h-[60vh] md:min-h-[64vh] flex flex-col justify-center overflow-hidden px-6 py-20">
        {/* Atmósfera de marca: glows que respiran + brasas sutiles (detrás del texto) */}
        <HeroAtmosphere />

        <div className="max-w-7xl mx-auto w-full pt-20 relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="space-y-8"
          >
            <div className="space-y-4">
              <h1 className="text-[clamp(2rem,11vw,3rem)] sm:text-7xl md:text-8xl lg:text-[100px] font-heading font-black tracking-tighter leading-[0.9] sm:leading-[0.85] uppercase select-none break-words">
                {t.home.tituloA}<br />
                <span className="orange-text-gradient">{t.home.tituloB}</span><br />
                {t.home.tituloC}
              </h1>
            </div>

            {/* UN solo botón, y es el de ver eventos. El otro era "ENTRÁ" y llevaba
                al LOGIN: al que entra por primera vez se le pedía registrarse antes
                de mostrarle nada. La puerta de la cuenta ya está en el menú de
                arriba, que es donde la busca el que ya la tiene. */}
            <div className="flex flex-wrap gap-4 pt-4">
              <Link to="/eventos">
                <Button className="h-14 px-10 orange-gradient border-none text-white text-base rounded-xl transition-all hover:brightness-110 font-heading font-black uppercase tracking-wide">
                  {t.home.verEventos}
                </Button>
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      {/* 3. EVENTOS EN VIVO (Posters editoriales, sin cajas de e-commerce, limpio, aire) */}
      <section className="max-w-7xl mx-auto px-6 pt-4 pb-24 space-y-10">
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
          /* CON POCOS EVENTOS NO VA LA GRILLA DE TRES. Con un solo evento
             publicado se veía una tarjeta y dos huecos: parecía vacío lo que en
             realidad es "recién arrancamos". Hasta dos eventos, cada uno ocupa
             todo el ancho y la imagen va apaisada, que es como se mira un afiche.
             Del tercero en adelante vuelve la grilla, sola. */
          <div className={cn(
            "grid gap-8",
            featuredEvents.length === 1 ? "grid-cols-1 max-w-4xl"
              : featuredEvents.length === 2 ? "grid-cols-1 md:grid-cols-2"
              : "grid-cols-1 md:grid-cols-2 lg:grid-cols-3",
          )}>
            {featuredEvents.map((event, i) => {
              // Etiqueta de stock REAL según disponibilidad de las entradas
              // Un solo evento (o dos) se muestra grande: es la diferencia entre una
              // cartelera que arranca y una que parece vacía.
              const destacado = featuredEvents.length <= 2;
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
                      <div className={cn(
                        "relative rounded-[2rem] border border-white/10 overflow-hidden bg-black group-hover:border-primary/40 transition-colors duration-300",
                        // 4/3 en celular y 16/9 en pantalla grande: apaisado sin comerse el afiche.
                        // Un 21/9 sobre una imagen vertical recorta casi todo el arte.
                        destacado ? "aspect-[4/3] md:aspect-[16/9]" : "aspect-[4/5]",
                      )}>
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
                          <h3 className={cn(
                            "font-heading font-black tracking-tight uppercase leading-none",
                            destacado ? "text-3xl md:text-5xl" : "text-xl md:text-2xl",
                          )}>
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
          <div className="glass rounded-[2rem] border-white/5 p-16 text-center max-w-xl mx-auto space-y-4">
            <Music className="w-10 h-10 text-primary mx-auto opacity-40" />
            <h3 className="font-heading font-black text-xl uppercase">{t.home.vacioTitulo}</h3>
            <p className="text-sm text-muted-foreground leading-relaxed font-sans">
              {t.home.vacioTexto}
            </p>
          </div>
        )}
      </section>

      {/* La home NO tiene fotos de archivo. Habia una seccion "Nuestra escena" con
          4 imagenes de Unsplash de eventos ajenos: no eran nuestras, y puestas de
          adorno le daban a la home cara de plantilla generica. Las unicas fotos de
          esta pantalla son las de los eventos reales que estan a la venta. */}

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

      {/* Acá había un cierre a toda pantalla: la palabra ENTRÁ en 10rem y otro
          botón "Ver eventos", con 40 de padding arriba y abajo. Era el mismo botón
          que ya está en el hero, repetido al final de una home que no es larga, y
          entre medio quedaba un bloque negro enorme que no decía nada. La página
          ahora cierra con la franja de productores, que sí ofrece algo nuevo. */}

    </div>
  );
}
