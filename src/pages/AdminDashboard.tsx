import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Users, Calendar, Ticket, TrendingUp, Loader, ChevronDown,
  Edit3, Trash2, RotateCcw, Eye, X, Plus, AlertTriangle, BarChart3, Search
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/src/context/AuthContext';
import { db } from '@/src/lib/firebase';
import { collection, getDocs, doc, updateDoc, Timestamp, onSnapshot } from 'firebase/firestore';
import { Card } from '@/src/components/ui/card';
import { Button } from '@/src/components/ui/button';
import { Input } from '@/src/components/ui/input';
import { handleFirestoreError, OperationType } from '@/src/lib/firebase';

interface UserData {
  id: string;
  email: string;
  displayName: string;
  role: 'buyer' | 'organizer' | 'admin' | 'superadmin';
  createdAt: any;
  suspended?: boolean;
}

interface TicketType {
  type: string;
  price: number;
  available: number;
}

interface EventData {
  id: string;
  title: string;
  description?: string;
  organizerEmail?: string;
  date: any;
  venue?: string;
  location?: string;
  image?: string;
  category?: string;
  status: string;
  tickets: TicketType[];
  price?: number;
}

export default function AdminDashboard() {
  const { user, profile, loading: authLoading } = useAuth();

  const [users, setUsers] = useState<UserData[]>([]);
  const [events, setEvents] = useState<EventData[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const [roleDropdown, setRoleDropdown] = useState<string | null>(null);
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<{ type: 'user' | 'event'; id: string; title?: string } | null>(null);
  const [editingEvent, setEditingEvent] = useState<EventData | null>(null);
  const [savingEvent, setSavingEvent] = useState(false);
  const [eventFilter, setEventFilter] = useState<'all' | 'active' | 'paused' | 'scheduled' | 'deleted'>('all');
  const [eventTimeFilter, setEventTimeFilter] = useState<'all' | 'upcoming' | 'past'>('all');
  const [eventSearch, setEventSearch] = useState('');

  // Authorization: superadmin by email fallback + profile role
  const isAuthorized =
    profile?.role === 'admin' ||
    profile?.role === 'superadmin' ||
    user?.email === 'ridaofrancorg@gmail.com';

  useEffect(() => {
    if (!authLoading && isAuthorized) {
      // 1. Users listener
      const unsubUsers = onSnapshot(collection(db, 'users'), (snap) => {
        const usersData = snap.docs.map(d => ({ id: d.id, ...d.data() } as UserData));
        setUsers(usersData);
        setLoading(false);
      }, (error) => {
        console.error('[AdminDashboard] Users listener error:', error);
        setFetchError('Error al escuchar usuarios: ' + error.message);
      });

      // 2. Events listener
      const unsubEvents = onSnapshot(collection(db, 'events'), (snap) => {
        const eventsData = snap.docs.map(d => ({ id: d.id, ...d.data() } as EventData));
        setEvents(eventsData);
      }, (error) => {
        console.error('[AdminDashboard] Events listener error:', error);
      });

      // 3. Orders listener
      const unsubOrders = onSnapshot(collection(db, 'orders'), (snap) => {
        const ordersData = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        setOrders(ordersData);
      }, (error) => {
        console.error('[AdminDashboard] Orders listener error:', error);
      });

      return () => {
        unsubUsers();
        unsubEvents();
        unsubOrders();
      };
    }
  }, [authLoading, isAuthorized]);

  const fetchData = async () => {
    // Keep this for manual refresh if needed, but onSnapshot handles it now
    setLoading(true);
    setFetchError(null);
  };

  // ==================== AUTH GATE ====================
  // Wait for auth to resolve before showing "No autorizado"
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <Loader className="w-12 h-12 text-orange-500 animate-spin mx-auto" />
          <p className="text-sm text-muted-foreground font-bold uppercase tracking-widest">
            Verificando permisos...
          </p>
        </div>
      </div>
    );
  }

  if (!user || !isAuthorized) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <Card className="glass border-red-500/30 p-8 max-w-md text-center space-y-4">
          <AlertTriangle className="w-12 h-12 text-red-400 mx-auto" />
          <div>
            <h2 className="text-xl font-heading font-black mb-2">No autorizado</h2>
            <p className="text-sm text-muted-foreground">
              Se requiere acceso de administrador para ver esta página.
            </p>
            {user && (
              <p className="text-xs text-muted-foreground mt-3">
                Sesión actual: {user.email} · Rol: {profile?.role || 'sin perfil'}
              </p>
            )}
          </div>
          <Link to="/">
            <Button className="orange-gradient border-none font-bold">Volver al inicio</Button>
          </Link>
        </Card>
      </div>
    );
  }

  // ==================== STATS ====================
  const confirmedOrders = orders.filter((o: any) => o.status === 'confirmed');
  const totalTicketsSold = confirmedOrders.reduce((sum: number, o: any) => {
    return sum + (o.items || []).reduce((s: number, item: any) => s + (item.quantity || 0), 0);
  }, 0);
  const totalRevenue = confirmedOrders.reduce((sum: number, o: any) => sum + (o.total || 0), 0);

  const countsByStatus = events.reduce(
    (acc, e) => {
      const s = e.status || 'active';
      acc[s] = (acc[s] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  const statCards = [
    { label: 'Usuarios', value: users.length, icon: Users, color: 'from-blue-500/20 to-blue-600/20', textColor: 'text-blue-400' },
    { label: 'Eventos', value: events.length, icon: Calendar, color: 'from-purple-500/20 to-purple-600/20', textColor: 'text-purple-400' },
    { label: 'Tickets Vendidos', value: totalTicketsSold || 0, icon: Ticket, color: 'from-orange-500/20 to-orange-600/20', textColor: 'text-orange-400' },
    { label: 'Ingresos (ARS)', value: `$${(Number(totalRevenue) || 0).toLocaleString('es-AR')}`, icon: TrendingUp, color: 'from-green-500/20 to-green-600/20', textColor: 'text-green-400' },
  ];

  // ==================== HANDLERS ====================
  const handleRoleChange = async (userId: string, newRole: 'buyer' | 'organizer' | 'admin' | 'superadmin') => {
    try {
      setUpdatingUserId(userId);
      await updateDoc(doc(db, 'users', userId), { role: newRole, updatedAt: Timestamp.now() });
      setUsers(prev => prev.map(u => (u.id === userId ? { ...u, role: newRole } : u)));
      setRoleDropdown(null);
    } catch (error) {
      console.error('Error updating role:', error);
      alert('No se pudo cambiar el rol.');
    } finally {
      setUpdatingUserId(null);
    }
  };

  const handleSuspendUser = async (userId: string, suspended: boolean) => {
    try {
      await updateDoc(doc(db, 'users', userId), { suspended, updatedAt: Timestamp.now() });
      setUsers(prev => prev.map(u => (u.id === userId ? { ...u, suspended } : u)));
    } catch (error) {
      console.error('Error suspending user:', error);
    }
  };

  const handleEventStatusChange = async (eventId: string, status: 'active' | 'paused') => {
    try {
      await updateDoc(doc(db, 'events', eventId), { status, updatedAt: Timestamp.now() });
      setEvents(prev => prev.map(e => (e.id === eventId ? { ...e, status } : e)));
    } catch (error) {
      console.error('Error updating event status:', error);
      alert('No se pudo cambiar el estado del evento.');
    }
  };

  // SOFT delete — keeps data in Firestore so we can restore
  const handleDeleteEvent = async (eventId: string) => {
    try {
      await updateDoc(doc(db, 'events', eventId), {
        status: 'deleted',
        deletedAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      });
      setEvents(prev => prev.map(e => (e.id === eventId ? { ...e, status: 'deleted' } : e)));
      setConfirmDelete(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `events/${eventId}`);
      alert('No se pudo eliminar el evento.');
    }
  };

  // Restore a soft-deleted event
  const handleRestoreEvent = async (eventId: string) => {
    try {
      await updateDoc(doc(db, 'events', eventId), {
        status: 'active',
        updatedAt: Timestamp.now(),
      });
      setEvents(prev => prev.map(e => (e.id === eventId ? { ...e, status: 'active' } : e)));
    } catch (error) {
      console.error('Error restoring event:', error);
      alert('No se pudo restaurar el evento.');
    }
  };

  const handleDeleteUser = async (userId: string) => {
    try {
      await updateDoc(doc(db, 'users', userId), {
        suspended: true,
        deletedAt: Timestamp.now(),
      });
      setUsers(prev => prev.filter(u => u.id !== userId));
      setConfirmDelete(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${userId}`);
    }
  };

  // Save changes from edit modal
  const handleSaveEvent = async (updated: EventData) => {
    if (!updated.id) return;
    try {
      setSavingEvent(true);
      const payload: any = {
        title: String(updated.title || ''),
        description: String(updated.description || ''),
        venue: String(updated.venue || ''),
        location: String(updated.location || ''),
        image: String(updated.image || ''),
        category: String(updated.category || ''),
        status: String(updated.status || 'active'),
        tickets: (updated.tickets || []).map(t => ({
          type: String(t.type || ''),
          price: Number(t.price) || 0,
          available: Number(t.available) || 0,
        })),
        updatedAt: Timestamp.now(),
      };
      // Only update date if it's a valid Date/Timestamp
      if (updated.date instanceof Date) {
        payload.date = Timestamp.fromDate(updated.date);
      } else if (updated.date?.toDate) {
        payload.date = updated.date;
      }
      if (updated.price !== undefined) {
        payload.price = Number(updated.price) || 0;
      }

      await updateDoc(doc(db, 'events', updated.id), payload);
      setEvents(prev => prev.map(e => (e.id === updated.id ? { ...e, ...payload, date: payload.date || e.date } : e)));
      setEditingEvent(null);
    } catch (error: any) {
      console.error('Error saving event:', error);
      alert(`No se pudo guardar el evento: ${error?.message || 'error desconocido'}`);
    } finally {
      setSavingEvent(false);
    }
  };

  // ==================== HELPERS ====================
  const formatDate = (date: any) => {
    try {
      if (date?.toDate) return date.toDate().toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric' });
      if (date?.seconds) return new Date(date.seconds * 1000).toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric' });
    } catch {}
    return '-';
  };

  const toInputDate = (date: any): string => {
    try {
      const d = date?.toDate ? date.toDate() : date?.seconds ? new Date(date.seconds * 1000) : null;
      if (!d) return '';
      return d.toISOString().slice(0, 16); // yyyy-MM-ddTHH:mm for datetime-local input
    } catch {
      return '';
    }
  };

  const roleColor = (role: string) => {
    switch (role) {
      case 'superadmin': return 'bg-red-500/30 text-red-300 border-red-500/50';
      case 'admin': return 'bg-orange-500/30 text-orange-300 border-orange-500/50';
      case 'organizer': return 'bg-purple-500/30 text-purple-300 border-purple-500/50';
      default: return 'bg-blue-500/30 text-blue-300 border-blue-500/50';
    }
  };

  const statusBadge = (status: string) => {
    switch (status) {
      case 'active': return { label: 'Activo', cls: 'bg-green-500/20 text-green-400 border-green-500/30' };
      case 'paused': return { label: 'Pausado', cls: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' };
      case 'scheduled': return { label: 'Programado', cls: 'bg-blue-500/20 text-blue-400 border-blue-500/30' };
      case 'deleted': return { label: 'Eliminado', cls: 'bg-red-500/20 text-red-400 border-red-500/30' };
      default: return { label: status || 'Activo', cls: 'bg-zinc-500/20 text-zinc-400 border-zinc-500/30' };
    }
  };

  // Apply event filter
  const filteredEvents = events.filter(e => {
    const s = e.status || 'active';
    const matchesStatus = eventFilter === 'all' || s === eventFilter;
    
    const eventDate = e.date?.toDate ? e.date.toDate() : e.date?.seconds ? new Date(e.date.seconds * 1000) : null;
    const now = new Date();
    const matchesTime = eventTimeFilter === 'all' || 
                       (eventTimeFilter === 'upcoming' && eventDate && eventDate >= now) ||
                       (eventTimeFilter === 'past' && eventDate && eventDate < now);
                       
    const matchesSearch = e.title.toLowerCase().includes(eventSearch.toLowerCase()) ||
                         e.organizerEmail?.toLowerCase().includes(eventSearch.toLowerCase()) ||
                         e.venue?.toLowerCase().includes(eventSearch.toLowerCase());
                         
    return matchesStatus && matchesTime && matchesSearch;
  });

  // ==================== LOADING SCREEN ====================
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <Loader className="w-12 h-12 text-orange-500 animate-spin mx-auto" />
          <p className="text-sm text-muted-foreground font-bold uppercase tracking-widest">
            Cargando panel...
          </p>
        </div>
      </div>
    );
  }

  // ==================== RENDER ====================
  return (
    <div className="pt-28 pb-20 px-6 max-w-7xl mx-auto">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-8 flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-tight">
            Panel de <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-500 to-orange-600">Administración</span>
          </h1>
          <p className="text-zinc-400 mt-1 text-sm">
            Gestión de usuarios, eventos y métricas · Sesión: {user.email}
          </p>
        </div>
        <div className="flex gap-2">
          <Link to="/eventos">
            <Button variant="outline" className="border-white/10 font-bold">
              <Eye className="w-4 h-4 mr-2" /> Ver eventos públicos
            </Button>
          </Link>
          <Link to="/crear-evento">
            <Button className="orange-gradient border-none font-bold">
              <Plus className="w-4 h-4 mr-2" /> Nuevo evento
            </Button>
          </Link>
        </div>
      </motion.div>

      {/* Error Banner */}
      {fetchError && (
        <Card className="glass border-red-500/30 p-4 mb-6">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-bold text-red-500">Error al cargar datos</p>
              <p className="text-xs text-muted-foreground mt-1">{fetchError}</p>
              <Button size="sm" onClick={fetchData} className="mt-3 orange-gradient border-none font-bold">
                Reintentar
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
        {statCards.map((stat, idx) => {
          const Icon = stat.icon;
          return (
            <motion.div
              key={idx}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05 }}
              className="bg-white/5 rounded-3xl border border-white/10 p-5"
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold uppercase tracking-widest text-zinc-500">{stat.label}</span>
                <div className={`bg-gradient-to-br ${stat.color} p-2 rounded-xl`}>
                  <Icon className={`w-4 h-4 ${stat.textColor}`} />
                </div>
              </div>
              <p className={`text-2xl font-black ${stat.textColor}`}>{stat.value}</p>
            </motion.div>
          );
        })}
      </div>

      {/* Users Table */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="mb-8">
        <div className="bg-white/5 rounded-3xl border border-white/10 p-6">
          <h2 className="text-xl font-black mb-4">
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-500 to-orange-600">Usuarios</span>
            <span className="text-zinc-500 text-sm font-normal ml-3">{users.length} total</span>
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="text-left py-3 px-4 text-zinc-500 font-bold text-xs uppercase tracking-widest">Nombre</th>
                  <th className="text-left py-3 px-4 text-zinc-500 font-bold text-xs uppercase tracking-widest">Email</th>
                  <th className="text-left py-3 px-4 text-zinc-500 font-bold text-xs uppercase tracking-widest">Rol</th>
                  <th className="text-left py-3 px-4 text-zinc-500 font-bold text-xs uppercase tracking-widest">Registro</th>
                  <th className="text-left py-3 px-4 text-zinc-500 font-bold text-xs uppercase tracking-widest">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {users.map(u => (
                  <tr key={u.id} className="border-b border-white/5 hover:bg-white/5 transition">
                    <td className="py-3 px-4 text-zinc-200 font-medium">{u.displayName || 'Sin nombre'}</td>
                    <td className="py-3 px-4 text-zinc-400">{u.email}</td>
                    <td className="py-3 px-4">
                      <span className={`inline-block text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded-full border ${roleColor(u.role)}`}>
                        {u.role}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-zinc-500 text-xs">{formatDate(u.createdAt)}</td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <div className="relative">
                          <button
                            onClick={() => setRoleDropdown(roleDropdown === u.id ? null : u.id)}
                            className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-orange-500/10 hover:bg-orange-500/20 border border-orange-500/30 text-orange-400 transition text-xs font-bold"
                            disabled={updatingUserId === u.id}
                          >
                            {updatingUserId === u.id ? 'Guardando...' : 'Cambiar rol'}
                            <ChevronDown className="w-3 h-3" />
                          </button>
                          {roleDropdown === u.id && (
                            <div className="absolute top-full mt-1 right-0 bg-zinc-900 border border-white/10 rounded-xl overflow-hidden z-10 shadow-xl min-w-max">
                              {(['buyer', 'organizer', 'admin', 'superadmin'] as const).map(role => (
                                <button
                                  key={role}
                                  onClick={() => handleRoleChange(u.id, role)}
                                  className={`w-full text-left px-4 py-2 hover:bg-orange-500/20 transition text-xs font-bold ${
                                    u.role === role ? 'text-orange-400 bg-orange-500/10' : 'text-zinc-300'
                                  }`}
                                >
                                  {role}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                        <button
                          onClick={() => handleSuspendUser(u.id, !u.suspended)}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition ${
                            u.suspended
                              ? 'bg-green-500/10 border-green-500/30 text-green-400 hover:bg-green-500/20'
                              : 'bg-red-500/10 border-red-500/30 text-red-400 hover:bg-red-500/20'
                          }`}
                        >
                          {u.suspended ? 'Activar' : 'Suspender'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </motion.div>

      {/* Events Table */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
        <div className="bg-white/5 rounded-3xl border border-white/10 p-6">
          <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
            <h2 className="text-xl font-black">
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-500 to-orange-600">Eventos</span>
              <span className="text-zinc-500 text-sm font-normal ml-3">
                {filteredEvents.length} de {events.length}
              </span>
            </h2>
            
            <div className="flex flex-col md:flex-row gap-4 items-start md:items-center">
              {/* Search input */}
              <div className="relative w-full md:w-72">
                <Input
                  placeholder="Buscar por título, lugar u organizador..."
                  value={eventSearch}
                  onChange={(e) => setEventSearch(e.target.value)}
                  className="bg-white/5 border-white/10 h-12 rounded-2xl pl-12 text-sm focus:border-orange-500/50 transition-all"
                />
                <Search className="w-5 h-5 text-zinc-500 absolute left-4 top-1/2 -translate-y-1/2" />
              </div>

              {/* Time filter Tabs */}
              <div className="flex bg-white/5 border border-white/10 rounded-2xl p-1 w-full md:w-auto">
                {(['all', 'upcoming', 'past'] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => setEventTimeFilter(t)}
                    className={`flex-1 md:flex-none px-6 py-2.5 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all ${
                      eventTimeFilter === t
                        ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/20'
                        : 'text-zinc-500 hover:text-white'
                    }`}
                  >
                    {t === 'all' ? 'Todos' : t === 'upcoming' ? 'Próximos' : 'Pasados'}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 mb-6 overflow-x-auto pb-2 scrollbar-hide">
            {/* Event filter chips */}
            <div className="flex gap-1.5">
              {([
                { key: 'all', label: `Todos (${events.length})` },
                { key: 'active', label: `Activos (${countsByStatus.active || 0})` },
                { key: 'paused', label: `Pausados (${countsByStatus.paused || 0})` },
                { key: 'scheduled', label: `Programados (${countsByStatus.scheduled || 0})` },
                { key: 'deleted', label: `Eliminados (${countsByStatus.deleted || 0})` },
              ] as const).map(f => (
                <button
                  key={f.key}
                  onClick={() => setEventFilter(f.key)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap ${
                    eventFilter === f.key
                      ? 'orange-gradient text-white'
                      : 'bg-white/5 border border-white/10 text-muted-foreground hover:text-white'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {filteredEvents.length === 0 ? (
            <div className="text-center py-12">
              <Calendar className="w-12 h-12 text-muted-foreground mx-auto mb-3 opacity-50" />
              <p className="text-sm text-muted-foreground">
                {events.length === 0
                  ? 'No hay eventos en la base de datos. Creá el primero con el botón arriba.'
                  : 'No hay eventos que coincidan con este filtro.'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="text-left py-3 px-4 text-zinc-500 font-bold text-xs uppercase tracking-widest">Título</th>
                    <th className="text-left py-3 px-4 text-zinc-500 font-bold text-xs uppercase tracking-widest">Fecha</th>
                    <th className="text-left py-3 px-4 text-zinc-500 font-bold text-xs uppercase tracking-widest">Tickets</th>
                    <th className="text-left py-3 px-4 text-zinc-500 font-bold text-xs uppercase tracking-widest">Estado</th>
                    <th className="text-left py-3 px-4 text-zinc-500 font-bold text-xs uppercase tracking-widest">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredEvents.map(e => {
                    const badge = statusBadge(e.status || 'active');
                    const totalAvailable = (e.tickets || []).reduce((s, t) => s + (t.available || 0), 0);
                    const totalCapacity = (e.tickets || []).reduce((s, t) => s + (t.available || 0), 0);
                    const isDeleted = (e.status || 'active') === 'deleted';
                    return (
                      <tr key={e.id} className="border-b border-white/5 hover:bg-white/5 transition">
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-3">
                            {e.image && (
                              <img src={e.image} alt={e.title} className="w-10 h-10 rounded-lg object-cover" referrerPolicy="no-referrer" />
                            )}
                            <div>
                              <p className="text-zinc-200 font-medium">{e.title}</p>
                              <p className="text-xs text-zinc-500">{e.venue || '—'}{e.location ? `, ${e.location}` : ''}</p>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-zinc-500 text-xs">{formatDate(e.date)}</td>
                        <td className="py-3 px-4 text-zinc-400 text-xs">
                          {(e.tickets || []).length > 0 ? (
                            <span>{totalAvailable} disponibles</span>
                          ) : (
                            <span className="text-zinc-600">Sin tickets</span>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          <span className={`inline-block text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded-full border ${badge.cls}`}>
                            {badge.label}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex gap-1.5 flex-wrap">
                            <Link to={`/evento/${e.id}`}>
                              <button className="px-2.5 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-zinc-300 text-xs font-bold transition" title="Ver página pública">
                                <Eye className="w-3.5 h-3.5" />
                              </button>
                            </Link>
                            <Link to={`/dashboard/evento/${e.id}`}>
                              <button className="px-2.5 py-1.5 rounded-xl bg-orange-500/10 hover:bg-orange-500/20 border border-orange-500/30 text-orange-400 text-xs font-bold transition" title="Gestionar (Dashboard Interno)">
                                <BarChart3 className="w-3.5 h-3.5" />
                              </button>
                            </Link>
                            <button
                              onClick={() => setEditingEvent(e)}
                              className="px-2.5 py-1.5 rounded-xl bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/30 text-blue-400 text-xs font-bold transition"
                              title="Editar"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            {!isDeleted && (
                              <>
                                {e.status === 'active' ? (
                                  <button
                                    onClick={() => handleEventStatusChange(e.id, 'paused')}
                                    className="px-3 py-1.5 rounded-xl bg-yellow-500/10 hover:bg-yellow-500/20 border border-yellow-500/30 text-yellow-400 text-xs font-bold transition"
                                  >
                                    Pausar
                                  </button>
                                ) : e.status === 'paused' ? (
                                  <button
                                    onClick={() => handleEventStatusChange(e.id, 'active')}
                                    className="px-3 py-1.5 rounded-xl bg-green-500/10 hover:bg-green-500/20 border border-green-500/30 text-green-400 text-xs font-bold transition"
                                  >
                                    Activar
                                  </button>
                                ) : null}
                              </>
                            )}
                            {isDeleted ? (
                              <button
                                onClick={() => handleRestoreEvent(e.id)}
                                className="px-3 py-1.5 rounded-xl bg-green-500/10 hover:bg-green-500/20 border border-green-500/30 text-green-400 text-xs font-bold transition flex items-center gap-1"
                              >
                                <RotateCcw className="w-3 h-3" /> Restaurar
                              </button>
                            ) : (
                              <button
                                onClick={() => setConfirmDelete({ type: 'event', id: e.id, title: e.title })}
                                className="px-2.5 py-1.5 rounded-xl bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-400 text-xs font-bold transition"
                                title="Eliminar"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </motion.div>

      {/* ==================== EDIT EVENT MODAL ==================== */}
      {editingEvent && (
        <EditEventModal
          event={editingEvent}
          saving={savingEvent}
          onClose={() => setEditingEvent(null)}
          onSave={handleSaveEvent}
        />
      )}

      {/* ==================== CONFIRM DELETE MODAL ==================== */}
      {confirmDelete && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-6">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-zinc-900 border border-white/10 p-8 rounded-[2.5rem] max-w-md w-full text-center space-y-6"
          >
            <div className="w-20 h-20 bg-red-500/20 text-red-500 rounded-full flex items-center justify-center mx-auto">
              <AlertTriangle className="w-10 h-10" />
            </div>
            <div>
              <h3 className="text-2xl font-black mb-2">¿Eliminar {confirmDelete.type === 'user' ? 'usuario' : 'evento'}?</h3>
              <p className="text-zinc-400 text-sm">
                {confirmDelete.type === 'event' ? (
                  <>El evento <strong className="text-white">{confirmDelete.title}</strong> se marcará como eliminado y dejará de aparecer en la web pública. Podés restaurarlo desde el filtro "Eliminados".</>
                ) : (
                  'Esta acción suspenderá el usuario permanentemente.'
                )}
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmDelete(null)}
                className="flex-1 px-6 py-4 rounded-2xl bg-white/5 hover:bg-white/10 font-bold transition"
              >
                Cancelar
              </button>
              <button
                onClick={() =>
                  confirmDelete.type === 'user'
                    ? handleDeleteUser(confirmDelete.id)
                    : handleDeleteEvent(confirmDelete.id)
                }
                className="flex-1 px-6 py-4 rounded-2xl bg-red-600 hover:bg-red-700 text-white font-bold transition"
              >
                Eliminar
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}

// ==================== EDIT EVENT MODAL COMPONENT ====================
function EditEventModal({
  event,
  saving,
  onClose,
  onSave,
}: {
  event: EventData;
  saving: boolean;
  onClose: () => void;
  onSave: (updated: EventData) => void;
}) {
  const [form, setForm] = useState<EventData>({ ...event });
  const [dateStr, setDateStr] = useState<string>(() => {
    try {
      const d = event.date?.toDate ? event.date.toDate() : event.date?.seconds ? new Date(event.date.seconds * 1000) : null;
      if (!d) return '';
      return d.toISOString().slice(0, 16);
    } catch {
      return '';
    }
  });

  const updateTicket = (idx: number, field: keyof TicketType, value: any) => {
    const tickets = [...(form.tickets || [])];
    tickets[idx] = { ...tickets[idx], [field]: value };
    setForm({ ...form, tickets });
  };

  const addTicketType = () => {
    setForm({
      ...form,
      tickets: [...(form.tickets || []), { type: 'Nueva entrada', price: 0, available: 100 }],
    });
  };

  const removeTicketType = (idx: number) => {
    const tickets = [...(form.tickets || [])];
    tickets.splice(idx, 1);
    setForm({ ...form, tickets });
  };

  const handleSubmit = () => {
    const updated = { ...form };
    if (dateStr) {
      updated.date = new Date(dateStr);
    }
    onSave(updated);
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-start md:items-center justify-center p-6 overflow-y-auto">
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-zinc-900 border border-white/10 rounded-[2.5rem] max-w-2xl w-full my-6"
      >
        <div className="flex items-center justify-between p-6 border-b border-white/10 sticky top-0 bg-zinc-900 rounded-t-[2.5rem] z-10">
          <h3 className="text-xl font-heading font-black">Editar evento</h3>
          <button
            onClick={onClose}
            className="w-10 h-10 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Title */}
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Título</label>
            <Input
              value={form.title || ''}
              onChange={e => setForm({ ...form, title: e.target.value })}
              className="bg-white/5 border-white/10 h-12 rounded-2xl"
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Descripción</label>
            <textarea
              value={form.description || ''}
              onChange={e => setForm({ ...form, description: e.target.value })}
              rows={3}
              className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-sm resize-none focus:outline-none focus:border-primary/50"
            />
          </div>

          {/* Date + Category */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Fecha y hora</label>
              <input
                type="datetime-local"
                value={dateStr}
                onChange={e => setDateStr(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-2xl h-12 px-4 text-sm focus:outline-none focus:border-primary/50"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Categoría</label>
              <Input
                value={form.category || ''}
                onChange={e => setForm({ ...form, category: e.target.value })}
                className="bg-white/5 border-white/10 h-12 rounded-2xl"
              />
            </div>
          </div>

          {/* Venue + Location */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Lugar</label>
              <Input
                value={form.venue || ''}
                onChange={e => setForm({ ...form, venue: e.target.value })}
                className="bg-white/5 border-white/10 h-12 rounded-2xl"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Ciudad</label>
              <Input
                value={form.location || ''}
                onChange={e => setForm({ ...form, location: e.target.value })}
                className="bg-white/5 border-white/10 h-12 rounded-2xl"
              />
            </div>
          </div>

          {/* Image URL */}
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Imagen (URL)</label>
            <Input
              value={form.image || ''}
              onChange={e => setForm({ ...form, image: e.target.value })}
              placeholder="https://..."
              className="bg-white/5 border-white/10 h-12 rounded-2xl"
            />
            {form.image && (
              <img src={form.image} alt="preview" className="w-full h-40 object-cover rounded-2xl mt-2" referrerPolicy="no-referrer" />
            )}
          </div>

          {/* Status */}
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Estado</label>
            <div className="flex gap-2 flex-wrap">
              {(['active', 'paused', 'scheduled', 'deleted'] as const).map(s => (
                <button
                  key={s}
                  onClick={() => setForm({ ...form, status: s })}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition ${
                    form.status === s
                      ? 'orange-gradient text-white'
                      : 'bg-white/5 border border-white/10 text-muted-foreground hover:text-white'
                  }`}
                >
                  {s === 'active' ? 'Activo' : s === 'paused' ? 'Pausado' : s === 'scheduled' ? 'Programado' : 'Eliminado'}
                </button>
              ))}
            </div>
          </div>

          {/* Tickets */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Tipos de entradas</label>
              <button
                onClick={addTicketType}
                className="text-xs font-bold text-primary hover:underline flex items-center gap-1"
              >
                <Plus className="w-3 h-3" /> Agregar tipo
              </button>
            </div>
            {(form.tickets || []).length === 0 && (
              <p className="text-xs text-muted-foreground italic">Este evento no tiene entradas configuradas.</p>
            )}
            {(form.tickets || []).map((t, idx) => (
              <div key={idx} className="grid grid-cols-12 gap-2 items-center bg-white/5 border border-white/10 rounded-2xl p-3">
                <Input
                  placeholder="Tipo"
                  value={t.type}
                  onChange={e => updateTicket(idx, 'type', e.target.value)}
                  className="col-span-5 bg-white/5 border-white/10 h-10 rounded-xl text-sm"
                />
                <Input
                  type="number"
                  placeholder="Precio"
                  value={t.price}
                  onChange={e => updateTicket(idx, 'price', Number(e.target.value))}
                  className="col-span-3 bg-white/5 border-white/10 h-10 rounded-xl text-sm"
                />
                <Input
                  type="number"
                  placeholder="Disp."
                  value={t.available}
                  onChange={e => updateTicket(idx, 'available', Number(e.target.value))}
                  className="col-span-3 bg-white/5 border-white/10 h-10 rounded-xl text-sm"
                />
                <button
                  onClick={() => removeTicketType(idx)}
                  className="col-span-1 w-8 h-8 rounded-lg bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-400 flex items-center justify-center"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-3 p-6 border-t border-white/10 sticky bottom-0 bg-zinc-900 rounded-b-[2.5rem]">
          <Button
            variant="ghost"
            onClick={onClose}
            disabled={saving}
            className="flex-1 h-12 font-bold"
          >
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={saving}
            className="flex-1 h-12 orange-gradient border-none font-bold"
          >
            {saving ? 'Guardando...' : 'Guardar cambios'}
          </Button>
        </div>
      </motion.div>
    </div>
  );
}

