import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import {
  User, Ticket, LogOut, Calendar, MapPin, QrCode, Download,
  ChevronRight, Copy, CheckCircle2, ShieldCheck, Loader2, Clock
} from 'lucide-react';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { signOut, onAuthStateChanged } from 'firebase/auth';
import { db, auth } from '@/src/lib/firebase';

// ============================================================
// QR CODE GENERATOR (same as Checkout)
// ============================================================
function generateQRCodeSVG(text: string, size: number = 200): string {
  const modules = 25;
  const cellSize = size / modules;

  function hashCode(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash);
  }

  function seededRandom(seed: number): () => number {
    let s = seed;
    return () => {
      s = (s * 16807 + 0) % 2147483647;
      return s / 2147483647;
    };
  }

  const hash = hashCode(text);
  const rand = seededRandom(hash);
  const matrix: boolean[][] = Array(modules).fill(null).map(() => Array(modules).fill(false));

  function addFinderPattern(row: number, col: number) {
    for (let r = 0; r < 7; r++) {
      for (let c = 0; c < 7; c++) {
        if (r === 0 || r === 6 || c === 0 || c === 6 || (r >= 2 && r <= 4 && c >= 2 && c <= 4)) {
          if (row + r < modules && col + c < modules) matrix[row + r][col + c] = true;
        }
      }
    }
  }

  addFinderPattern(0, 0);
  addFinderPattern(0, modules - 7);
  addFinderPattern(modules - 7, 0);

  for (let i = 8; i < modules - 8; i++) {
    matrix[6][i] = i % 2 === 0;
    matrix[i][6] = i % 2 === 0;
  }

  const ap = modules - 9;
  for (let r = ap; r < ap + 5; r++) {
    for (let c = ap; c < ap + 5; c++) {
      if (r < modules && c < modules) {
        if (r === ap || r === ap + 4 || c === ap || c === ap + 4 || (r === ap + 2 && c === ap + 2)) {
          matrix[r][c] = true;
        }
      }
    }
  }

  for (let r = 0; r < modules; r++) {
    for (let c = 0; c < modules; c++) {
      const inFinderTL = r < 8 && c < 8;
      const inFinderTR = r < 8 && c >= modules - 8;
      const inFinderBL = r >= modules - 8 && c < 8;
      const inTiming = r === 6 || c === 6;
      const inAlignment = r >= ap && r < ap + 5 && c >= ap && c < ap + 5;
      if (!inFinderTL && !inFinderTR && !inFinderBL && !inTiming && !inAlignment) {
        matrix[r][c] = rand() > 0.5;
      }
    }
  }

  let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">`;
  svg += `<rect width="${size}" height="${size}" fill="white"/>`;
  for (let r = 0; r < modules; r++) {
    for (let c = 0; c < modules; c++) {
      if (matrix[r][c]) {
        svg += `<rect x="${c * cellSize}" y="${r * cellSize}" width="${cellSize}" height="${cellSize}" fill="#09090B"/>`;
      }
    }
  }
  svg += '</svg>';
  return `data:image/svg+xml;base64,${btoa(svg)}`;
}

// ============================================================

interface TicketData {
  id: string;
  orderId: string;
  eventId: string;
  eventTitle: string;
  ticketType: string;
  price: number;
  status: string;
  qrCode: string;
  createdAt: any;
  buyerName: string;
  buyerEmail: string;
}

interface OrderData {
  id: string;
  eventId: string;
  eventTitle: string;
  items: Array<{ type: string; quantity: number; price: number }>;
  total: number;
  status: string;
  createdAt: any;
}

interface EventCache {
  [key: string]: { date: any; venue: string; location: string; image: string };
}

