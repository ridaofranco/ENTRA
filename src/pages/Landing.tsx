import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Button } from '@/src/components/ui/button';
import { Card } from '@/src/components/ui/card';
import { Badge } from '@/src/components/ui/badge';
import {
  ArrowRight, Shield, Zap, BarChart3, QrCode, Calendar,
  MapPin, ChevronRight, Music, Star, TrendingUp, Ticket,
  MessageCircle, Check, Clock, Palette, Ban
} from 'lucide-react';
import { collection, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '@/src/lib/firebase';
import { seedEventsIfMissing } from '@/src/services/eventService';

interface Event {
  id: string;
  title: string;
  date: any;
  venue: string;
  location: string;
  price: number;
  image: string;
  category: string;
}

interface PricingPlan {
  rate: number;
  features: string[];
}

export default function Landing() {
  const [featuredEvents, setFeaturedEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeSlide, setActiveSlide] = useState(0);
  const [whatsapp, setWhatsapp] = useState('5491112345678');
  const [starter, setStarter] = useState<PricingPlan>({ rate: 3.5, features: ['Hasta 500 tickets', 'Dashboard básico', 'QR de acceso', 'Soporte por email', 'Cobro en 48hs'] });
  const [pro, setPro] = useState<PricingPlan>({ rate: 2.5, features: ['Tickets ilimitados', 'Dashboard avanzado', 'QR + control de acceso', 'Soporte prioritario', 'Cobro en 24hs', 'Cortesías y promos', 'Reportes exportables'] });
  const [enterprise, setEnterprise] = useState<PricingPlan>({ rate: 1.9, features: ['Todo lo de Pro', 'Comisión personalizada', 'White-label completo', 'API de integración', 'Account manager dedicado', 'Cobro en el día', 'Anti-reventa avanzado'] });

  useEffect(() => {
    const init = async () => {
      // Load platform config (pricing, whatsapp) from Firestore
      try {
        const configSnap = await getDoc(doc(db, 'platform_config', 'landing'));
        if (configSnap.exists()) {
          const cfg = configSnap.data();
          if (cfg.whatsappNumber) setWhatsapp(cfg.whatsappNumber);
          if (cfg.starterRate != null) setStarter({ rate: cfg.starterRate, features: cfg.starterFeatures || starter.features });
          if (cfg.proRate != null) setPro({ rate: cfg.proRate, features: cfg.proFeatures || pro.features });
          if (cfg.enterpriseRate != null) setEnterprise({ rate: cfg.enterpriseRate, features: cfg.enterpriseFeatures || enterprise.features });
        }
      } catch (e) {
        console.log('No platform config found, using defaults');
      }

      // Seed demo events if collection is empty (only runs once)
      await seedEventsIfMissing();

      // Fetch ALL events (no where/orderBy — tolerates legacy events without status
      // and avoids requiring a composite index)
      try {
        console.log('[Landing] Fetching events from Firestore...');
        const snapshot = await getDocs(collection(db, 'events'));
        console.log(`[Landing] Fetched ${snapshot.docs.length} raw event docs`);

        const all = snapshot.docs
          .map(d => ({ id: d.id, ...d.data() }) as Event & { status?: string })
          // Only show active (or events without a status field, treated as active)
          .filter(e => !e.status || e.status === 'active')
          // Sort by date ascending
          .sort((a, b) => {
            const da = a.date?.toDate?.()?.getTime?.() || 0;
            const db2 = b.date?.toDate?.()?.getTime?.() || 0;
            return da - db2;
          })
          .slice(0, 4);

        setFeaturedEvents(all);
      } catch (error) {
        console.error('[Landing] Error fetching events:', error);
      } finally {
        setLoading(false);
      }
    };

    init();
  }, []);

  // Auto-rotate featured events every 4 seconds
  useEffect(() => {
    if (featuredEvents.length <= 1) return;
    const timer = setInterval(() => {
      setActiveSlide(prev => (prev + 1) % featuredEvents.length);
    }, 4000);
    return () => clearInterval(timer);
  }, [featuredEvents.length]);

  const formatDate = (date: any) => {
    if (date?.toDate) {
      return date.toDate().toLocaleDateString('es-AR', {
        weekday: 'short', day: 'numeric', month: 'short'
      });
    }
    return '';
  };

  return (
    <div className="pb-20">
      {/* Hero Section */}
      <section className="relative min-h-[90vh] flex items-center overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-background to-background" />
        <div className="relative max-w-7xl mx-auto px-6 grid grid-cols-1 lg:grid-cols-2 gap-16 items-center pt-32 pb-20">
          {/* Left: Text */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="space-y-8"
          >
            <Badge className="orange-gradient border-none font-bold uppercase tracking-widest text-xs px-4 py-1.5">
              Nuevo en Argentina
            </Badge>

            <h1 className="text-5xl md:text-7xl font-heading font-black tracking-tighter leading-[0.9]">
              La ticketera que{' '}
              <span className="orange-text-gradient">Argentina merecía.</span>
            </h1>

            <p className="text-lg text-muted-foreground max-w-lg leading-relaxed">
              Comisiones más bajas del mercado, control de accesos integrado y una experiencia de compra
              que tus asistentes van a amar. Hecho en Argentina, pensado para dominar Latinoamérica.
            </p>

            <div className="flex flex-wrap gap-4">
              <a
                href={`https://wa.me/${whatsapp}?text=Hola!%20Quiero%20vender%20mis%20eventos%20con%20ENTRÁ`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Button className="h-14 px-8 orange-gradient border-none font-bold text-lg rounded-2xl shadow-xl shadow-primary/20">
                  <MessageCircle className="mr-2 w-5 h-5" />
                  Quiero vender entradas
                </Button>
              </a>
              <Link to="/eventos">
                <Button variant="outline" className="h-14 px-8 rounded-2xl border-white/10 font-bold text-lg">
                  Ver eventos
                </Button>
              </Link>
            </div>
          </motion.div>

          {/* Right: Rotating Featured Events Carousel */}
          <motion.div
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="relative"
          >
            {featuredEvents.length > 0 ? (
              <div className="relative">
                {/* Carousel with AnimatePresence */}
                <div className="relative h-[420px]">
                  {featuredEvents.map((evt, idx) => (
                    <motion.div
                      key={evt.id}
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{
                        opacity: activeSlide === idx ? 1 : 0,
                        scale: activeSlide === idx ? 1 : 0.95,
                        zIndex: activeSlide === idx ? 10 : 0,
                      }}
                      transition={{ duration: 0.5 }}
                      className="absolute inset-0"
                      style={{ pointerEvents: activeSlide === idx ? 'auto' : 'none' }}
                    >
                      <Card className="glass rounded-3xl border-white/10 overflow-hidden shadow-2xl h-full flex flex-col">
                        <div className="flex items-center gap-2 px-4 py-2 bg-white/5">
                          <div className="w-3 h-3 rounded-full bg-red-500" />
                          <div className="w-3 h-3 rounded-full bg-yellow-500" />
                          <div className="w-3 h-3 rounded-full bg-green-500" />
                          <span className="ml-auto text-[10px] text-muted-foreground font-bold uppercase tracking-widest">
                            {idx + 1} / {featuredEvents.length}
                          </span>
                        </div>
                        <div className="relative h-48 overflow-hidden flex-shrink-0">
                          <img
                            src={evt.image || null}
                            alt={evt.title}
                            className="w-full h-full object-cover"
                            referrerPolicy="no-referrer"
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-background to-transparent" />
                          <Badge className="absolute top-3 left-3 orange-gradient border-none font-bold uppercase text-[10px] tracking-widest">
                            {evt.category}
                          </Badge>
                        </div>
                        <div className="p-6 space-y-4 flex-grow">
                          <div>
                            <h3 className="text-xl font-heading font-bold">{evt.title}</h3>
                            <p className="text-sm text-muted-foreground mt-1">
                              {formatDate(evt.date)} · {evt.venue}
                            </p>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-2xl font-heading font-black text-primary">
                              ${(Number(evt.price) || 0).toLocaleString('es-AR')}
                            </span>
                            <Link to={`/evento/${evt.id}`}>
                              <Button className="orange-gradient border-none font-bold rounded-xl px-6">
                                Comprar <ChevronRight className="ml-1 w-4 h-4" />
                              </Button>
                            </Link>
                          </div>
                        </div>
                      </Card>
                    </motion.div>
                  ))}
                </div>

                {/* Dot indicators */}
                {featuredEvents.length > 1 && (
                  <div className="flex justify-center gap-2 mt-4">
                    {featuredEvents.map((_, idx) => (
                      <button
                        key={idx}
                        onClick={() => setActiveSlide(idx)}
                        className={`w-2.5 h-2.5 rounded-full transition-all duration-300 ${
                          activeSlide === idx
                            ? 'bg-primary w-8'
                            : 'bg-white/20 hover:bg-white/40'
                        }`}
                      />
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="glass rounded-3xl border-white/10 p-12 text-center">
                <Music className="w-12 h-12 text-primary mx-auto mb-4" />
                <p className="text-muted-foreground">Cargando eventos...</p>
              </div>
            )}

            {/* Anti-fraud badge */}
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.5 }}
              className="absolute -right-2 top-4 bg-background border border-white/10 rounded-2xl p-3 shadow-xl z-20"
            >
              <div className="flex items-center gap-2">
                <Shield className="w-5 h-5 text-red-500" />
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest">Antifraude</p>
                  <p className="text-xs font-bold text-green-500">Activo</p>
                </div>
              </div>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* Upcoming Events */}
      {featuredEvents.length > 1 && (
        <section className="max-w-7xl mx-auto px-6 py-20">
          <div className="flex items-center justify-between mb-10">
            <h2 className="text-3xl font-heading font-black tracking-tighter">
              Próximos <span className="orange-text-gradient">Eventos</span>
            </h2>
            <Link to="/eventos">
              <Button variant="ghost" className="font-bold text-primary">
                Ver todos <ArrowRight className="ml-2 w-4 h-4" />
              </Button>
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {featuredEvents.slice(0, 3).map((event, i) => (
              <motion.div
                key={event.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
              >
                <Link to={`/evento/${event.id}`}>
                  <Card className="glass rounded-3xl border-white/10 overflow-hidden hover:border-primary/30 transition-all group cursor-pointer">
                    <div className="relative h-48 overflow-hidden">
                      <img
                        src={event.image || null}
                        alt={event.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        referrerPolicy="no-referrer"
                      />
                      <Badge className="absolute top-3 left-3 orange-gradient border-none font-bold uppercase text-[10px] tracking-widest">
                        {event.category}
                      </Badge>
                    </div>
                    <div className="p-5 space-y-3">
                      <div className="flex items-center gap-2 text-xs text-primary font-bold uppercase tracking-widest">
                        <Calendar className="w-3.5 h-3.5" />
                        {formatDate(event.date)}
                      </div>
                      <h3 className="text-lg font-heading font-bold group-hover:text-primary transition-colors">
                        {event.title}
                      </h3>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <MapPin className="w-3.5 h-3.5" />
                        {event.venue}, {event.location}
                      </div>
                      <div className="flex items-center justify-between pt-2 border-t border-white/5">
                        <span className="text-xs text-muted-foreground uppercase tracking-widest font-bold">Desde</span>
                        <span className="text-lg font-heading font-black text-primary">
                          ${(Number(event.price) || 0).toLocaleString('es-AR')}
                        </span>
                      </div>
                    </div>
                  </Card>
                </Link>
              </motion.div>
            ))}
          </div>
        </section>
      )}

      {/* Features */}
      <section className="max-w-7xl mx-auto px-6 py-20">
        <div className="text-center mb-16 space-y-4">
          <h2 className="text-4xl font-heading font-black tracking-tighter">
            ¿Por qué <span className="orange-text-gradient">ENTRÁ</span>?
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Somos la plataforma que los organizadores argentinos estaban esperando.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[
            { icon: Zap, title: 'Desde 1.9% de comisión', desc: 'Las comisiones más bajas del mercado argentino. Sin costos ocultos ni sorpresas.' },
            { icon: Clock, title: 'Checkout en 30 segundos', desc: 'Experiencia de compra ultra rápida. Tus asistentes compran en segundos.' },
            { icon: QrCode, title: 'Control de acceso con QR', desc: 'Cada entrada tiene un código QR único validado en tiempo real contra fraude.' },
            { icon: BarChart3, title: 'Analytics en tiempo real', desc: 'Dashboard completo con ventas, ingresos y métricas al instante.' },
            { icon: Palette, title: 'White-label disponible', desc: 'Tu marca, tu evento. Personalizá la experiencia para tus asistentes.' },
            { icon: Ban, title: 'Anti-reventa', desc: 'Tecnología para evitar la reventa. Cada ticket vinculado a su comprador.' },
          ].map((feature, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
            >
              <Card className="glass p-6 rounded-3xl border-white/10 hover:border-primary/20 transition-all h-full space-y-4">
                <div className="w-12 h-12 rounded-2xl orange-gradient flex items-center justify-center">
                  <feature.icon className="w-6 h-6 text-white" />
                </div>
                <h3 className="font-heading font-bold text-lg">{feature.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{feature.desc}</p>
              </Card>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Pricing */}
      <section className="max-w-7xl mx-auto px-6 py-20">
        <div className="text-center mb-16 space-y-4">
          <h2 className="text-4xl font-heading font-black tracking-tighter">
            Planes y <span className="orange-text-gradient">Precios</span>
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Elegí el plan que mejor se adapte a tu evento. Sin costos de setup.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Starter */}
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
            <Card className="glass rounded-3xl border-white/10 p-8 h-full flex flex-col">
              <div className="mb-6">
                <h3 className="font-heading font-bold text-xl mb-1">Starter</h3>
                <p className="text-sm text-muted-foreground">Para eventos pequeños y medianos</p>
              </div>
              <div className="mb-6">
                <span className="text-5xl font-heading font-black text-primary">{starter.rate}%</span>
                <span className="text-muted-foreground ml-2">por ticket</span>
              </div>
              <ul className="space-y-3 mb-8 flex-grow">
                {starter.features.map((item, i) => (
                  <li key={i} className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Check className="w-4 h-4 text-green-500 flex-shrink-0" /> {item}
                  </li>
                ))}
              </ul>
              <a
                href={`https://wa.me/${whatsapp}?text=Hola!%20Quiero%20el%20plan%20Starter%20de%20ENTRÁ`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Button variant="outline" className="w-full h-12 rounded-2xl border-white/10 font-bold">
                  <MessageCircle className="mr-2 w-4 h-4" /> Empezar gratis
                </Button>
              </a>
            </Card>
          </motion.div>

          {/* Pro */}
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.1 }}>
            <Card className="glass rounded-3xl border-primary/30 p-8 h-full flex flex-col relative overflow-hidden">
              <Badge className="absolute top-4 right-4 orange-gradient border-none font-bold uppercase text-[10px] tracking-widest">
                Más Popular
              </Badge>
              <div className="mb-6">
                <h3 className="font-heading font-bold text-xl mb-1">Pro</h3>
                <p className="text-sm text-muted-foreground">Para organizadores profesionales</p>
              </div>
              <div className="mb-6">
                <span className="text-5xl font-heading font-black text-primary">{pro.rate}%</span>
                <span className="text-muted-foreground ml-2">por ticket</span>
              </div>
              <ul className="space-y-3 mb-8 flex-grow">
                {pro.features.map((item, i) => (
                  <li key={i} className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Check className="w-4 h-4 text-green-500 flex-shrink-0" /> {item}
                  </li>
                ))}
              </ul>
              <a
                href={`https://wa.me/${whatsapp}?text=Hola!%20Quiero%20el%20plan%20Pro%20de%20ENTRÁ`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Button className="w-full h-12 rounded-2xl orange-gradient border-none font-bold shadow-lg shadow-primary/20">
                  <MessageCircle className="mr-2 w-4 h-4" /> Elegir Pro
                </Button>
              </a>
            </Card>
          </motion.div>

          {/* Enterprise */}
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.2 }}>
            <Card className="glass rounded-3xl border-white/10 p-8 h-full flex flex-col">
              <div className="mb-6">
                <h3 className="font-heading font-bold text-xl mb-1">Enterprise</h3>
                <p className="text-sm text-muted-foreground">Para grandes productoras y festivales</p>
              </div>
              <div className="mb-6">
                <span className="text-5xl font-heading font-black text-primary">{enterprise.rate}%</span>
                <span className="text-muted-foreground ml-2">por ticket</span>
              </div>
              <ul className="space-y-3 mb-8 flex-grow">
                {enterprise.features.map((item, i) => (
                  <li key={i} className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Check className="w-4 h-4 text-green-500 flex-shrink-0" /> {item}
                  </li>
                ))}
              </ul>
              <a
                href={`https://wa.me/${whatsapp}?text=Hola!%20Quiero%20información%20sobre%20el%20plan%20Enterprise%20de%20ENTRÁ`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Button variant="outline" className="w-full h-12 rounded-2xl border-white/10 font-bold">
                  <MessageCircle className="mr-2 w-4 h-4" /> Contactar ventas
                </Button>
              </a>
            </Card>
          </motion.div>
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-4xl mx-auto px-6 py-20">
        <Card className="glass rounded-[3rem] border-white/10 p-12 text-center space-y-8 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-transparent" />
          <div className="relative space-y-6">
            <h2 className="text-4xl font-heading font-black tracking-tighter">
              Empezá a vender <span className="orange-text-gradient">hoy</span>
            </h2>
            <p className="text-lg text-muted-foreground max-w-xl mx-auto">
              Contactanos y te creamos tu cuenta de organizador. Sin costos de setup, comisión más baja del mercado.
            </p>
            <div className="flex flex-wrap justify-center gap-4">
              <a
                href={`https://wa.me/${whatsapp}?text=Hola!%20Quiero%20vender%20mis%20eventos%20con%20ENTRÁ`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Button className="h-16 px-12 orange-gradient border-none font-black text-xl rounded-2xl shadow-xl shadow-primary/20">
                  <MessageCircle className="mr-3 w-6 h-6" />
                  Contactanos por WhatsApp
                </Button>
              </a>
              <Link to="/contacto">
                <Button variant="outline" className="h-16 px-10 rounded-2xl border-white/10 font-bold text-lg">
                  Más info
                  <ArrowRight className="ml-2 w-5 h-5" />
                </Button>
              </Link>
            </div>
          </div>
        </Card>
      </section>
    </div>
  );
}
