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
import { useAuth } from '@/src/context/AuthContext';

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
}

export default function Catalog() {
  const { user, profile } = useAuth();
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('Todos');
  const [timeFilter, setTimeFilter] = useState<'upcoming' | 'past' | 'all'>('upcoming');
  const [showHiddenAdmin, setShowHiddenAdmin] = useState(false);

  // Determine if current user is admin/superadmin
  const isAdmin =
    profile?.role === 'admin' ||
    profile?.role === 'superadmin' ||
    user?.email === 'ridaofrancorg@gmail.com';

  useEffect(() => {
    const fetchEvents = async () => {
      setLoading(true);
      setFetchError(null);
      try {
        // Fetch ALL events with NO where clause — avoids composite index requirements
        // and tolerates legacy events that don't have a `status` field
        console.log('[Catalog] Fetching all events from Firestore...');
        const snapshot = await getDocs(collection(db, 'events'));
        console.log(`[Catalog] Fetched ${snapshot.docs.length} raw event docs`);

        const data = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
        })) as Event[];

        // Sort by date ascending (client-side; avoids needing index)
        data.sort((a, b) => {
          const da = a.date?.toDate?.()?.getTime?.() || 0;
          const db2 = b.date?.toDate?.()?.getTime?.() || 0;
          return da - db2;
        });

        setEvents(data);
      } catch (error: any) {
        console.error('[Catalog] Error fetching events:', error);
        setFetchError(
          error?.code === 'permission-denied'
            ? 'Permiso denegado. Revisá las reglas de Firebase Firestore.'
            : `No se pudieron cargar los eventos: ${error?.message || 'error desconocido'}`
        );
      } finally {
        setLoading(false);
      }
    };

    fetchEvents();
  }, []);

  const formatDate = (date: any) => {
    if (date?.toDate) {
      return date.toDate().toLocaleDateString('es-AR', {
        weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
      });
    }
    return '';
  };

  const formatScheduled = (date: any) => {
    if (date?.toDate) {
      return date.toDate().toLocaleString('es-AR', {
        day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
      });
    }
    return '';
  };

  // Sold out: every ticket type has 0 available
  const isSoldOut = (event: Event): boolean => {
    if (!event.tickets || event.tickets.length === 0) return false;
    return event.tickets.every(t => (t.available || 0) <= 0);
  };

  // Visibility rules:
  // - Normal users: only active + paused (hide deleted + scheduled)
  // - Admin with toggle off: same as normal users
  // - Admin with toggle on: show EVERYTHING including deleted + scheduled
  const visibleEvents = events.filter(event => {
    const status = event.status || 'active'; // treat missing status as active (for legacy events)
    if (isAdmin && showHiddenAdmin) return true; // admin sees all
    return status !== 'deleted' && status !== 'scheduled';
  });

  // Unique categories from visible events
  const categories = ['Todos', ...Array.from(new Set(visibleEvents.map(e => e.category).filter(Boolean)))];

  // Apply search + category + time filters
  const filteredEvents = visibleEvents.filter(event => {
    const matchesSearch =
      event.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      event.venue?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      event.location?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'Todos' || event.category === selectedCategory;
    
    const eventDate = event.date?.toDate ? event.date.toDate() : event.date?.seconds ? new Date(event.date.seconds * 1000) : null;
    const now = new Date();
    const matchesTime = timeFilter === 'all' || 
                       (timeFilter === 'upcoming' && eventDate && eventDate >= now) ||
                       (timeFilter === 'past' && eventDate && eventDate < now);
                       
    return matchesSearch && matchesCategory && matchesTime;
  });

  // Count events by status for admin summary
  const countsByStatus = events.reduce(
    (acc, e) => {
      const s = e.status || 'active';
      acc[s] = (acc[s] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  return (
    <div className="pb-20 pt-28">
      {/* Header */}
      <section className="max-w-7xl mx-auto px-6 mb-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-4"
        >
          <h1 className="text-4xl md:text-6xl font-heading font-black tracking-tighter">
            Todos los <span className="orange-text-gradient">Eventos</span>
          </h1>
          <p className="text-lg text-muted-foreground max-w-lg">
            Descubrí los mejores eventos de Argentina. Comprá tus entradas de forma segura.
          </p>
        </motion.div>
      </section>

      {/* Admin toolbar */}
      {isAdmin && (
        <section className="max-w-7xl mx-auto px-6 mb-6">
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
                  className={showHiddenAdmin ? 'orange-gradient border-none font-bold' : 'border-white/10 font-bold'}
                >
                  {showHiddenAdmin ? 'Ocultar eliminados/programados' : 'Ver todos (incluye eliminados)'}
                </Button>
                <Link to="/admin/dashboard">
                  <Button size="sm" variant="outline" className="border-white/10 font-bold">
                    Dashboard Admin
                  </Button>
                </Link>
              </div>
            </div>
          </Card>
        </section>
      )}

      {/* Filters */}
      <section className="max-w-7xl mx-auto px-6 mb-10">
        <div className="flex flex-col lg:flex-row gap-6">
          <div className="flex-grow space-y-4">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <input
                type="text"
                placeholder="Buscar eventos, lugares, artistas..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full h-12 pl-12 pr-4 bg-white/5 border border-white/10 rounded-2xl text-sm font-medium placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 transition-colors"
              />
            </div>
            
            <div className="flex gap-2 flex-wrap">
              {categories.map(cat => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${
                    selectedCategory === cat
                      ? 'orange-gradient text-white shadow-lg shadow-primary/20'
                      : 'bg-white/5 border border-white/10 text-muted-foreground hover:border-primary/30 hover:text-white'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          <div className="lg:w-64 flex-shrink-0">
            <div className="bg-white/5 border border-white/10 rounded-2xl p-1 flex">
              {(['upcoming', 'past', 'all'] as const).map(t => (
                <button
                  key={t}
                  onClick={() => setTimeFilter(t)}
                  className={`flex-1 py-2.5 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all ${
                    timeFilter === t
                      ? 'orange-gradient text-white shadow-lg shadow-primary/20'
                      : 'text-muted-foreground hover:text-white'
                  }`}
                >
                  {t === 'upcoming' ? 'Próximos' : t === 'past' ? 'Pasados' : 'Todos'}
                </button>
              ))}
            </div>
            <p className="text-[10px] text-center text-muted-foreground mt-2 uppercase tracking-widest font-bold">
              Filtrar por fecha
            </p>
          </div>
        </div>
      </section>

      {/* Error banner */}
      {fetchError && (
        <section className="max-w-7xl mx-auto px-6 mb-6">
          <Card className="glass rounded-2xl border-red-500/30 p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-bold text-red-500">Error al cargar eventos</p>
                <p className="text-xs text-muted-foreground mt-1">{fetchError}</p>
              </div>
            </div>
          </Card>
        </section>
      )}

      {/* Events Grid */}
      <section className="max-w-7xl mx-auto px-6">
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <div key={i} className="glass rounded-3xl border-white/10 h-80 animate-pulse" />
            ))}
          </div>
        ) : filteredEvents.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-20"
          >
            <Music className="w-16 h-16 text-muted-foreground mx-auto mb-4 opacity-50" />
            <h3 className="text-xl font-heading font-bold mb-2">No encontramos eventos</h3>
            <p className="text-muted-foreground text-sm max-w-md mx-auto">
              {searchTerm
                ? `No hay resultados para "${searchTerm}". Probá con otra búsqueda.`
                : events.length === 0
                ? 'Todavía no hay eventos en la base de datos. Creá uno desde el dashboard.'
                : 'No hay eventos que coincidan con los filtros actuales.'}
            </p>
            {isAdmin && (
              <Link to="/admin/dashboard" className="inline-block mt-4">
                <Button className="orange-gradient border-none font-bold">
                  Ir al Dashboard Admin
                </Button>
              </Link>
            )}
          </motion.div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredEvents.map((event, i) => {
              const soldOut = isSoldOut(event);
              const status = event.status || 'active';
              const isDeleted = status === 'deleted';
              const isScheduled = status === 'scheduled';
              const isPaused = status === 'paused';

              return (
                <motion.div
                  key={event.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(i * 0.04, 0.3) }}
                >
                  <Link to={`/evento/${event.id}`}>
                    <Card
                      className={`glass rounded-3xl border-white/10 overflow-hidden hover:border-primary/30 transition-all group cursor-pointer h-full flex flex-col ${
                        soldOut || isDeleted ? 'opacity-75' : ''
                      }`}
                    >
                      <div className="relative h-52 overflow-hidden flex-shrink-0">
                        <img
                          src={event.image || null}
                          alt={event.title}
                          className={`w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 ${
                            soldOut || isDeleted ? 'grayscale' : ''
                          }`}
                          referrerPolicy="no-referrer"
                        />
                        <Badge className="absolute top-3 left-3 orange-gradient border-none font-bold uppercase text-[10px] tracking-widest">
                          {event.category || 'Evento'}
                        </Badge>

                        {/* Status overlays (priority: deleted > scheduled > sold out > paused) */}
                        {isDeleted && (
                          <div className="absolute inset-0 bg-black/70 flex items-center justify-center">
                            <div className="text-center">
                              <Trash2 className="w-10 h-10 text-red-500 mx-auto mb-2" />
                              <span className="text-lg font-heading font-black text-red-500 uppercase tracking-widest">
                                Eliminado
                              </span>
                              {isAdmin && (
                                <p className="text-[10px] text-white/70 mt-1 uppercase tracking-widest">
                                  Solo admin
                                </p>
                              )}
                            </div>
                          </div>
                        )}

                        {isScheduled && !isDeleted && (
                          <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                            <div className="text-center px-4">
                              <Clock className="w-10 h-10 text-blue-400 mx-auto mb-2" />
                              <span className="text-sm font-heading font-black text-blue-400 uppercase tracking-widest block">
                                Programado
                              </span>
                              {event.scheduledPublishAt && (
                                <p className="text-[10px] text-white/80 mt-1">
                                  {formatScheduled(event.scheduledPublishAt)}
                                </p>
                              )}
                            </div>
                          </div>
                        )}

                        {soldOut && !isDeleted && !isScheduled && (
                          <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                            <div className="text-center">
                              <Ticket className="w-10 h-10 text-red-500 mx-auto mb-2" />
                              <span className="text-xl font-heading font-black text-red-500 uppercase tracking-widest">
                                Sold Out
                              </span>
                            </div>
                          </div>
                        )}

                        {isPaused && !soldOut && !isDeleted && !isScheduled && (
                          <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                            <div className="text-center">
                              <AlertTriangle className="w-10 h-10 text-yellow-500 mx-auto mb-2" />
                              <span className="text-sm font-heading font-black text-yellow-500 uppercase tracking-widest">
                                Venta pausada
                              </span>
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="p-5 space-y-3 flex-grow flex flex-col">
                        <div className="flex items-center gap-2 text-xs text-primary font-bold uppercase tracking-widest">
                          <Calendar className="w-3.5 h-3.5" />
                          {formatDate(event.date)}
                        </div>
                        <h3 className="text-lg font-heading font-bold group-hover:text-primary transition-colors">
                          {event.title}
                        </h3>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <MapPin className="w-3.5 h-3.5" />
                          {event.venue}{event.location ? `, ${event.location}` : ''}
                        </div>
                        <div className="flex items-center justify-between pt-3 border-t border-white/5 mt-auto">
                          {isDeleted ? (
                            <span className="text-sm font-bold text-red-500 uppercase tracking-widest">Eliminado</span>
                          ) : isScheduled ? (
                            <span className="text-sm font-bold text-blue-400 uppercase tracking-widest">Programado</span>
                          ) : soldOut ? (
                            <span className="text-sm font-bold text-red-500 uppercase tracking-widest">Agotado</span>
                          ) : isPaused ? (
                            <span className="text-sm font-bold text-yellow-500 uppercase tracking-widest">Pausado</span>
                          ) : (
                            <>
                              <span className="text-xs text-muted-foreground uppercase tracking-widest font-bold">Desde</span>
                              <span className="text-lg font-heading font-black text-primary">
                                ${event.price ? (Number(event.price) || 0).toLocaleString('es-AR') : '0'}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </Card>
                  </Link>
                </motion.div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