export default function Profile() {
  const navigate = useNavigate();

  const [user, setUser] = useState<any>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [activeTab, setActiveTab] = useState<'tickets' | 'orders'>('tickets');
  const [tickets, setTickets] = useState<TicketData[]>([]);
  const [orders, setOrders] = useState<OrderData[]>([]);
  const [eventCache, setEventCache] = useState<EventCache>({});
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState<string | null>(null);
  const [expandedTicket, setExpandedTicket] = useState<string | null>(null);

  // Listen to auth state directly from Firebase (no context dependency)
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      if (firebaseUser) {
        setUser(firebaseUser);
      } else {
        navigate('/auth/login');
      }
      setAuthChecked(true);
    });
    return () => unsubscribe();
  }, [navigate]);

  useEffect(() => {
    if (user) loadUserData();
  }, [user]);

  const loadUserData = async () => {
    if (!user) return;
    setLoading(true);
    try {
      // Load tickets for this user
      const ticketsQuery = query(
        collection(db, 'tickets'),
        where('buyerEmail', '==', user.email)
      );
      const ticketsSnap = await getDocs(ticketsQuery);
      const ticketsList: TicketData[] = ticketsSnap.docs.map(d => ({ id: d.id, ...(d.data() as any) } as TicketData));

      // Sort by createdAt descending (newest first)
      ticketsList.sort((a, b) => {
        const aTime = a.createdAt?.seconds || 0;
        const bTime = b.createdAt?.seconds || 0;
        return bTime - aTime;
      });

      setTickets(ticketsList);

      // Load orders for this user
      const ordersQuery = query(
        collection(db, 'orders'),
        where('buyerEmail', '==', user.email)
      );
      const ordersSnap = await getDocs(ordersQuery);
      const ordersList: OrderData[] = ordersSnap.docs.map(d => ({ id: d.id, ...(d.data() as any) } as OrderData));

      ordersList.sort((a, b) => {
        const aTime = a.createdAt?.seconds || 0;
        const bTime = b.createdAt?.seconds || 0;
        return bTime - aTime;
      });

      setOrders(ordersList);

      // Load event info for each unique eventId
      const eventIds = [...new Set([...ticketsList.map(t => t.eventId), ...ordersList.map(o => o.eventId)])];
      const cache: EventCache = {};
      for (const eid of eventIds) {
        try {
          const eventSnap = await getDoc(doc(db, 'events', eid));
          if (eventSnap.exists()) {
            const data = eventSnap.data();
            cache[eid] = {
              date: data.date,
              venue: data.venue || '',
              location: data.location || '',
              image: data.image || '',
            };
          }
        } catch { }
      }
      setEventCache(cache);
    } catch (error) {
      console.error('Error loading user data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(text);
    setTimeout(() => setCopied(null), 2000);
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      navigate('/');
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const formatDate = (date: any) => {
    try {
      if (date?.toDate) return date.toDate().toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
      if (date?.seconds) return new Date(date.seconds * 1000).toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
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

  const isUpcoming = (eventId: string) => {
    const ev = eventCache[eventId];
    if (!ev?.date) return true;
    try {
      const eventDate = ev.date?.toDate ? ev.date.toDate() : new Date(ev.date.seconds * 1000);
      return eventDate > new Date();
    } catch { return true; }
  };

  if (!authChecked || !user) return null;

  // ==================== LOADING STATE ====================
  if (loading) {
    return (
      <div className="pt-32 pb-20 px-6 max-w-4xl mx-auto flex flex-col items-center justify-center min-h-[60vh]">
        <Loader2 className="w-10 h-10 text-orange-500 animate-spin mb-4" />
        <p className="text-zinc-400">Cargando tu perfil...</p>
      </div>
    );
  }

  // ==================== RENDER ====================
  return (
    <div className="pt-32 pb-20 px-6 max-w-4xl mx-auto">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-10">
        <div className="flex items-center gap-6">
          <div className="w-20 h-20 rounded-full bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center text-white text-3xl font-black shadow-lg shadow-orange-500/20">
            {user.displayName ? user.displayName.charAt(0).toUpperCase() : user.email?.charAt(0).toUpperCase()}
          </div>
          <div className="flex-grow">
            <h1 className="text-3xl font-black tracking-tight">{user.displayName || 'Usuario'}</h1>
            <p className="text-zinc-400 mt-1">{user.email}</p>
            <div className="flex items-center gap-4 mt-3">
              <span className="text-xs font-bold uppercase tracking-widest text-zinc-500 bg-white/5 px-3 py-1 rounded-full border border-white/10">
                {tickets.length} {tickets.length === 1 ? 'ticket' : 'tickets'}
              </span>
              <span className="text-xs font-bold uppercase tracking-widest text-zinc-500 bg-white/5 px-3 py-1 rounded-full border border-white/10">
                {orders.length} {orders.length === 1 ? 'compra' : 'compras'}
              </span>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 text-sm text-zinc-400 hover:text-red-400 px-4 py-2 rounded-xl hover:bg-red-500/10 transition-all"
          >
            <LogOut className="w-4 h-4" />
            <span className="hidden sm:inline">Cerrar sesion</span>
          </button>
        </div>
      </motion.div>

      {/* Tabs */}
      <div className="flex gap-2 mb-8">
        <button
          onClick={() => setActiveTab('tickets')}
          className={`flex items-center gap-2 px-5 py-3 rounded-2xl font-bold text-sm transition-all ${
            activeTab === 'tickets'
              ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/20'
              : 'bg-white/5 text-zinc-400 hover:bg-white/10 border border-white/10'
          }`}
        >
          <QrCode className="w-4 h-4" />
          Mis Tickets
        </button>
        <button
          onClick={() => setActiveTab('orders')}
          className={`flex items-center gap-2 px-5 py-3 rounded-2xl font-bold text-sm transition-all ${
            activeTab === 'orders'
              ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/20'
              : 'bg-white/5 text-zinc-400 hover:bg-white/10 border border-white/10'
          }`}
        >
          <Ticket className="w-4 h-4" />
          Mis Compras
        </button>
      </div>

      {/* ==================== TICKETS TAB ==================== */}
      {activeTab === 'tickets' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
          {tickets.length === 0 ? (
            <div className="text-center py-20 space-y-4">
              <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mx-auto">
                <Ticket className="w-10 h-10 text-zinc-600" />
              </div>
              <h3 className="text-xl font-bold text-zinc-400">No tenes tickets todavia</h3>
              <p className="text-zinc-500 text-sm">Cuando compres entradas, van a aparecer aca con su codigo QR.</p>
              <Link to="/eventos">
                <button className="mt-4 bg-gradient-to-r from-orange-500 to-orange-600 text-white font-bold px-6 py-3 rounded-2xl hover:from-orange-600 hover:to-orange-700 transition-all">
                  Explorar Eventos
                </button>
              </Link>
            </div>
          ) : (
            tickets.map((ticket, index) => {
              const ev = eventCache[ticket.eventId];
              const upcoming = isUpcoming(ticket.eventId);
              const isExpanded = expandedTicket === ticket.id;

              return (
                <motion.div
                  key={ticket.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                >
                  <div className={`bg-white/5 rounded-3xl border border-white/10 overflow-hidden transition-all ${!upcoming ? 'opacity-60' : ''}`}>
                    {/* Ticket header — always visible */}
                    <button
                      onClick={() => setExpandedTicket(isExpanded ? null : ticket.id)}
                      className="w-full p-5 flex items-center gap-4 text-left hover:bg-white/[0.02] transition-colors"
                    >
                      {/* Event image */}
                      <div className="w-14 h-14 rounded-2xl overflow-hidden flex-shrink-0 bg-white/5">
                        {ev?.image ? (
                          <img src={ev.image || null} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center"><Ticket className="w-6 h-6 text-zinc-600" /></div>
                        )}
                      </div>

                      <div className="flex-grow min-w-0">
                        <h3 className="font-bold text-sm truncate">{ticket.eventTitle}</h3>
                        <div className="flex items-center gap-3 mt-1 text-xs text-zinc-400">
                          <span className="font-bold text-orange-500">{ticket.ticketType}</span>
                          {ev?.venue && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{ev.venue}</span>}
                          {ev?.date && <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{formatShortDate(ev.date)}</span>}
                        </div>
                      </div>

                      <div className="flex items-center gap-3 flex-shrink-0">
                        <span className={`text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded-full ${
                          ticket.status === 'valid'
                            ? 'bg-green-500/10 text-green-500'
                            : ticket.status === 'used'
                            ? 'bg-zinc-500/10 text-zinc-500'
                            : 'bg-red-500/10 text-red-500'
                        }`}>
                          {ticket.status === 'valid' ? 'Valido' : ticket.status === 'used' ? 'Usado' : 'Cancelado'}
                        </span>
                        <ChevronRight className={`w-4 h-4 text-zinc-500 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                      </div>
                    </button>

                    {/* Expanded: QR + details */}
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        className="border-t border-white/10"
                      >
                        <div className="p-6 flex flex-col sm:flex-row items-center gap-6">
                          {/* QR Code */}
                          <div className="bg-white rounded-2xl p-4 flex-shrink-0 shadow-lg">
                            <img src={generateQRCodeSVG(ticket.qrCode, 160)} alt="QR" className="w-[140px] h-[140px]" />
                          </div>
                          <div className="flex-grow text-center sm:text-left space-y-3">
                            <div>
                              <p className="text-xs uppercase tracking-widest text-zinc-400 font-bold">Codigo</p>
                              <div className="flex items-center gap-2 justify-center sm:justify-start mt-1">
                                <code className="text-sm font-mono bg-white/5 px-3 py-1.5 rounded-lg border border-white/10">{ticket.qrCode}</code>
                                <button onClick={() => handleCopy(ticket.qrCode)} className="hover:bg-white/10 p-2 rounded-lg transition-colors">
                                  {copied === ticket.qrCode ? <CheckCircle2 className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4 text-zinc-400" />}
                                </button>
                              </div>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <p className="text-xs uppercase tracking-widest text-zinc-500 font-bold">Tipo</p>
                                <p className="font-bold text-orange-500">{ticket.ticketType}</p>
                              </div>
                              <div>
                                <p className="text-xs uppercase tracking-widest text-zinc-500 font-bold">Precio</p>
                                <p className="font-bold">${ticket.price?.toLocaleString('es-AR')}</p>
                              </div>
                            </div>
                            {ev?.date && (
                              <div>
                                <p className="text-xs uppercase tracking-widest text-zinc-500 font-bold">Fecha</p>
                                <p className="text-sm">{formatDate(ev.date)}</p>
                              </div>
                            )}
                            {ev?.venue && (
                              <div>
                                <p className="text-xs uppercase tracking-widest text-zinc-500 font-bold">Lugar</p>
                                <p className="text-sm">{ev.venue}{ev.location ? `, ${ev.location}` : ''}</p>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Footer */}
                        <div className="border-t border-dashed border-white/10 px-6 py-3 flex justify-between items-center text-xs">
                          <span className="text-zinc-500 flex items-center gap-1.5">
                            <Clock className="w-3.5 h-3.5" />
                            Comprado {formatDate(ticket.createdAt)}
                          </span>
                          <span className={`flex items-center gap-1.5 font-bold ${ticket.status === 'valid' ? 'text-green-500' : 'text-zinc-500'}`}>
                            <ShieldCheck className="w-3.5 h-3.5" />
                            {ticket.status === 'valid' ? 'VALIDO' : ticket.status === 'used' ? 'USADO' : 'CANCELADO'}
                          </span>
                        </div>
                      </motion.div>
                    )}
                  </div>
                </motion.div>
              );
            })
          )}
        </motion.div>
      )}

      {/* ==================== ORDERS TAB ==================== */}
      {activeTab === 'orders' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
          {orders.length === 0 ? (
            <div className="text-center py-20 space-y-4">
              <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mx-auto">
                <Ticket className="w-10 h-10 text-zinc-600" />
              </div>
              <h3 className="text-xl font-bold text-zinc-400">No tenes compras todavia</h3>
              <p className="text-zinc-500 text-sm">Tu historial de compras va a aparecer aca.</p>
              <Link to="/eventos">
                <button className="mt-4 bg-gradient-to-r from-orange-500 to-orange-600 text-white font-bold px-6 py-3 rounded-2xl hover:from-orange-600 hover:to-orange-700 transition-all">
                  Explorar Eventos
                </button>
              </Link>
            </div>
          ) : (
            orders.map((order, index) => {
              const ev = eventCache[order.eventId];
              const totalItems = order.items?.reduce((a: number, t: any) => a + (t.quantity || 0), 0) || 0;

              return (
                <motion.div
                  key={order.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                >
                  <div className="bg-white/5 rounded-3xl border border-white/10 p-5">
                    <div className="flex items-center gap-4">
                      {/* Event image */}
                      <div className="w-14 h-14 rounded-2xl overflow-hidden flex-shrink-0 bg-white/5">
                        {ev?.image ? (
                          <img src={ev.image || null} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center"><Ticket className="w-6 h-6 text-zinc-600" /></div>
                        )}
                      </div>

                      <div className="flex-grow min-w-0">
                        <h3 className="font-bold text-sm truncate">{order.eventTitle}</h3>
                        <div className="flex items-center gap-3 mt-1 text-xs text-zinc-400">
                          <span>{totalItems} {totalItems === 1 ? 'entrada' : 'entradas'}</span>
                          <span className="text-zinc-600">•</span>
                          <span>{formatShortDate(order.createdAt)}</span>
                        </div>
                      </div>

                      <div className="text-right flex-shrink-0">
                        <p className="text-lg font-black text-transparent bg-clip-text bg-gradient-to-r from-orange-500 to-orange-600">
                          ${order.total?.toLocaleString('es-AR')}
                        </p>
                        <span className={`text-[10px] font-bold uppercase tracking-widest ${
                          order.status === 'confirmed' ? 'text-green-500' : 'text-zinc-500'
                        }`}>
                          {order.status === 'confirmed' ? 'Confirmada' : order.status}
                        </span>
                      </div>
                    </div>

                    {/* Order items detail */}
                    {order.items && order.items.length > 0 && (
                      <div className="mt-4 pt-4 border-t border-white/5 space-y-1">
                        {order.items.map((item: any, i: number) => (
                          <div key={i} className="flex justify-between text-xs text-zinc-400">
                            <span>{item.quantity}x {item.type}</span>
                            <span>${((item.quantity || 0) * (item.price || 0)).toLocaleString('es-AR')}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="mt-4 pt-3 border-t border-white/5 flex justify-between items-center">
                      <span className="text-xs text-zinc-600 font-mono">#{order.id.substring(0, 8).toUpperCase()}</span>
                      <Link to="/eventos">
                        <button className="text-xs text-orange-500 font-bold hover:underline">Ver evento</button>
                      </Link>
                    </div>
                  </div>
                </motion.div>
              );
            })
          )}
        </motion.div>
      )}
    </div>
  );
}
