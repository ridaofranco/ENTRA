import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Card } from '@/src/components/ui/card';
import { Badge } from '@/src/components/ui/badge';
import { Button } from '@/src/components/ui/button';
import { Input } from '@/src/components/ui/input';
import { Search, Calendar, MapPin } from 'lucide-react';
import { Link } from 'react-router-dom';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '@/src/lib/firebase';
import { cn } from '@/lib/utils';
import { seedEventsIfMissing } from '@/src/services/eventService';

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
}

export default function Catalog() {
  const [events, setEvents] = useState<Event[]>([]);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('Todos');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchEvents = async () => {
      try {
        await seedEventsIfMissing();
        const eventsCol = collection(db, 'events');
        const q = query(eventsCol, orderBy('date', 'asc'));
        const snapshot = await getDocs(q);
        setEvents(snapshot.docs.map(doc => ({ id: doc.id, ...(doc.data() as any) } as Event)));
      } catch (error) {
        handleFirestoreError(error, OperationType.LIST, 'events');
      } finally {
        setLoading(false);
      }
    };

    fetchEvents();
  }, []);

  const categories = ['Todos', 'Música', 'Deportes', 'Cine', 'Teatro', 'Festivales'];

  const filteredEvents = events.filter(e => {
    const matchesSearch = e.title.toLowerCase().includes(search.toLowerCase()) || 
                         e.venue.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = category === 'Todos' || e.category === category;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="pt-32 pb-20 px-6 max-w-7xl mx-auto">
      <div className="mb-12">
        <h1 className="text-4xl md:text-6xl font-heading font-black mb-6 tracking-tighter">
          Próximos <span className="orange-text-gradient">Eventos</span>
        </h1>
        
        <div className="flex flex-col lg:flex-row gap-6">
          <div className="relative flex-grow">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <Input 
              placeholder="Buscar por artista, evento o lugar..." 
              className="pl-12 h-14 bg-white/5 border-white/10 rounded-2xl focus:ring-primary/50"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
            {categories.map(c => (
              <Button
                key={c}
                variant={category === c ? "default" : "outline"}
                className={cn(
                  "rounded-full px-6 h-14 font-bold transition-all",
                  category === c ? "orange-gradient border-none" : "border-white/10 hover:border-primary/50"
                )}
                onClick={() => setCategory(c)}
              >
                {c}
              </Button>
            ))}
          </div>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-[450px] rounded-3xl bg-white/5 animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {filteredEvents.map((event, i) => (
            <motion.div
              key={event.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
            >
              <Link to={`/evento/${event.id}`}>
                <Card className="glass rounded-[2rem] border-white/5 overflow-hidden group hover:border-primary/30 transition-all">
                  <div className="relative h-64 overflow-hidden">
                    <img 
                      src={event.image || `https://picsum.photos/seed/${event.id}/800/600`} 
                      alt={event.title} 
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                      referrerPolicy="no-referrer"
                    />
                    <div className="absolute top-4 left-4">
                      <Badge className="orange-gradient border-none font-bold uppercase tracking-widest text-[10px] px-3 py-1">
                        {event.category}
                      </Badge>
                    </div>
                    <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent opacity-60" />
                  </div>
                  <div className="p-6">
                    <div className="flex items-center gap-2 text-primary text-xs font-bold uppercase tracking-widest mb-3">
                      <Calendar className="w-4 h-4" />
                      {event.date?.toDate().toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })}
                    </div>
                    <h3 className="text-2xl font-heading font-bold mb-2 group-hover:text-primary transition-colors">{event.title}</h3>
                    <div className="flex items-center gap-2 text-muted-foreground text-sm mb-6">
                      <MapPin className="w-4 h-4" />
                      {event.venue}, {event.location}
                    </div>
                    <div className="flex justify-between items-center pt-6 border-t border-white/5">
                      <div>
                        <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">Desde</div>
                        <div className="text-2xl font-heading font-black text-primary">${event.price.toLocaleString('es-AR')}</div>
                      </div>
                      <Button className="orange-gradient border-none font-bold rounded-xl px-6">
                        Comprar
                      </Button>
                    </div>
                  </div>
                </Card>
              </Link>
            </motion.div>
          ))}
        </div>
      )}

      {!loading && filteredEvents.length === 0 && (
        <div className="text-center py-20">
          <div className="text-6xl mb-6">🔍</div>
          <h3 className="text-2xl font-heading font-bold mb-2">No encontramos eventos</h3>
          <p className="text-muted-foreground">Probá con otros filtros o términos de búsqueda.</p>
        </div>
      )}
    </div>
  );
}
