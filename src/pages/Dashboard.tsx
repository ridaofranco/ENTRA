import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import {
  Plus, DollarSign, Ticket, Calendar, Users, TrendingUp,
  MapPin, BarChart3, Loader2, Eye, Settings, ChevronRight, Search
} from 'lucide-react';
import { collection, query, where, getDocs, doc, getDoc, orderBy } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { db, auth } from '@/src/lib/firebase';

interface EventData {
  id: string;
  title: string;
  date: any;
  venue: string;
  location: string;
  image: string;
  category: string;
  status: string;
  tickets: Array<{ type: string; price: number; available: number }>;
  ticketsSold: number;
  totalRevenue: number;
  organizerEmail: string;
}

interface OrderData {
  id: string;
  buyerName: string;
  buyerEmail: string;
  eventTitle: string;
  eventId: string;
  items: Array<{ type: string; quantity: number; price: number }>;
  total: number;
  status: string;
  createdAt: any;
}

export default function Dashboard() {
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);
  const [events, setEvents] = useState<EventData[]>([]);
  const [recentOrders, setRecentOrders] = useState<OrderData[]>([]);
  const [allOrders, setAllOrders] = useState<OrderData[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'eventos' | 'ventas'>('eventos');
  const [eventSearch, setEventSearch] = useState('');
  const [eventTimeFilter, setEventTimeFilter] = useState<'all' | 'upcoming' | 'past'>('all');

  // Auth
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      if (firebaseUser) {
        setUser(firebaseUser);
      } else {
        navigate('/auth/login');
      }
    });
    return () => unsubscribe();
  }, [navigate]);

  // Load data
  useEffect(() => {
    if (user) loadDashboardData();
  }, [user]);

  const loadDashboardData = async () => {
    if (!user) return;
    setLoading(true);
    try {
      let eventsQuery;
      const isSuperAdmin = user.email === 'ridaofrancorg@gmail.com';

      if (isSuperAdmin) {
        eventsQuery = query(collection(db, 'events'));
      } else {
        eventsQuery = query(collection(db, 'events'), where('organizerEmail', '==', user.email));
      }

      const eventsSnap = await getDocs(eventsQuery);
      const eventsList: EventData[] = eventsSnap.docs.map(d => ({ id: d.id, ...(d.data() as any) } as EventData));
      setEvents(eventsList);

      const eventIds = eventsList.map(e => e.id);
      if (eventIds.length > 0) {
        // Firestore 'in' supports max 30 values
        const batchIds = eventIds.slice(0, 30);
        const ordersQuery = query(
          collection(db, 'orders'),
          where('eventId', 'in', batchIds)
        );
        const ordersSnap = await getDocs(ordersQuery);
        const ordersList: OrderData[] = ordersSnap.docs.map(d => ({ id: d.id, ...d.data() } as OrderData));

        ordersList.sort((a, b) => {
          const aTime = a.createdAt?.seconds || 0;
          const bTime = b.createdAt?.seconds || 0;
          return bTime - aTime;
        });

        setAllOrders(ordersList);
        setRecentOrders(ordersList.slice(0, 20));
      }
    } catch (error) {
      console.error('Dashboard load error:', error);
    } finally {
      setLoading(false);
    }
  };

  // ==================== COMPUTED STATS (from real orders) ====================
  const confirmedOrders = allOrders.filter(o => o.status === 'confirmed');
  const totalRevenue = confirmedOrders.reduce((sum, o) => sum + (Number(o.total) || 0), 0);
  const totalTicketsSold = confirmedOrders.reduce((sum, o) => {
    return sum + (o.items || []).reduce((s: number, item: any) => s + (Number(item.quantity) || 0), 0);
  }, 0);
  const activeEvents = events.filter(e => e.status === 'active').length;
  const totalCapacity = events.reduce((sum, e) => {
    const cap = (e.tickets || []).reduce((s: number, t: any) => s + (Number(t.available) || 0), 0);
    return sum + cap;
  }, 0) + totalTicketsSold;

  const formatDate = (date: any) => {
    try {
      if (date?.toDate) return date.toDate().toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric' });
      if (date?.seconds) return new Date(date.seconds * 1000).toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric' });
    } catch { }
    return '';
  };

  const formatShortDate = (date: any) => {
    try {
      if (date?.toDate) return date.toDate().toLocaleDateString('es-AR', { day: 'numeric', month: 'short' });
      if (date?.seconds) return new Date(date.seconds * 1000).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' });
    } catch { }
    return '';
  };

  // ==================== FILTERED EVENTS ====================
  const filteredEvents = events.filter(e => {
    const eventDate = e.date?.toDate ? e.date.toDate() : e.date?.seconds ? new Date(e.date.seconds * 1000) : null;
    const now = new Date();
    
    const matchesTime = eventTimeFilter === 'all' || 
                       (eventTimeFilter === 'upcoming' && eventDate && eventDate >= now) ||
                       (eventTimeFilter === 'past' && eventDate && eventDate < now);
                       
    const matchesSearch = e.title.toLowerCase().includes(eventSearch.toLowerCase()) ||
                         e.venue?.toLowerCase().includes(eventSearch.toLowerCase());
                         
    return matchesTime && matchesSearch;
  });

  // ==================== LOADING ====================
  if (loading) {
    return (
      <div className="pt-32 pb-20 px-6 max-w-6xl mx-auto flex flex-col items-center justify-center min-h-[60vh]">
        <Loader2 className="w-10 h-10 text-orange-500 animate-spin mb-4" />
        <p className="text-zinc-400">Cargando dashboard...</p>
      </div>
    );
  }

  // ==================== RENDER ====================
  return (
    <div className="pt-32 pb-20 px-6 max-w-6xl mx-auto">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between mb-10">
        <div>
          <h1 className="text-3xl font-black tracking-tight">Dashboard</h1>
          <p className="text-zinc-400 mt-1">Gestion de tus eventos y ventas</p>
        </div>
        <Link to="/crear-evento">
          <button className="flex items-center gap-2 bg-gradient-to-r from-orange-500 to-orange-600 text-white font-bold px-5 py-3 rounded-2xl hover:from-orange-600 hover:to-orange-700 transition-all shadow-lg shadow-orange-500/20">
            <Plus className="w-5 h-5" />
            Crear Evento
          </button>
        </Link>
      </motion.div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
        {[
          {
            label: 'Ingresos Totales',
            value: `$${(Number(totalRevenue) || 0).toLocaleString('es-AR')}`,
            icon: DollarSign,
            color: 'text-green-500',
            bg: 'bg-green-500/10',
          },
          {
            label: 'Tickets Vendidos',
            value: (Number(totalTicketsSold) || 0).toLocaleString('es-AR'),
            icon: Ticket,
            color: 'text-orange-500',
            bg: 'bg-orange-500/10',
          },
          {
            label: 'Eventos Activos',
            value: (activeEvents || 0).toString(),
            icon: Calendar,
            color: 'text-blue-500',
            bg: 'bg-blue-500/10',
          },
          {
            label: 'Capacidad Total',
            value: (Number(totalCapacity) || 0).toLocaleString('es-AR'),
            icon: Users,
            color: 'text-purple-500',
            bg: 'bg-purple-500/10',
          },
        ].map((stat, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="bg-white/5 rounded-3xl border border-white/10 p-5"
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold uppercase tracking-widest text-zinc-500">{stat.label}</span>
              <div className={`${stat.bg} p-2 rounded-xl`}>
                <stat.icon className={`w-4 h-4 ${stat.color}`} />
              </div>
            </div>
            <p className="text-2xl font-black">{stat.value}</p>
          </motion.div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div className="flex gap-2">
          <button
            onClick={() => setActiveTab('eventos')}
            className={`flex items-center gap-2 px-5 py-3 rounded-2xl font-bold text-sm transition-all ${
              activeTab === 'eventos'
                ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/20'
                : 'bg-white/5 text-zinc-400 hover:bg-white/10 border border-white/10'
            }`}
          >
            <Calendar className="w-4 h-4" />
            Mis Eventos
          </button>
          <button
            onClick={() => setActiveTab('ventas')}
            className={`flex items-center gap-2 px-5 py-3 rounded-2xl font-bold text-sm transition-all ${
              activeTab === 'ventas'
                ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/20'
                : 'bg-white/5 text-zinc-400 hover:bg-white/10 border border-white/10'
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            Ultimas Ventas
          </button>
        </div>

        {activeTab === 'eventos' && events.length > 0 && (
          <div className="flex flex-col md:flex-row gap-4 items-start md:items-center">
            {/* Search */}
            <div className="relative w-full md:w-64">
              <input
                type="text"
                placeholder="Buscar evento..."
                value={eventSearch}
                onChange={(e) => setEventSearch(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 pl-10 text-sm focus:outline-none focus:border-orange-500/50 transition-all"
              />
              <Search className="w-4 h-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
            </div>

            {/* Time Filter Tabs */}
            <div className="flex bg-white/5 border border-white/10 rounded-2xl p-1 w-full md:w-auto">
              {(['all', 'upcoming', 'past'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setEventTimeFilter(t)}
                  className={`flex-1 md:flex-none px-6 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all ${
                    eventTimeFilter === t
                      ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/20'
                      : 'text-zinc-500 hover:text-white'
                  }`}
                >
                  {t === 'all' ? 'Todos' : t === 'upcoming' ? 'Próximos' : 'Pasados'}
                </button>
              ))}
            </div>
            
            {(eventSearch || eventTimeFilter !== 'all') && (
              <button 
                onClick={() => { setEventSearch(''); setEventTimeFilter('all'); }}
                className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 hover:text-orange-500 transition-colors px-2"
              >
                Limpiar filtros
              </button>
            )}
          </div>
        )}
      </div>

      {/* ==================== EVENTS TAB ==================== */}
      {activeTab === 'eventos' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
          {events.length === 0 ? (
            <div className="text-center py-20 space-y-4">
              <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mx-auto">
                <Calendar className="w-10 h-10 text-zinc-600" />
              </div>
              <h3 className="text-xl font-bold text-zinc-400">No tenes eventos todavia</h3>
              <p className="text-zinc-500 text-sm">Crea tu primer evento y empeza a vender entradas.</p>
              <Link to="/crear-evento">
                <button className="mt-4 bg-gradient-to-r from-orange-500 to-orange-600 text-white font-bold px-6 py-3 rounded-2xl">
                  Crear mi primer evento
                </button>
              </Link>
            </div>
          ) : filteredEvents.length === 0 ? (
            <div className="text-center py-20 space-y-4">
              <p className="text-zinc-500 text-sm">No se encontraron eventos con los filtros aplicados.</p>
              <button 
                onClick={() => { setEventSearch(''); setEventTimeFilter('all'); }}
                className="text-orange-500 font-bold hover:underline text-sm"
              >
                Limpiar filtros
              </button>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {filteredEvents.map((event, index) => {
                const eventOrders = confirmedOrders.filter(o => o.eventId === event.id);
                const eventTicketsSold = eventOrders.reduce((sum, o) => sum + (o.items || []).reduce((s: number, item: any) => s + (Number(item.quantity) || 0), 0), 0);
                const eventRevenue = eventOrders.reduce((sum, o) => sum + (Number(o.total) || 0), 0);
                const totalCap = (event.tickets || []).reduce((s: number, t: any) => s + (Number(t.available) || 0), 0) + eventTicketsSold;
                const soldPercent = totalCap > 0 ? Math.round((eventTicketsSold / totalCap) * 100) : 0;
                const safeSoldPercent = isNaN(soldPercent) ? 0 : soldPercent;

                return (
                  <motion.div
                    key={event.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                  >
                    <div className="bg-white/5 rounded-3xl border border-white/10 overflow-hidden hover:border-orange-500/30 transition-all">
                      {/* Event image */}
                      <div className="h-32 overflow-hidden relative">
                        {event.image ? (
                          <img src={event.image || undefined} alt={event.title} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                        ) : (
                          <div className="w-full h-full bg-gradient-to-br from-orange-500/20 to-orange-600/20 flex items-center justify-center">
                            <Calendar className="w-10 h-10 text-orange-500/50" />
                          </div>
                        )}
                        <span className={`absolute top-3 right-3 text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded-full backdrop-blur-sm ${
                          event.status === 'active' ? 'bg-green-500/20 text-green-400' : 'bg-zinc-500/20 text-zinc-400'
                        }`}>
                          {event.status === 'active' ? 'Activo' : event.status}
                        </span>
                      </div>

                      <div className="p-5 space-y-4">
                        <div>
                          <h3 className="font-bold text-sm truncate">{event.title}</h3>
                          <div className="flex items-center gap-2 mt-1 text-xs text-zinc-400">
                            <Calendar className="w-3 h-3" />
                            <span>{formatDate(event.date)}</span>
                          </div>
                          {event.venue && (
                            <div className="flex items-center gap-2 mt-0.5 text-xs text-zinc-400">
                              <MapPin className="w-3 h-3" />
                              <span>{event.venue}</span>
                            </div>
                          )}
                        </div>

                        {/* Progress bar */}
                        <div>
                          <div className="flex justify-between text-xs mb-1.5">
                            <span className="text-zinc-400">Vendidos: {(Number(eventTicketsSold) || 0)}/{(Number(totalCap) || 0)}</span>
                            <span className="font-bold text-orange-500">{safeSoldPercent}%</span>
                          </div>
                          <div className="w-full h-2 bg-white/5 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-gradient-to-r from-orange-500 to-orange-600 rounded-full transition-all"
                              style={{ width: `${safeSoldPercent}%` }}
                            />
                          </div>
                        </div>

                        {/* Revenue + Action buttons */}
                        <div className="flex items-center justify-between pt-2 border-t border-white/5">
                          <div>
                            <p className="text-xs text-zinc-500">Ingresos</p>
                            <p className="font-black text-transparent bg-clip-text bg-gradient-to-r from-orange-500 to-orange-600">
                              ${(Number(eventRevenue) || 0).toLocaleString('es-AR')}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Link to={`/dashboard/evento/${event.id}`}>
                              <button className="flex items-center gap-1 text-xs text-orange-500 font-bold hover:underline">
                                <Settings className="w-3.5 h-3.5" /> Gestionar
                              </button>
                            </Link>
                          </div>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </motion.div>
      )}

      {/* ==================== SALES TAB ==================== */}
      {activeTab === 'ventas' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
          {recentOrders.length === 0 ? (
            <div className="text-center py-20 space-y-4">
              <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mx-auto">
                <BarChart3 className="w-10 h-10 text-zinc-600" />
              </div>
              <h3 className="text-xl font-bold text-zinc-400">No hay ventas todavia</h3>
              <p className="text-zinc-500 text-sm">Las ventas de tus eventos van a aparecer aca.</p>
            </div>
          ) : (
            recentOrders.map((order, index) => (
              <motion.div
                key={order.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.03 }}
              >
                <div className="bg-white/5 rounded-2xl border border-white/10 p-4 flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-orange-500/20 to-orange-600/20 flex items-center justify-center text-orange-500 font-bold text-sm flex-shrink-0">
                    {order.buyerName?.charAt(0)?.toUpperCase() || '?'}
                  </div>

                  <div className="flex-grow min-w-0">
                    <p className="font-bold text-sm truncate">{order.buyerName}</p>
                    <p className="text-xs text-zinc-400 truncate">{order.eventTitle}</p>
                  </div>

                  <div className="flex-shrink-0 text-right">
                    <p className="font-black text-sm">${order.total?.toLocaleString('es-AR')}</p>
                    <p className="text-[10px] text-zinc-500">{formatShortDate(order.createdAt)}</p>
                  </div>

                  <span className={`flex-shrink-0 text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded-full ${
                    order.status === 'confirmed' ? 'bg-green-500/10 text-green-500' : 'bg-zinc-500/10 text-zinc-500'
                  }`}>
                    {order.status === 'confirmed' ? 'OK' : order.status}
                  </span>
                </div>
              </motion.div>
            ))
          )}
        </motion.div>
      )}
    </div>
  );
}

