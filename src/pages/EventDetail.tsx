import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Calendar, MapPin, Clock, Share2, Info, Ticket, ChevronRight, Minus, Plus } from 'lucide-react';
import { doc, getDoc } from 'firebase/firestore';
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
  tickets: TicketType[];
  ticketsSold: number;
  totalRevenue: number;
}

export default function EventDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [event, setEvent] = useState<Event | null>(null);
  const [loading, setLoading] = useState(true);
  const [quantities, setQuantities] = useState<Record<string, number>>({});

  // Fetch event fresh from Firestore every time (no cache)
  const fetchEvent = async () => {
    if (!id) return;
    try {
      const eventDoc = await getDoc(doc(db, 'events', id));
      if (eventDoc.exists()) {
        const data = { id: eventDoc.id, ...eventDoc.data() } as Event;
        setEvent(data);
        // Only initialize quantities if not already set (preserve user selections)
        setQuantities(prev => {
          if (Object.keys(prev).length === 0) {
            const initial: Record<string, number> = {};
            (data.tickets || []).forEach((t: TicketType) => initial[t.type] = 0);
            return initial;
          }
          return prev;
        });
      }
    } catch (error) {
      console.error('Error fetching event:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEvent();
  }, [id]);

  // Re-fetch when user comes back to this page (e.g. after buying)
  useEffect(() => {
    const handleFocus = () => { fetchEvent(); };
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [id]);

  const updateQty = (type: string, delta: number) => {
    const ticket = event?.tickets.find(t => t.type === type);
    const maxAvailable = ticket?.available || 0;
    setQuantities(prev => {
      const current = prev[type] || 0;
      const next = current + delta;
      // Don't allow more than available or less than 0
      if (next < 0 || next > maxAvailable) return prev;
      return { ...prev, [type]: next };
    });
  };

  const total = event?.tickets.reduce((acc, t) => acc + (quantities[t.type] || 0) * t.price, 0) || 0;
  const totalQty = Object.values(quantities).reduce((acc: number, q) => acc + (q as number), 0);

  if (loading) {
    return (
      <div className="pt-40 text-center">
        <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-zinc-400">Cargando evento...</p>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="pt-40 text-center space-y-4">
        <p className="text-xl text-zinc-400">Evento no encontrado</p>
        <Link to="/eventos">
          <button className="text-orange-500 font-bold hover:underline">Volver a eventos</button>
        </Link>
      </div>
    );
  }

  const formatDate = (date: any) => {
    try {
      const d = date?.toDate ? date.toDate() : date?.seconds ? new Date(date.seconds * 1000) : null;
      if (!d) return '';
      return d.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    } catch { return ''; }
  };

  const formatTime = (date: any) => {
    try {
      const d = date?.toDate ? date.toDate() : date?.seconds ? new Date(date.seconds * 1000) : null;
      if (!d) return '';
      return d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }) + 'hs';
    } catch { return ''; }
  };

  return (
    <div className="pb-20">
      {/* Banner */}
      <div className="relative h-[60vh] overflow-hidden bg-white/5">
        <img
          src={event.image || `https://picsum.photos/seed/${event.id}/1920/1080`}
          alt={event.title}
          className={`w-full h-full object-cover ${!event.image ? 'opacity-50' : ''}`}
          referrerPolicy="no-referrer"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#09090B] via-[#09090B]/40 to-transparent" />
        <div className="absolute bottom-0 left-0 w-full p-6 md:p-12 max-w-7xl mx-auto right-0">
          <span className="inline-block bg-gradient-to-r from-orange-500 to-orange-600 text-white text-xs font-bold uppercase tracking-widest px-4 py-1.5 rounded-full mb-6">
            {event.category}
          </span>
          <h1 className="text-4xl md:text-7xl font-black tracking-tight mb-6 max-w-4xl">
            {event.title}
          </h1>
          <div className="flex flex-wrap gap-6 text-sm font-bold uppercase tracking-wider">
            <div className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-orange-500" />
              {formatDate(event.date)}
            </div>
            <div className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-orange-500" />
              {formatTime(event.date)}
            </div>
            <div className="flex items-center gap-2">
              <MapPin className="w-5 h-5 text-orange-500" />
              {event.venue}, {event.location}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 lg:grid-cols-3 gap-12 mt-12">
        {/* Left Column: Info */}
        <div className="lg:col-span-2 space-y-12">
          <section>
            <h2 className="text-2xl font-bold mb-6 flex items-center gap-3">
              <Info className="w-6 h-6 text-orange-500" />
              Sobre el evento
            </h2>
            <p className="text-zinc-400 leading-relaxed text-lg whitespace-pre-line">
              {event.description}
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold mb-6 flex items-center gap-3">
              <MapPin className="w-6 h-6 text-orange-500" />
              Ubicacion
            </h2>
            <div className="bg-white/5 backdrop-blur-sm rounded-3xl h-48 flex items-center justify-center border border-white/10 relative overflow-hidden">
              <div className="text-center z-10">
                <p className="font-bold mb-1">{event.venue}</p>
                <p className="text-sm text-zinc-400">{event.location}</p>
              </div>
            </div>
          </section>
        </div>

        {/* Right Column: Tickets */}
        <div className="space-y-6">
          <div className="bg-white/5 backdrop-blur-sm p-8 rounded-[2.5rem] border border-white/10 sticky top-28 shadow-2xl shadow-orange-500/5">
            <h3 className="text-2xl font-bold mb-8 flex items-center gap-3">
              <Ticket className="w-6 h-6 text-orange-500" />
              Selecciona tus entradas
            </h3>

            <div className="space-y-6 mb-10">
              {(event.tickets || []).map((t, i) => (
                <div key={i} className="flex justify-between items-center group">
                  <div>
                    <div className="font-bold text-lg group-hover:text-orange-500 transition-colors">{t.type}</div>
                    <div className="text-orange-500 font-black text-xl">${t.price?.toLocaleString('es-AR')}</div>
                    <div className={`text-[10px] uppercase tracking-widest font-bold mt-1 ${t.available <= 0 ? 'text-red-500' : 'text-zinc-500'}`}>
                      {t.available <= 0 ? 'AGOTADO' : `${t.available} disponibles`}
                    </div>
                  </div>
                  <div className="flex items-center gap-4 bg-white/5 rounded-xl p-2 border border-white/5">
                    <button
                      className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-orange-500/20 hover:text-orange-500 transition-colors disabled:opacity-30"
                      onClick={() => updateQty(t.type, -1)}
                      disabled={!quantities[t.type]}
                    >
                      <Minus className="w-4 h-4" />
                    </button>
                    <span className="font-black text-lg min-w-[20px] text-center">
                      {quantities[t.type] || 0}
                    </span>
                    <button
                      className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-orange-500/20 hover:text-orange-500 transition-colors disabled:opacity-30"
                      onClick={() => updateQty(t.type, 1)}
                      disabled={t.available <= 0 || (quantities[t.type] || 0) >= t.available}
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="pt-8 border-t border-white/10 space-y-6">
              <div className="flex justify-between items-end">
                <div>
                  <div className="text-[10px] uppercase tracking-widest text-zinc-500 font-bold mb-1">Total ({totalQty} tickets)</div>
                  <div className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-orange-500 to-orange-600">
                    ${total.toLocaleString('es-AR')}
                  </div>
                </div>
                <button className="text-zinc-500 hover:text-orange-500 p-2 rounded-lg transition-colors">
                  <Share2 className="w-5 h-5" />
                </button>
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
                  selectedTickets: (event.tickets || [])
                    .filter(t => (quantities[t.type] || 0) > 0)
                    .map(t => ({
                      type: t.type,
                      price: t.price,
                      quantity: quantities[t.type]
                    }))
                }}
              >
                <button
                  disabled={totalQty === 0}
                  className="w-full h-16 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 disabled:opacity-30 disabled:grayscale text-white font-black text-xl rounded-2xl shadow-xl shadow-orange-500/20 flex items-center justify-center gap-2 transition-all"
                >
                  Continuar Compra
                  <ChevronRight className="w-6 h-6" />
                </button>
              </Link>
              <p className="text-[10px] text-center text-zinc-500 uppercase tracking-widest font-bold">
                Compra segura · Sin registro obligatorio
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

