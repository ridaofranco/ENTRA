import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Button } from '@/src/components/ui/button';
import { Card } from '@/src/components/ui/card';
import { Badge } from '@/src/components/ui/badge';
import {
  Calendar, MapPin, Search, Filter, Music, Ticket,
  ChevronRight, AlertTriangle
} from 'lucide-react';
import { collection, getDocs, query, where, orderBy } from 'firebase/firestore';
import { db } from '@/src/lib/firebase';

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
}

export default function Catalog() {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('Todos');

  useEffect(() => {
    const fetchEvents = async () => {
      try {
        // Try with status filter + ordering
        const q = query(
          collection(db, 'events'),
          where('status', '==', 'active'),
          orderBy('date', 'asc')
        );
        const snapshot = await getDocs(q);
        const data = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as Event[];
        setEvents(data);
      } catch (error) {
        console.error('Error fetching events with index:', error);
        // Fallback: fetch all and filter client-side (no index needed)
        try {
          const fallbackSnapshot = await getDocs(collection(db, 'events'));
          const data = fallbackSnapshot.docs
            .map(doc => ({ id: doc.id, ...doc.data() }) as Event)
            .filter(e => !e.status || e.status === 'active');
          setEvents(data);
        } catch (e) {
          console.error('Fallback also failed:', e);
        }
      } finally {
        setLoading(false);
      }
    };

    fetchEvents();
  }, []);

  const formatDate = (date: any) => {
    if (date?.toDate) {
      return date.toDate().toLocaleDateString('es-AR', {
        weekday: 'short', day: 'numeric', month: 'short', year: 'numeric'
      });
    }
    return '';
  };

  // Check if an event is sold out (all tickets have 0 available)
  const isSoldOut = (event: Event): boolean => {
    if (!event.tickets || event.tickets.length === 0) return false;
    return event.tickets.every(t => (t.available || 0) <= 0);
  };

  // Get unique categories
  const categories = ['Todos', ...Array.from(new Set(events.map(e => e.category).filter(Boolean)))];

  // Filter events
  const filteredEvents = events.filter(event => {
    const matchesSearch = event.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      event.venue?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      event.location?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'Todos' || event.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="pb-20 pt-28">
      {/* Header */}
      <section className="max-w-7xl mx-auto px-6 mb-12">
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

      {/* Filters */}
      <section className="max-w-7xl mx-auto px-6 mb-10">
        <div className="flex flex-col md:flex-row gap-4">
          {/* Search */}
          <div className="relative flex-grow">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <input
              type="text"
              placeholder="Buscar eventos, lugares, artistas..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full h-12 pl-12 pr-4 bg-white/5 border border-white/10 rounded-2xl text-sm font-medium placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 transition-colors"
            />
          </div>

          {/* Category filter */}
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
      </section>

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
            <p className="text-muted-foreground text-sm">
              {searchTerm
                ? `No hay resultados para "${searchTerm}". Probá con otra búsqueda.`
                : 'Todavía no hay eventos publicados. Volvé pronto.'}
            </p>
          </motion.div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredEvents.map((event, i) => {
              const soldOut = isSoldOut(event);
              return (
                <motion.div
                  key={event.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                >
                  <Link to={`/evento/${event.id}`}>
                    <Card className={`glass rounded-3xl border-white/10 overflow-hidden hover:border-primary/30 transition-all group cursor-pointer h-full flex flex-col ${soldOut ? 'opacity-75' : ''}`}>
                      <div className="relative h-52 overflow-hidden flex-shrink-0">
                        <img
                          src={event.image || null}
                          alt={event.title}
                          className={`w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 ${soldOut ? 'grayscale' : ''}`}
                          referrerPolicy="no-referrer"
                        />
                        <Badge className="absolute top-3 left-3 orange-gradient border-none font-bold uppercase text-[10px] tracking-widest">
                          {event.category}
                        </Badge>

                        {/* Sold Out overlay */}
                        {soldOut && (
                          <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                            <div className="text-center">
                              <Ticket className="w-10 h-10 text-red-500 mx-auto mb-2" />
                              <span className="text-xl font-heading font-black text-red-500 uppercase tracking-widest">
                                Sold Out
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
                          {soldOut ? (
                            <span className="text-sm font-bold text-red-500 uppercase tracking-widest">Agotado</span>
                          ) : (
                            <>
                              <span className="text-xs text-muted-foreground uppercase tracking-widest font-bold">Desde</span>
                              <span className="text-lg font-heading font-black text-primary">
                                ${event.price?.toLocaleString('es-AR')}
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

