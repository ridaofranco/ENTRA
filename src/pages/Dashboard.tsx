import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import {
  Plus, DollarSign, Ticket, Calendar, Users, TrendingUp,
  MapPin, BarChart3, Loader2, Eye, Settings, ChevronRight, Search, Percent, Clock
} from 'lucide-react';
import { collection, query, where, getDocs, doc, getDoc, orderBy, onSnapshot } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { db, auth } from '@/src/lib/firebase';
import { useAuth } from '@/src/context/AuthContext';
import { formatCurrency } from '@/src/lib/utils';
import { estadoOrden } from '@/src/lib/estados';

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
  createdAt?: any;
  isDateTBD?: boolean;
  isTimeTBD?: boolean;
  isVenueTBD?: boolean;
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
  const [activeTab, setActiveTab] = useState<'eventos' | 'ventas' | 'comisiones'>('eventos');
  const { profile } = useAuth();
  const isSuperAdmin =
    profile?.role === 'superadmin' || user?.email === 'ridaofrancorg@gmail.com';
  const [eventSearch, setEventSearch] = useState('');
  const [eventTimeFilter, setEventTimeFilter] = useState<'all' | 'upcoming' | 'past'>('all');

  // --- Conexión de MercadoPago (cobro con split / marketplace) ---
  const [mpConnected, setMpConnected] = useState<boolean | null>(null);
  const [mpConnecting, setMpConnecting] = useState(false);
  const [mpBanner, setMpBanner] = useState<{ type: 'ok' | 'error'; text: string } | null>(null);

  // Lee el estado de conexión (SIN secretos) del productor
  useEffect(() => {
    if (!user?.uid) return;
    getDoc(doc(db, 'mp_connections', user.uid))
      .then((snap) => setMpConnected(snap.exists() && snap.data()?.connected === true))
      .catch(() => setMpConnected(false));
  }, [user]);

  // Muestra el resultado al volver del OAuth (?mp=connected | ?mp=error)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const mp = params.get('mp');
    if (mp === 'connected') {
      setMpBanner({ type: 'ok', text: '¡MercadoPago conectado! Tus ventas van a entrar directo a tu cuenta.' });
      setMpConnected(true);
      window.history.replaceState({}, '', '/dashboard');
    } else if (mp === 'error') {
      setMpBanner({ type: 'error', text: 'No se pudo conectar MercadoPago. Probá de nuevo en un momento.' });
      window.history.replaceState({}, '', '/dashboard');
    }
  }, []);

  const handleConnectMP = async () => {
    if (!user) return;
    setMpConnecting(true);
    setMpBanner(null);
    try {
      const idToken = await user.getIdToken();
      const resp = await fetch('/api/mp-oauth-start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken }),
      });
      const data = await resp.json().catch(() => null);
      if (!resp.ok || !data?.url) {
        setMpBanner({ type: 'error', text: data?.error || 'No se pudo iniciar la conexión con MercadoPago.' });
        setMpConnecting(false);
        return;
      }
      window.location.href = data.url;
    } catch {
      setMpBanner({ type: 'error', text: 'No se pudo iniciar la conexión con MercadoPago.' });
      setMpConnecting(false);
    }
  };

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

  // Sync data with real-time listeners
  useEffect(() => {
    if (!user) return;
    
    setLoading(true);
    const isSuperAdmin = profile?.role === 'superadmin' || profile?.role === 'admin' || user.email === 'ridaofrancorg@gmail.com';
    
    let eventsQuery;
    if (isSuperAdmin) {
      eventsQuery = query(collection(db, 'events'));
    } else {
      eventsQuery = query(collection(db, 'events'), where('organizerEmail', '==', user.email));
    }

    const unsubEvents = onSnapshot(eventsQuery, (snap) => {
      let eventsList: EventData[] = snap.docs.map(d => ({ id: d.id, ...(d.data() as any) } as EventData));
      
      // Sort in memory to avoid index requirements
      eventsList.sort((a, b) => {
        const aTime = a.createdAt?.seconds || 0;
        const bTime = b.createdAt?.seconds || 0;
        return bTime - aTime;
      });

      setEvents(eventsList);
      setLoading(false);

      // Trigger orders fetch when events change
      if (eventsList.length > 0) {
        loadOrders(eventsList.map(e => e.id));
      } else {
        setAllOrders([]);
        setRecentOrders([]);
      }
    }, (error) => {
      console.error('Events sync error:', error);
      setLoading(false);
    });

    return () => unsubEvents();
  }, [user, profile]);

  const loadOrders = async (eventIds: string[]) => {
    try {
      // Firestore permite hasta 30 valores en 'in'. Paginamos en tandas de 30 para no
      // perder órdenes de organizadores con más de 30 eventos (antes cortaba a 30).
      const chunks: string[][] = [];
      for (let i = 0; i < eventIds.length; i += 30) chunks.push(eventIds.slice(i, i + 30));
      const snaps = await Promise.all(
        chunks.map((batchIds) => getDocs(query(collection(db, 'orders'), where('eventId', 'in', batchIds))))
      );
      const ordersList: OrderData[] = snaps.flatMap((snap) => snap.docs.map(d => ({ id: d.id, ...d.data() } as OrderData)));

      ordersList.sort((a, b) => {
        const aTime = a.createdAt?.seconds || 0;
        const bTime = b.createdAt?.seconds || 0;
        return bTime - aTime;
      });

      setAllOrders(ordersList);
      setRecentOrders(ordersList.slice(0, 20));
    } catch (error) {
      console.error('Orders load error:', error);
    }
  };

  // ==================== COMPUTED STATS ====================
  // Fuente de verdad: el documento del evento. event.ticketsSold y event.totalRevenue
  // se actualizan en tiempo real por Checkout (suma) y por EventDashboard handleRefundTicket (resta).
  // Esto es lo que asegura que refund/venta/nuevo evento refresquen el dashboard automáticamente.
  const confirmedOrders = allOrders.filter(o => o.status === 'confirmed');

  const totalRevenue = events.reduce(
    (sum, e: any) => sum + (Number(e.totalRevenue) || 0),
    0
  );
  const totalTicketsSold = events.reduce(
    (sum, e: any) => sum + (Number(e.ticketsSold) || 0),
    0
  );
  const totalCommissions = confirmedOrders.reduce(
    (sum, o: any) => sum + (Number(o.fee) || 0),
    0
  );
  const commissionsByEvent = events.map((ev: any) => {
    const evOrders = confirmedOrders.filter(o => o.eventId === ev.id);
    const commission = evOrders.reduce((s, o: any) => s + (Number(o.fee) || 0), 0);
    const net = Number(ev.totalRevenue) || 0;
    const sales = evOrders.length;
    return { id: ev.id, title: ev.title, commission, net, sales };
  }).filter(x => x.commission > 0).sort((a, b) => b.commission - a.commission);

  const activeEvents = events.filter(e => e.status === 'active').length;
  // La capacidad incluye lo disponible + lo ya vendido (neto de refunds, porque
  // event.ticketsSold se decrementa en el refund y tickets[].available se restaura)
  const totalCapacity = events.reduce((sum, e: any) => {
    const cap = (e.tickets || []).reduce((s: number, t: any) => s + (Number(t.available) || 0), 0);
    return sum + cap + (Number(e.ticketsSold) || 0);
  }, 0);

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

    // Los eventos eliminados NO se muestran en el dashboard (ensuciaban la vista).
    const notDeleted = e.status !== 'deleted' && e.status !== 'cancelled' && !e.deletedAt;

    return matchesTime && matchesSearch && notDeleted;
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

  const hasPendingEvents = isSuperAdmin && events.some(e => e.status === 'pending');

  // Los eventos del PRODUCTOR que están esperando aprobación. Hasta acá su único
  // indicio era una etiqueta chiquita que decía "Pendiente" al lado del evento,
  // que no explica nada: ni qué significa, ni cuánto tarda, ni si tiene que
  // hacer algo. El que carga un evento a la noche y no ve señales asume que algo
  // salió mal y termina escribiendo por WhatsApp, que es justo lo que queremos
  // sacar del medio.
  const misEventosEnRevision = !isSuperAdmin ? events.filter(e => e.status === 'pending') : [];

  // ==================== RENDER ====================
  return (
    <div className="pt-32 pb-20 px-6 max-w-6xl mx-auto space-y-6">
      {/* Al productor: sus eventos en revisión, explicado */}
      {misEventosEnRevision.length > 0 && (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
          <div className="bg-orange-500/10 border border-orange-500/30 rounded-2xl p-5 flex items-start gap-4">
            <div className="w-10 h-10 bg-orange-500/20 text-orange-500 rounded-xl flex items-center justify-center shrink-0">
              <Clock className="w-5 h-5" />
            </div>
            <div className="space-y-1">
              <p className="text-orange-400 font-bold text-sm">
                {misEventosEnRevision.length === 1
                  ? 'Tu evento está en revisión'
                  : `Tenés ${misEventosEnRevision.length} eventos en revisión`}
              </p>
              <p className="text-orange-400/70 text-xs leading-relaxed">
                {misEventosEnRevision.length === 1 ? 'Lo revisamos' : 'Los revisamos'} a mano antes de publicar
                {misEventosEnRevision.length === 1 ? 'lo' : 'los'}, normalmente el mismo día. Te avisamos por mail
                apenas {misEventosEnRevision.length === 1 ? 'esté' : 'estén'} a la venta. No tenés que hacer nada más.
              </p>
              <p className="text-orange-400/50 text-[11px] pt-1">
                Mientras tanto podés seguir editándolo: los cambios se revisan junto con el evento.
              </p>
            </div>
          </div>
        </motion.div>
      )}

      {/* Admin Pending Alert */}
      {hasPendingEvents && (
        <motion.div 
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          className="overflow-hidden"
        >
          <Link to="/admin/dashboard" className="block">
            <div className="bg-orange-500/10 border border-orange-500/30 rounded-2xl p-4 flex items-center justify-between group hover:bg-orange-500/20 transition-all cursor-pointer">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-orange-500/20 text-orange-500 rounded-xl flex items-center justify-center animate-pulse">
                  <Clock className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-orange-400 font-bold text-sm">Eventos pendientes de revisión</p>
                  <p className="text-orange-400/60 text-xs">Tenés {events.filter(e => e.status === 'pending').length} eventos esperando aprobación.</p>
                </div>
              </div>
              <div className="flex items-center gap-2 text-orange-400 font-bold text-[10px] uppercase tracking-widest group-hover:translate-x-1 transition-transform">
                Ir al Panel Admin
              </div>
            </div>
          </Link>
        </motion.div>
      )}

      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between mb-10">
        <div>
          <h1 className="text-3xl font-black tracking-tight">Dashboard</h1>
          <p className="text-zinc-400 mt-1">Gestion de tus eventos y ventas</p>
        </div>
        <Link to="/crear-evento">
          <button className="flex items-center gap-2 orange-gradient text-white font-heading font-black px-5 py-3 rounded-xl hover:brightness-110 transition-all">
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
            value: formatCurrency(Number(totalRevenue) || 0),
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

      {/* Conexión de MercadoPago — cobro con split para el productor */}
      <div className="mb-6">
        {mpBanner && (
          <div className={`mb-3 rounded-2xl px-4 py-3 text-sm font-semibold border ${mpBanner.type === 'ok' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-red-500/10 text-red-400 border-red-500/20'}`}>
            {mpBanner.text}
          </div>
        )}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/5 px-5 py-4">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${mpConnected ? 'bg-emerald-500/15 text-emerald-400' : 'bg-orange-500/15 text-orange-400'}`}>
              <DollarSign className="w-5 h-5" />
            </div>
            <div>
              <p className="font-bold text-sm">
                {mpConnected ? 'MercadoPago conectado' : 'Cobrá tus ventas directo a tu MercadoPago'}
              </p>
              <p className="text-xs text-zinc-400">
                {mpConnected
                  ? 'La plata de tus entradas entra directo a tu cuenta; ENTRÁ retiene solo su comisión.'
                  : 'Conectá tu cuenta y cobrá directo, con la comisión de ENTRÁ descontada automáticamente.'}
              </p>
            </div>
          </div>
          {mpConnected ? (
            <span className="inline-flex items-center gap-2 text-xs font-bold text-emerald-400 uppercase tracking-widest shrink-0">
              ✓ Conectado
            </span>
          ) : (
            <button
              onClick={handleConnectMP}
              disabled={mpConnecting}
              className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl font-bold text-sm bg-orange-500 text-white hover:bg-orange-600 transition-all disabled:opacity-60 shrink-0"
            >
              {mpConnecting ? <Loader2 className="w-4 h-4 animate-spin" /> : <DollarSign className="w-4 h-4" />}
              Conectar MercadoPago
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div className="flex gap-2">
          <button
            onClick={() => setActiveTab('eventos')}
            className={`flex items-center gap-2 px-5 py-3 rounded-2xl font-bold text-sm transition-all ${
              activeTab === 'eventos'
                ? 'bg-orange-500 text-white'
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
                ? 'bg-orange-500 text-white'
                : 'bg-white/5 text-zinc-400 hover:bg-white/10 border border-white/10'
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            Ultimas Ventas
          </button>
          {isSuperAdmin && (
            <button
              onClick={() => setActiveTab('comisiones')}
              className={`flex items-center gap-2 px-5 py-3 rounded-2xl font-bold text-sm transition-all ${
                activeTab === 'comisiones'
                  ? 'bg-orange-500 text-white'
                  : 'bg-white/5 text-zinc-400 hover:bg-white/10 border border-white/10'
              }`}
            >
              <Percent className="w-4 h-4" />
              Mis Comisiones
            </button>
          )}
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
                      ? 'bg-orange-500 text-white'
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
                <button className="mt-4 orange-gradient text-white font-heading font-black px-6 py-3 rounded-xl hover:brightness-110 transition-all">
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
              {filteredEvents.map((event: any, index) => {
                // Fuente de verdad: event.ticketsSold y event.totalRevenue.
                // Así refund y venta se reflejan al instante sin depender de recomputar orders.
                const eventTicketsSold = Number(event.ticketsSold) || 0;
                const eventRevenue = Number(event.totalRevenue) || 0;
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
                          <div className="w-full h-full bg-white/[0.03] flex items-center justify-center">
                            <Calendar className="w-10 h-10 text-white/10" />
                          </div>
                        )}
                        <span className={`absolute top-3 right-3 text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded-full backdrop-blur-sm border ${
                          event.status === 'active' || event.status === 'published' ? 'bg-green-500/20 text-green-400 border-green-500/30' :
                          event.status === 'pending' ? 'bg-orange-500/20 text-orange-400 border-orange-500/30' :
                          'bg-zinc-500/20 text-zinc-400 border-zinc-500/30'
                        }`}>
                          {event.status === 'active' || event.status === 'published' ? 'Activo' :
                           event.status === 'pending' ? 'Pendiente' :
                           event.status === 'paused' ? 'Pausado' :
                           event.status === 'draft' ? 'Borrador' :
                           event.status}
                        </span>
                      </div>

                      <div className="p-5 space-y-4">
                        <div>
                          <h3 className="font-bold text-sm truncate">{event.title}</h3>
                          <div className="flex items-center gap-2 mt-1 text-xs text-zinc-400">
                            <Calendar className="w-3 h-3" />
                            <span>{event.isDateTBD ? "PROXIMAMENTE" : formatDate(event.date)}</span>
                          </div>
                          {(event.venue || event.isVenueTBD) && (
                            <div className="flex items-center gap-2 mt-0.5 text-xs text-zinc-400">
                              <MapPin className="w-3 h-3" />
                              <span>{event.isVenueTBD ? "LUGAR POR CONFIRMAR" : event.venue}</span>
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
                              className="h-full orange-gradient rounded-full transition-all"
                              style={{ width: `${safeSoldPercent}%` }}
                            />
                          </div>
                        </div>

                        {/* Revenue + Action buttons */}
                        <div className="flex items-center justify-between pt-2 border-t border-white/5">
                          <div>
                            <p className="text-xs text-zinc-500">Ingresos</p>
                            <p className="font-black text-orange-500">
                               {formatCurrency(Number(eventRevenue) || 0)}
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
                    <p className="font-black text-sm">{formatCurrency(order.total || 0)}</p>
                    <p className="text-[10px] text-zinc-500">{formatShortDate(order.createdAt)}</p>
                  </div>

                  <span className={`flex-shrink-0 text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded-full ${
                    order.status === 'confirmed' ? 'bg-green-500/10 text-green-500' : 'bg-zinc-500/10 text-zinc-500'
                  }`}>
                    {estadoOrden(order.status)}
                  </span>
                </div>
              </motion.div>
            ))
          )}
        </motion.div>
      )}

      {/* ==================== MIS COMISIONES TAB (SUPERADMIN ONLY) ==================== */}
      {activeTab === 'comisiones' && isSuperAdmin && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
          {/* Total card */}
          <div className="bg-gradient-to-br from-orange-500/10 to-orange-600/5 border border-orange-500/20 rounded-3xl p-6">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold uppercase tracking-widest text-orange-400">Comisiones totales ENTRÁ</span>
              <div className="bg-orange-500/20 p-2 rounded-xl">
                <Percent className="w-4 h-4 text-orange-500" />
              </div>
            </div>
            <p className="text-4xl font-black text-orange-500">
              {formatCurrency(totalCommissions || 0)}
            </p>
            <p className="text-xs text-zinc-500 mt-2">
              Total acumulado por comisiones sobre ventas confirmadas. Los refunds NO devuelven la comisión — ENTRÁ se la queda.
            </p>
          </div>

          {/* Per-event breakdown */}
          {commissionsByEvent.length === 0 ? (
            <div className="text-center py-20 space-y-4">
              <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mx-auto">
                <Percent className="w-10 h-10 text-zinc-600" />
              </div>
              <h3 className="text-xl font-bold text-zinc-400">Todavía no hay comisiones</h3>
              <p className="text-zinc-500 text-sm">Cuando se empiecen a vender entradas, las comisiones van a aparecer acá.</p>
            </div>
          ) : (
            <div className="bg-white/5 rounded-3xl border border-white/10 overflow-hidden">
              <div className="p-5 border-b border-white/10">
                <h3 className="font-black text-lg">Comisiones por evento</h3>
                <p className="text-xs text-zinc-500 mt-0.5">Ordenado de mayor a menor comisión ganada</p>
              </div>
              <div className="divide-y divide-white/5">
                {commissionsByEvent.map((row) => (
                  <div key={row.id} className="p-5 flex items-center justify-between gap-4 hover:bg-white/5 transition-all">
                    <div className="min-w-0 flex-grow">
                      <p className="font-bold text-sm truncate">{row.title}</p>
                      <p className="text-xs text-zinc-500 mt-0.5">
                        {row.sales} venta{row.sales === 1 ? '' : 's'} · Neto organizador: {formatCurrency(row.net || 0)}
                      </p>
                    </div>
                    <div className="flex-shrink-0 text-right">
                      <p className="text-xs text-zinc-500">Comisión ENTRÁ</p>
                      <p className="font-black text-orange-500">
                        {formatCurrency(row.commission || 0)}
                      </p>
                    </div>
                    <Link to={`/dashboard/evento/${row.id}`}>
                      <button className="text-orange-500 hover:text-orange-400">
                        <ChevronRight className="w-5 h-5" />
                      </button>
                    </Link>
                  </div>
                ))}
              </div>
            </div>
          )}
        </motion.div>
      )}
    </div>
  );
}

