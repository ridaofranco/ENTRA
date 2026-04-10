import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Button } from '@/src/components/ui/button';
import { Card } from '@/src/components/ui/card';
import { Badge } from '@/src/components/ui/badge';
import { Calendar, MapPin, Clock, Share2, Info, Ticket, ChevronRight, Minus, Plus, AlertTriangle } from 'lucide-react';
import { doc, getDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '@/src/lib/firebase';

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
  tickets: TicketType[];
  status?: string;
}

export default function EventDetail() {
  const { id } = useParams();
  const [event, setEvent] = useState<Event | null>(null);
  const [loading, setLoading] = useState(true);
  const [quantities, setQuantities] = useState<Record<string, number>>({});

  useEffect(() => {
    const fetchEvent = async () => {
      if (!id) return;
      try {
        const eventDoc = await getDoc(doc(db, 'events', id));
        if (eventDoc.exists()) {
          const data = { id: eventDoc.id, ...eventDoc.data() } as Event;
          setEvent(data);
          const initial: Record<string, number> = {};
          data.tickets.forEach((t: TicketType) => initial[t.type] = 0);
          setQuantities(initial);
        }
      } catch (error) {
        handleFirestoreError(error, OperationType.GET, `events/${id}`);
      } finally {
        setLoading(false);
      }
    };

    fetchEvent();
  }, [id]);

  const updateQty = (type: string, delta: number) => {
    setQuantities(prev => ({
      ...prev,
      [type]: Math.max(0, (prev[type] || 0) + delta)
    }));
  };

  const total = event?.tickets.reduce((acc, t) => acc + (quantities[t.type] || 0) * t.price, 0) || 0;
  const totalQty = Object.values(quantities).reduce((acc: number, q) => acc + (q as number), 0);

  // Check if event is available for purchase
  const isEventActive = !event?.status || event.status === 'active';

  // Check if sold out (all tickets have 0 available)
  const isSoldOut = event?.tickets?.length
    ? event.tickets.every(t => (t.available || 0) <= 0)
    : false;

  if (loading) return <div className="pt-40 text-center">Cargando...</div>;
  if (!event) return <div className="pt-40 text-center">Evento no encontrado</div>;

  // Deleted events: show not found (buyer should not see them at all)
  if (event.status === 'deleted') {
    return (
      <div className="pt-40 text-center max-w-md mx-auto px-6">
        <AlertTriangle className="w-16 h-16 text-muted-foreground mx-auto mb-4 opacity-50" />
        <h2 className="text-2xl font-heading font-bold mb-2">Evento no disponible</h2>
        <p className="text-muted-foreground mb-6">Este evento fue eliminado y ya no está disponible.</p>
        <Link to="/eventos">
          <Button variant="outline" className="font-bold border-white/10 hover:border-primary hover:text-primary">
            Ver otros eventos
          </Button>
        </Link>
      </div>
    );
  }

  const eventDate = event.date?.toDate();

  return (
    <div className="pb-20">
      {/* Banner */}
      <div className="relative h-[60vh] overflow-hidden">
        <img 
          src={event.image || null} 
          alt={event.title} 
          className="w-full h-full object-cover"
          referrerPolicy="no-referrer"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" />
        <div className="absolute bottom-0 left-0 w-full p-6 md:p-12 max-w-7xl mx-auto right-0">
          <Badge className="orange-gradient border-none font-bold uppercase tracking-widest text-xs px-4 py-1.5 mb-6">
            {event.category}
          </Badge>
          <h1 className="text-4xl md:text-7xl font-heading font-black tracking-tighter mb-6 max-w-4xl">
            {event.title}
          </h1>
          <div className="flex flex-wrap gap-6 text-sm font-bold uppercase tracking-wider">
            <div className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-primary" />
              {eventDate?.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
            </div>
            <div className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-primary" />
              {eventDate?.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}hs
            </div>
            <div className="flex items-center gap-2">
              <MapPin className="w-5 h-5 text-primary" />
              {event.venue}, {event.location}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 lg:grid-cols-3 gap-12 mt-12">
        {/* Left Column: Info */}
        <div className="lg:col-span-2 space-y-12">
          <section>
            <h2 className="text-2xl font-heading font-bold mb-6 flex items-center gap-3">
              <Info className="w-6 h-6 text-primary" />
              Sobre el evento
            </h2>
            <p className="text-muted-foreground leading-relaxed text-lg whitespace-pre-line">
              {event.description}
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-heading font-bold mb-6 flex items-center gap-3">
              <MapPin className="w-6 h-6 text-primary" />
              Ubicación
            </h2>
            <div className="glass rounded-3xl h-80 flex items-center justify-center text-muted-foreground overflow-hidden">
              <img 
                src={`https://picsum.photos/seed/${event.venue}/1200/400?blur=2`} 
                alt="Map placeholder" 
                className="w-full h-full object-cover opacity-50"
                referrerPolicy="no-referrer"
              />
              <div className="absolute bg-background/80 backdrop-blur-md p-6 rounded-2xl border border-white/10 text-center">
                <p className="font-bold mb-1">{event.venue}</p>
                <p className="text-sm text-muted-foreground">{event.location}</p>
                <Button variant="link" className="text-primary font-bold mt-2">Ver en Google Maps</Button>
              </div>
            </div>
          </section>
        </div>

        {/* Right Column: Tickets */}
        <div className="space-y-6">
          <Card className="glass p-8 rounded-[2.5rem] border-white/10 sticky top-28 shadow-2xl shadow-primary/5">
            {!isEventActive ? (
              /* Event is paused — block purchases */
              <div className="text-center py-8">
                <div className="w-16 h-16 rounded-full bg-yellow-500/10 flex items-center justify-center mx-auto mb-4">
                  <AlertTriangle className="w-8 h-8 text-yellow-500" />
                </div>
                <h3 className="text-xl font-heading font-bold mb-2">Evento pausado</h3>
                <p className="text-muted-foreground text-sm mb-4">
                  La venta de entradas para este evento se encuentra temporalmente suspendida. Volvé a intentar más tarde.
                </p>
                <Link to="/eventos">
                  <Button variant="outline" className="font-bold border-white/10 hover:border-primary hover:text-primary">
                    Ver otros eventos
                  </Button>
                </Link>
              </div>
            ) : isSoldOut ? (
              /* Event is sold out */
              <div className="text-center py-8">
                <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-4">
                  <Ticket className="w-8 h-8 text-red-500" />
                </div>
                <h3 className="text-xl font-heading font-black mb-2 text-red-500 uppercase tracking-wider">Sold Out</h3>
                <p className="text-muted-foreground text-sm mb-4">
                  Todas las entradas para este evento fueron vendidas. Seguí atento por si se liberan más.
                </p>
                <Link to="/eventos">
                  <Button variant="outline" className="font-bold border-white/10 hover:border-primary hover:text-primary">
                    Ver otros eventos
                  </Button>
                </Link>
              </div>
            ) : (
              /* Event is active — show ticket selector */
              <>
                <h3 className="text-2xl font-heading font-bold mb-8 flex items-center gap-3">
                  <Ticket className="w-6 h-6 text-primary" />
                  Seleccioná tus entradas
                </h3>

                <div className="space-y-6 mb-10">
                  {event.tickets.map((t, i) => (
                    <div key={i} className="flex justify-between items-center group">
                      <div>
                        <div className="font-bold text-lg group-hover:text-primary transition-colors">{t.type}</div>
                        <div className="text-primary font-black text-xl">${t.price.toLocaleString('es-AR')}</div>
                        <div className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold mt-1">
                          {t.available} disponibles
                        </div>
                      </div>
                      <div className="flex items-center gap-4 bg-white/5 rounded-xl p-2 border border-white/5">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="w-8 h-8 hover:bg-primary/20 hover:text-primary"
                          onClick={() => updateQty(t.type, -1)}
                        >
                          <Minus className="w-4 h-4" />
                        </Button>
                        <span className="font-heading font-black text-lg min-w-[20px] text-center">
                          {quantities[t.type] || 0}
                        </span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="w-8 h-8 hover:bg-primary/20 hover:text-primary"
                          onClick={() => updateQty(t.type, 1)}
                        >
                          <Plus className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="pt-8 border-t border-white/10 space-y-6">
                  <div className="flex justify-between items-end">
                    <div>
                      <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold mb-1">Total ({totalQty} tickets)</div>
                      <div className="text-4xl font-heading font-black text-primary">${total.toLocaleString('es-AR')}</div>
                    </div>
                    <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-primary">
                      <Share2 className="w-5 h-5" />
                    </Button>
                  </div>

                  <Link
                    to="/checkout"
                    state={{
                      event: {
                        id: event.id,
                        title: event.title,
                        venue: event.venue,
                        location: event.location,
                        image: event.image,
                        date: event.date
                      },
                      selectedTickets: event.tickets
                        .filter(t => (quantities[t.type] || 0) > 0)
                        .map(t => ({
                          type: t.type,
                          price: t.price,
                          quantity: quantities[t.type]
                        }))
                    }}
                  >
                    <Button
                      disabled={totalQty === 0}
                      className="w-full h-16 orange-gradient border-none font-black text-xl rounded-2xl shadow-xl shadow-primary/20 disabled:opacity-50 disabled:grayscale"
                    >
                      Continuar Compra
                      <ChevronRight className="ml-2 w-6 h-6" />
                    </Button>
                  </Link>
                  <p className="text-[10px] text-center text-muted-foreground uppercase tracking-widest font-bold">
                    Compra segura · Sin registro obligatorio
                  </p>
                </div>
              </>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}

