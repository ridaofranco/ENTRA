import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Button } from '@/src/components/ui/button';
import { Card } from '@/src/components/ui/card';
import { Badge } from '@/src/components/ui/badge';
import {
  Calendar, MapPin, Search, Music, Ticket,
  AlertTriangle, Clock, Trash2, Shield
} from 'lucide-react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '@/src/lib/firebase';
import { getCategoryLabel } from '@/src/lib/categories';
import PosterFallback from '@/src/components/PosterFallback';
import { eventPath } from '@/src/lib/slug';
import { useAuth } from '@/src/context/AuthContext';
import { formatCurrency, isEventFinished } from '@/src/lib/utils';
import { useLang, textos, dateLocale } from '@/src/lib/i18n';

interface TicketType {
  type: string;
  price: number;
  available: number;
}

interface Event {
  id: string;
  title: string;
  description: string;
  date: any;
  location: string;
  venue: string;
  price: number;
  image: string;
  category: string;
  status?: string;
  tickets?: TicketType[];
  scheduledPublishAt?: any;
  isDateTBD?: boolean;
  isVenueTBD?: boolean;
}

export default function Comprar() {
  const { user, profile } = useAuth();
  const lang = useLang();
  const t = textos(lang);
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('Todos');
  const [timeFilter, setTimeFilter] = useState<'upcoming' | 'past' | 'all'>('upcoming');
  const [showHiddenAdmin, setShowHiddenAdmin] = useState(false);

  const whatsappUrl = 'https://wa.me/5491171540675?text=Hola!%20Quiero%20vender%20mis%20eventos%20con%20ENTRÁ';

  const isAdmin =
    profile?.role === 'admin' ||
    profile?.role === 'superadmin' ||
    user?.email === 'ridaofrancorg@gmail.com';

  useEffect(() => {
    const fetchEvents = async () => {
      setLoading(true);
      setFetchError(null);
      try {
        console.log('[Comprar] Fetching events from Firestore...');
        const snapshot = await getDocs(collection(db, 'events'));
        console.log(`[Comprar] Fetched ${snapshot.docs.length} raw event docs`);

        const data = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
        })) as Event[];

        data.sort((a, b) => {
          const da = a.date?.toDate?.()?.getTime?.() || 0;
          const db2 = b.date?.toDate?.()?.getTime?.() || 0;
          return da - db2;
        });

        setEvents(data);
      } catch (error: any) {
        console.error('[Comprar] Error fetching events:', error);
        const tc = textos().cartelera;
        setFetchError(
          error?.code === 'permission-denied'
            ? tc.errorPermisos
            : tc.errorCargarDetalle(error?.message || tc.errorDesconocido)
        );
      } finally {
        setLoading(false);
      }
    };

    fetchEvents();
  }, []);

  const formatDate = (date: any) => {
    if (date?.toDate) {
      return date.toDate().toLocaleDateString(dateLocale(lang), {
        weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
      });
    }
    return '';
  };

  const formatScheduled = (date: any) => {
    if (date?.toDate) {
      return date.toDate().toLocaleString(dateLocale(lang), {
        day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
      });
    }
    return '';
  };

  const isSoldOut = (event: Event): boolean => {
    if (!event.tickets || event.tickets.length === 0) return false;
    return event.tickets.every(t => (t.available || 0) <= 0);
  };

  const visibleEvents = events.filter(event => {
    const status = event.status || 'active';
    if (isAdmin && showHiddenAdmin) return true;
    if ((event as any).hidden) return false; // ocultos: solo por link directo
    // Un evento finalizado sale de la cartelera publica por completo, tambien
    // de la solapa "Pasados". El detalle por URL directa sigue visible con su
    // badge FINALIZADO. El admin los ve con el toggle "Ver todos".
    if (isEventFinished(event)) return false;
    return status === 'active' || status === 'paused';
  });

  const categories = ['Todos', ...Array.from(new Set(visibleEvents.map(e => e.category).filter(Boolean)))];

  const filteredEvents = visibleEvents.filter(event => {
    const matchesSearch =
      event.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      event.venue?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      event.location?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'Todos' || event.category === selectedCategory;

    // La regla del fin del evento (endDate explicito o inicio + 3hs) decide en
    // que solapa cae: un evento finalizado ya no aparece entre lo que esta a la
    // venta ("Proximos", la vista por defecto) y pasa a "Pasados".
    const finished = isEventFinished(event);
    const matchesTime = timeFilter === 'all' ||
                       (timeFilter === 'upcoming' && !finished) ||
                       (timeFilter === 'past' && finished);

    return matchesSearch && matchesCategory && matchesTime;
  });

  const countsByStatus = events.reduce(
    (acc, e) => {
      const s = e.status || 'active';
      acc[s] = (acc[s] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );  return (
    <div className="pb-20 pt-32 bg-[#09090b] text-foreground min-h-screen">
      {/* Hero Section */}
      <section className="relative overflow-hidden mb-12 px-6">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/10 via-transparent to-transparent opacity-60 pointer-events-none" />
        <div className="relative max-w-7xl mx-auto py-12 text-center space-y-6">
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-4"
          >
            <span className="text-[10px] font-bold tracking-[0.3em] uppercase text-primary">
              {t.cartelera.kicker}
            </span>
            <h1 className="text-5xl sm:text-6xl md:text-7xl lg:text-[6rem] font-heading font-black tracking-tighter leading-none uppercase">
              {t.cartelera.tituloA}<span className="orange-text-gradient">{t.cartelera.tituloB}</span>
            </h1>
            <p className="text-lg text-muted-foreground/80 max-w-2xl mx-auto leading-relaxed font-sans mt-4">
              {t.cartelera.bajada}
            </p>
          </motion.div>
        </div>
      </section>

      {/* Por qué comprar en ENTRÁ - Sleek minimal row of benefits */}
      <section className="max-w-7xl mx-auto px-6 mb-16">
        <div className="border border-white/5 bg-white/[0.01] rounded-[2rem] p-8 md:p-10">
          <p className="text-[10px] font-bold text-primary uppercase tracking-[0.2em] mb-6 text-center md:text-left">
            {t.cartelera.porQueTitulo}
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {t.cartelera.beneficios.map((item, i) => (
              <div key={i} className="space-y-2">
                <h4 className="font-heading font-bold text-lg text-white uppercase tracking-tight">{item.titulo}</h4>
                <p className="text-sm text-muted-foreground leading-relaxed font-sans">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Admin toolbar */}
      {isAdmin && (
        <section className="max-w-7xl mx-auto px-6 mb-8">
          <Card className="glass rounded-2xl border-primary/30 p-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <Shield className="w-5 h-5 text-primary" />
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest text-primary">
                    Vista de administrador
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Total: {events.length} · Activos: {countsByStatus.active || 0}
                    {countsByStatus.paused ? ` · Pausados: ${countsByStatus.paused}` : ''}
                    {countsByStatus.scheduled ? ` · Programados: ${countsByStatus.scheduled}` : ''}
                    {countsByStatus.deleted ? ` · Eliminados: ${countsByStatus.deleted}` : ''}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant={showHiddenAdmin ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setShowHiddenAdmin(!showHiddenAdmin)}
                  className={showHiddenAdmin ? 'orange-gradient border-none font-bold text-xs uppercase tracking-wider' : 'border-white/10 font-bold text-xs'}
                >
                  {showHiddenAdmin ? 'Ocultar eliminados/programados' : 'Ver todos (incluye eliminados)'}
                </Button>
                <Link to="/admin/dashboard">
                  <Button size="sm" variant="outline" className="border-white/10 font-bold text-xs">
                    Dashboard Admin
                  </Button>
                </Link>
              </div>
            </div>
          </Card>
        </section>
      )}

      {/* Filters & Search */}
      <section className="max-w-7xl mx-auto px-6 mb-16">
        <div className="flex flex-col lg:flex-row gap-6 items-end justify-between">
          <div className="w-full lg:max-w-2xl space-y-4">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <input
                type="text"
                placeholder={t.cartelera.buscarPlaceholder}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full h-14 pl-12 pr-4 bg-white/[0.02] border border-white/10 rounded-[1.25rem] text-sm font-medium placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 transition-colors"
              />
            </div>
            
            <div className="flex gap-2 flex-wrap">
              {categories.map(cat => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all ${
                    selectedCategory === cat
                      ? 'orange-gradient text-white'
                      : 'bg-white/5 border border-white/10 text-muted-foreground hover:border-primary/30 hover:text-white'
                  }`}
                >
                  {cat === 'Todos' ? t.cartelera.categoriaTodos : cat}
                </button>
              ))}
            </div>
          </div>

          <div className="w-full lg:w-72 flex-shrink-0">
            <div className="bg-white/5 border border-white/10 rounded-2xl p-1 flex">
              {(['upcoming', 'past', 'all'] as const).map(tf => (
                <button
                  key={tf}
                  onClick={() => setTimeFilter(tf)}
                  className={`flex-1 py-3 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all ${
                    timeFilter === tf
                      ? 'orange-gradient text-white'
                      : 'text-muted-foreground hover:text-white'
                  }`}
                >
                  {tf === 'upcoming' ? t.cartelera.tabProximos : tf === 'past' ? t.cartelera.tabPasados : t.cartelera.tabTodos}
                </button>
              ))}
            </div>
            <p className="text-[10px] text-center text-muted-foreground mt-2 uppercase tracking-widest font-bold">
              {t.cartelera.filtrarPorFecha}
            </p>
          </div>
        </div>
      </section>

      {/* Error banner */}
      {fetchError && (
        <section className="max-w-7xl mx-auto px-6 mb-8">
          <Card className="glass rounded-2xl border-red-500/30 p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-bold text-red-500">{t.cartelera.errorCargarTitulo}</p>
                <p className="text-xs text-muted-foreground mt-1">{fetchError}</p>
              </div>
            </div>
          </Card>
        </section>
      )}

      {/* Events Grid */}
      <section className="max-w-7xl mx-auto px-6">
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <div key={i} className="aspect-[4/5] bg-white/[0.02] border border-white/5 rounded-[2.5rem] animate-pulse" />
            ))}
          </div>
        ) : filteredEvents.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-20"
          >
            <Music className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />
            <h3 className="text-xl font-heading font-black uppercase tracking-tight">{t.cartelera.vacioTitulo}</h3>
            <p className="text-muted-foreground text-sm max-w-sm mx-auto leading-relaxed mt-2 font-sans">
              {t.cartelera.vacioBajada}
            </p>
          </motion.div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {filteredEvents.map((event, i) => {
              const soldOut = isSoldOut(event);
              // Stock real disponible (suma de todos los tipos de entrada) — para el
              // badge de "últimas entradas", que antes se ponía falsamente al 2º evento.
              const totalAvailable = Array.isArray(event.tickets)
                ? event.tickets.reduce((s: number, t: any) => s + (Number(t.available) || 0), 0)
                : 0;
              const status = event.status || 'active';
              const isDeleted = status === 'deleted';
              const isScheduled = status === 'scheduled';
              const isPaused = status === 'paused';
              const isPending = status === 'pending';
              // La fecha manda: un evento que ya paso nunca puede mostrarse ABIERTO.
              const isFinished = isEventFinished(event);

              let badgeText = t.cartelera.badgeAbierto;
              let badgeClasses = "border-primary/20 text-primary";

              if (isDeleted) {
                badgeText = t.cartelera.badgeEliminado;
                badgeClasses = "border-red-500/20 text-red-400 bg-red-950/20";
              } else if (isFinished) {
                badgeText = t.cartelera.badgeFinalizado;
                badgeClasses = "border-white/10 text-zinc-400 bg-white/5";
              } else if (soldOut) {
                badgeText = t.cartelera.badgeAgotado;
                badgeClasses = "border-white/10 text-muted-foreground bg-white/5";
              } else if (isPending) {
                badgeText = t.cartelera.badgePendiente;
                badgeClasses = "border-orange-500/20 text-orange-400 bg-orange-950/20";
              } else if (isScheduled) {
                badgeText = t.cartelera.badgeProgramado;
                badgeClasses = "border-blue-500/20 text-blue-400 bg-blue-950/20";
              } else if (isPaused) {
                badgeText = t.cartelera.badgePausado;
                badgeClasses = "border-yellow-500/20 text-yellow-500 bg-yellow-950/20";
              } else if (totalAvailable > 0 && totalAvailable <= 15) {
                badgeText = t.cartelera.badgeUltimas;
                badgeClasses = "border-orange-500/30 text-orange-400 bg-orange-950/20";
              }

              return (
                <motion.div
                  key={event.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(i * 0.04, 0.3) }}
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
                        
                        {/* Status badge in poster */}
                        <div className="absolute top-6 left-6">
                          <span className={`text-[10px] font-sans font-bold tracking-widest px-3.5 py-1.5 rounded-full border backdrop-blur-md uppercase ${badgeClasses}`}>
                            {badgeText}
                          </span>
                        </div>

                        {/* Category badge (solo texto, en línea con la estética editorial) */}
                        {event.category && (
                          <div className="absolute top-6 right-6">
                            <span className="text-[10px] font-sans font-bold tracking-widest px-3.5 py-1.5 rounded-full border border-white/15 bg-black/40 backdrop-blur-md uppercase text-white/80">
                              {getCategoryLabel(event.category)}
                            </span>
                          </div>
                        )}

                        {/* Location details inside visual overlay */}
                        <div className="absolute bottom-6 left-6 right-6 space-y-1 text-white">
                          <p className="text-[10px] font-bold text-primary uppercase tracking-[0.2em] font-sans">
                            {event.isDateTBD ? t.comun.proximamente : formatDate(event.date)}
                          </p>
                          <h3 className="text-xl md:text-2xl font-heading font-black tracking-tight uppercase leading-none">
                            {event.title}
                          </h3>
                        </div>
                      </div>

                      {/* Poster labeling below */}
                      <div className="px-2 flex justify-between items-center text-sm">
                        <span className="text-muted-foreground font-sans tracking-wide">
                          {event.isVenueTBD ? t.comun.lugarPorConfirmar : event.venue}
                        </span>
                        <span className="font-heading font-black text-primary text-base">
                          {isDeleted ? t.cartelera.badgeEliminado : isFinished ? t.cartelera.badgeFinalizado : isPending ? t.cartelera.badgePendiente : isScheduled ? t.cartelera.badgeProgramado : isPaused ? t.cartelera.badgePausadoCorto : soldOut ? t.cartelera.badgeAgotado : `$${(event.price || 0).toLocaleString('es-AR')}`}
                        </span>
                      </div>
                    </div>
                  </Link>
                </motion.div>
              );
            })}
          </div>
        )}
      </section>

      {/* CTA Final para Organizadores */}
      <section className="max-w-4xl mx-auto px-6 py-16 text-center mt-12">
        <Card className="glass rounded-[3rem] border-white/10 p-12 space-y-6 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-transparent pointer-events-none" />
          <div className="relative space-y-4">
            <h3 className="text-2xl md:text-4xl font-heading font-black tracking-tight">{t.cartelera.ctaOrganizasTitulo}</h3>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              {t.cartelera.ctaOrganizasBajada}
            </p>
            <div>
              <a href={whatsappUrl} target="_blank" rel="noopener noreferrer">
                <Button className="h-12 px-8 orange-gradient border-none font-heading font-black rounded-xl hover:brightness-110">
                  {t.cartelera.ctaOrganizasBoton}
                </Button>
              </a>
            </div>
          </div>
        </Card>
      </section>
    </div>
  );
}
