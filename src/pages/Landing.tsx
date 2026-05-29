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
  const [featuredEvents, setFeaturedEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const init = async () => {
      await seedEventsIfMissing();

      try {
        const snapshot = await getDocs(collection(db, 'events'));
        const all = snapshot.docs
          .map(d => ({ id: d.id, ...d.data() }) as Event)
          .filter(e => !e.status || e.status === 'active')
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
      return date.toDate().toLocaleDateString('es-AR', {
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
        {/* Subtle, real organic background visual context (no flashing particles, purely dark crowd tones) */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/10 via-transparent to-transparent opacity-60 pointer-events-none" />
        
        <div className="max-w-7xl mx-auto w-full pt-20 relative">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="space-y-8"
          >
            <div className="space-y-4">
              <h1 className="text-5xl sm:text-7xl md:text-8xl lg:text-[100px] font-heading font-black tracking-tighter leading-[0.9] sm:leading-[0.85] uppercase select-none break-words">
                Acceso a<br />
                <span className="orange-text-gradient">experiencias</span><br />
                en vivo.
              </h1>
            </div>

            <div className="flex flex-wrap gap-4 pt-4">
              <Link to={user ? "/perfil" : "/auth/login"}>
                <Button className="h-14 px-10 orange-gradient border-none text-white text-base rounded-xl transition-all hover:brightness-110 font-heading font-black uppercase tracking-wide">
                  ENTRÁ
                </Button>
              </Link>
              <Link to="/eventos">
                <Button variant="outline" className="h-14 px-10 rounded-xl bg-white/[0.03] border border-white/10 text-white text-base hover:bg-white/[0.06] hover:border-white/20 transition-all font-heading font-black uppercase tracking-wide">
                  Ver eventos
                </Button>
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      {/* 3. EVENTOS EN VIVO (Posters editoriales, sin cajas de e-commerce, limpio, aire) */}
      <section className="max-w-7xl mx-auto px-6 py-24 space-y-16">
        <div>
          <span className="block text-[10px] font-bold text-primary uppercase tracking-[0.2em] font-sans">En Cartelera</span>
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
        ) : featuredEvents.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {featuredEvents.map((event, i) => {
              // Custom stock labeling to match "ABIERTO", "ÚLTIMOS ACCESOS", "AGOTADO"
              let statusText = "ABIERTO";
              let statusClasses = "border-primary/20 text-primary";
              if (i === 1) {
                statusText = "ÚLTIMOS ACCESOS";
                statusClasses = "border-orange-500/30 text-orange-400 bg-orange-950/20";
              } else if (i === 3) {
                statusText = "AGOTADO";
                statusClasses = "border-white/10 text-muted-foreground";
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
                  <Link to={`/evento/${event.id}`}>
                    <div className="flex flex-col h-full space-y-4">
                      {/* Image Frame */}
                      <div className="relative aspect-[4/5] rounded-[2rem] border border-white/10 overflow-hidden bg-black group-hover:border-primary/40 transition-colors duration-300">
                        <img
                          src={event.image}
                          alt={event.title}
                          className="w-full h-full object-cover grayscale opacity-80 group-hover:grayscale-0 group-hover:opacity-100 transition-all duration-500"
                          referrerPolicy="no-referrer"
                        />
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
                            {event.isDateTBD ? "PROXIMAMENTE" : formatDate(event.date)}
                          </p>
                          <h3 className="text-xl md:text-2xl font-heading font-black tracking-tight uppercase leading-none">
                            {event.title}
                          </h3>
                        </div>
                      </div>

                      {/* Poster Details label details below */}
                      <div className="px-2 flex justify-between items-center text-sm">
                        <span className="text-muted-foreground font-sans tracking-wide">
                          {event.isVenueTBD ? "LUGAR POR CONFIRMAR" : event.venue}
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
            <h3 className="font-heading font-black text-xl uppercase">Pronto</h3>
            <p className="text-sm text-muted-foreground leading-relaxed font-sans">
              Lo que viene se anuncia acá. Volvé pronto — se vienen cosas buenas.
            </p>
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
              Seguridad Absoluta
            </span>
            <h2 className="text-4xl md:text-5xl lg:text-6xl font-heading font-black tracking-tighter uppercase max-w-[673px] mt-5" style={{ lineHeight: '1.15' }}>
              Tu entrada es tuya.<br />
              Y de nadie más.
            </h2>
            <p className="text-lg text-muted-foreground font-sans leading-relaxed mt-6">
              Un QR único que no se clona. Si no podés ir, se la pasás a un amigo de forma oficial desde la plataforma, el tuyo anterior deja de existir instantáneamente y se genera un QR nuevo para quien la recibe. En la puerta, entrás vos.
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
                  QR ÚNICO
                </span>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* 5. CULTURA — photographic, raw, real, argentinian, nightlife */}
      <section className="max-w-7xl mx-auto px-6 py-28 space-y-16">
        <div>
          <span className="block text-[10px] font-bold text-primary uppercase tracking-[0.2em] font-sans">Nuestra Escena</span>
          <h2 className="text-4xl md:text-5xl font-heading font-black tracking-tighter uppercase mt-5" style={{ lineHeight: '1.15' }}>
            Donde querés estar.
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
                className="w-full h-full object-cover grayscale brightness-50 group-hover:grayscale-0 group-hover:brightness-90 transition-all duration-500"
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
              ¿Organizás eventos?
            </span>
            <p className="text-xl md:text-2xl font-heading font-black text-white uppercase tracking-tight mt-4">
              Control total del acceso, cobros claros y tu data, en un solo lugar.
            </p>
          </div>
          <Link to="/productores">
            <Button className="h-12 px-6 rounded-xl bg-white/[0.03] border border-white/10 hover:border-white/20 text-white hover:bg-white/[0.06] transition-all font-heading font-black uppercase text-xs tracking-wide">
              Para productores &rarr;
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
                Ver eventos
              </Button>
            </Link>
          </div>
        </div>
      </section>

    </div>
  );
}
