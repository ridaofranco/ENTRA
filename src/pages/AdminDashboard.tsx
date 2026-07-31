import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Users, Calendar, Ticket, TrendingUp, Loader, ChevronDown, Clock,
  Edit3, Trash2, RotateCcw, Eye, X, Plus, AlertTriangle, BarChart3, Search, Check, Save
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/src/context/AuthContext';
import { db } from '@/src/lib/firebase';
import { collection, getDocs, doc, updateDoc, setDoc, getDoc, Timestamp, onSnapshot, deleteField } from 'firebase/firestore';
import { Card } from '@/src/components/ui/card';
import { Button } from '@/src/components/ui/button';
import { Input } from '@/src/components/ui/input';
import { handleFirestoreError, OperationType } from '@/src/lib/firebase';
import { formatCurrency } from '@/src/lib/utils';

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
  organizerId?: string;
  organizerEmail?: string;
  commissionRate?: number;
  date: any;
  // Fin del evento (opcional): si existe, la venta termina exactamente ahi.
  // Sin endDate, el evento se da por finalizado 3hs despues del inicio.
  endDate?: any;
  isMultiDay?: boolean;
  // Los dos "a confirmar" que el productor puede dejar abiertos al crear el
  // evento. Se usaban en la tabla sin estar declarados acá.
  isDateTBD?: boolean;
  isVenueTBD?: boolean;
  hidden?: boolean;
  venue?: string;
  location?: string;
  image?: string;
  category?: string;
  status: string;
  tickets: TicketType[];
  price?: number;
  ticketsSold?: number;
  totalRevenue?: number;
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
  const [confirmCancel, setConfirmCancel] = useState<{ id: string; title?: string } | null>(null);
  const [cancellingEvent, setCancellingEvent] = useState(false);
  const [editingEvent, setEditingEvent] = useState<EventData | null>(null);
  const [savingEvent, setSavingEvent] = useState(false);
  const [eventSearch, setEventSearch] = useState('');

  // ── La comisión de ENTRÁ ────────────────────────────────────────────────────
  // Vive en platform_config/settings.commissionPercent, y es LA MISMA que lee el
  // servidor al crear cada pago. No hay dos números: lo que se ve acá es lo que
  // se cobra. Antes el panel mostraba tarifas por plan que el cobro ignoraba.
  const [comisionActual, setComisionActual] = useState<number>(8);
  const [comisionInput, setComisionInput] = useState<string>('8');
  const [comisionGuardando, setComisionGuardando] = useState(false);
  const [comisionGuardada, setComisionGuardada] = useState(false);
  const [comisionError, setComisionError] = useState<string | null>(null);
  // Qué secciones de eventos están abiertas. Se recuerda entre visitas: si
  // cerraste "Ya pasaron", no tenés que volver a cerrarlo cada vez que entrás.
  const [seccionesAbiertas, setSeccionesAbiertas] = useState<Record<string, boolean>>(() => {
    try {
      const guardado = localStorage.getItem('entra_admin_secciones');
      return guardado ? JSON.parse(guardado) : {};
    } catch {
      return {};
    }
  });
  const alternarSeccion = (key: string, defecto: boolean) => {
    setSeccionesAbiertas(prev => {
      const abierta = prev[key] ?? defecto;
      const siguiente = { ...prev, [key]: !abierta };
      try { localStorage.setItem('entra_admin_secciones', JSON.stringify(siguiente)); } catch { /* modo privado */ }
      return siguiente;
    });
  };

  // Authorization: admin + superadmin can enter the panel
  const isAuthorized =
    profile?.role === 'admin' ||
    profile?.role === 'superadmin' ||
    user?.email === 'ridaofrancorg@gmail.com';
  // But ONLY superadmin can edit platform commission
  const isSuperAdmin =
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
        // Sort in memory (newest first by creation date)
        eventsData.sort((a, b) => {
          const aTime = (a as any).createdAt?.seconds || 0;
          const bTime = (b as any).createdAt?.seconds || 0;
          return bTime - aTime;
        });
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

  // Se lee una vez al abrir el panel. Si nunca se configuró, queda el 8% que usa
  // el servidor como respaldo, así lo que se muestra siempre es lo que se cobra.
  useEffect(() => {
    (async () => {
      try {
        const snap = await getDoc(doc(db, 'platform_config', 'settings'));
        const guardada = Number(snap.exists() ? snap.data()?.commissionPercent : NaN);
        if (Number.isFinite(guardada)) {
          setComisionActual(guardada);
          setComisionInput(String(guardada));
        }
      } catch (err) {
        console.warn('[AdminDashboard] no se pudo leer la comisión:', err);
      }
    })();
  }, []);

  const guardarComision = async () => {
    // Se acepta coma o punto: nadie tiene por qué acordarse de cuál espera el input.
    const valor = Number(comisionInput.replace(',', '.').trim());
    if (!Number.isFinite(valor) || valor < 0 || valor > 50) {
      setComisionError('Poné un número entre 0 y 50. Es un porcentaje, no un monto.');
      return;
    }
    setComisionGuardando(true);
    setComisionError(null);
    try {
      await setDoc(
        doc(db, 'platform_config', 'settings'),
        { commissionPercent: valor, updatedAt: Timestamp.now(), updatedBy: user?.email || '' },
        { merge: true },
      );
      setComisionActual(valor);
      setComisionInput(String(valor));
      setComisionGuardada(true);
      // El servidor cachea la comisión 60 segundos, así que un cambio puede
      // tardar hasta un minuto en verse en una compra. Vale decirlo.
      setTimeout(() => setComisionGuardada(false), 4000);
    } catch (err: any) {
      setComisionError('No se pudo guardar: ' + (err?.message || 'error'));
    } finally {
      setComisionGuardando(false);
    }
  };

  // El 31/7 se sacó todo el sistema de PLANES (starter/pro/enterprise) del panel:
  // la carga de tiers, el guardado de comisiones, el cambio de plan por usuario,
  // y el "Recalcular comisión según plan".
  //
  // La comisión de ENTRÁ es ÚNICA del 8% y está fija en CreateEvent desde el
  // modelo nuevo. Los planes eran un vestigio, y no eran solo ruido visual: el
  // botón de recalcular leía las tarifas por tier (3.5 / 2.5 / 1.9) y las
  // escribía sobre el evento, o sea que UN CLIC AHÍ PISABA el 8% real con un
  // número que nadie cobra. El campo `commissionRate` del evento se sigue
  // guardando, pero solo lo escribe CreateEvent.

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
    { label: 'Pendientes', value: countsByStatus.pending || 0, icon: Clock, color: 'from-orange-500/20 to-orange-600/20', textColor: 'text-orange-400' },
    { label: 'Tickets Vendidos', value: totalTicketsSold || 0, icon: Ticket, color: 'from-yellow-500/20 to-yellow-600/20', textColor: 'text-yellow-400' },
    { label: 'Ingresos (ARS)', value: formatCurrency(Number(totalRevenue) || 0), icon: TrendingUp, color: 'from-green-500/20 to-green-600/20', textColor: 'text-green-400' },
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
    // Se guarda el estado ANTERIOR: solo el salto de "pending" a "active" es una
    // aprobación. Reactivar un evento pausado no lo es, y mandarle "tu evento fue
    // aprobado" al productor cada vez que se despausa sería mentirle.
    const anterior = events.find(e => e.id === eventId);
    const esAprobacion = anterior?.status === 'pending' && status === 'active';
    try {
      await updateDoc(doc(db, 'events', eventId), { status, updatedAt: Timestamp.now() });
      setEvents(prev => prev.map(e => (e.id === eventId ? { ...e, status } : e)));

      if (esAprobacion && anterior) {
        // Sin await: el evento ya está publicado, que es lo que importa. Si el
        // mail falla, no puede hacer que la publicación parezca fallida.
        fetch('/api/organizador', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'event-approved',
            eventId,
            eventTitle: anterior.title,
            eventDate: (anterior as any).date?.toDate?.()?.toLocaleDateString('es-AR', {
              weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
              timeZone: 'America/Argentina/Buenos_Aires',
            }) || '',
            venue: (anterior as any).venue || '',
            organizerEmail: (anterior as any).organizerEmail || '',
            organizerName: (anterior as any).organizerName || '',
          }),
        }).catch(() => {});
      }
    } catch (error) {
      console.error('Error updating event status:', error);
      alert('No se pudo cambiar el estado del evento.');
    }
  };

  // CANCELAR evento: pasa por el server (/api/notify-event-cancelled), que
  // verifica la identidad, marca status 'cancelled' y les avisa por mail a
  // todos los que tienen entradas vigentes. Distinto de "eliminar": acá el
  // evento se cae de verdad y los compradores TIENEN que enterarse.
  const handleCancelEvent = async (eventId: string) => {
    if (!user) return;
    try {
      setCancellingEvent(true);
      const idToken = await user.getIdToken();
      const resp = await fetch('/api/notify-event-cancelled', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken, eventId }),
      });
      const data = await resp.json().catch(() => null);
      if (!resp.ok || !data?.ok) {
        alert(data?.error || 'No se pudo cancelar el evento.');
        return;
      }
      setEvents(prev => prev.map(e => (e.id === eventId ? { ...e, status: 'cancelled' } : e)));
      setConfirmCancel(null);
      alert(
        data.already
          ? 'El evento ya estaba cancelado y los compradores ya habían sido avisados.'
          : `Evento cancelado. Avisamos por mail a ${data.notified} comprador${data.notified === 1 ? '' : 'es'}${data.failed ? ` (${data.failed} envíos fallaron, revisá los logs)` : ''}.`
      );
    } catch (error) {
      console.error('Error cancelando evento:', error);
      alert('No se pudo cancelar el evento.');
    } finally {
      setCancellingEvent(false);
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
      // Fin del evento: Date = lo cargo el admin, null = lo vacio (se borra el
      // campo y vuelve la regla de inicio + 3hs). Timestamp/undefined = no tocar
      // (asi los multi-dia conservan su endDate automatico).
      let localEndDate: any = updated.endDate;
      if (updated.endDate instanceof Date) {
        localEndDate = Timestamp.fromDate(updated.endDate);
        payload.endDate = localEndDate;
      } else if (updated.endDate === null) {
        localEndDate = undefined;
        payload.endDate = deleteField();
      }
      if (updated.price !== undefined) {
        payload.price = Number(updated.price) || 0;
      }

      await updateDoc(doc(db, 'events', updated.id), payload);
      // Ojo: en el estado local no puede quedar el sentinel deleteField()
      setEvents(prev => prev.map(e => (e.id === updated.id ? { ...e, ...payload, date: payload.date || e.date, endDate: 'endDate' in payload ? localEndDate : e.endDate } : e)));
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
      case 'pending': return { label: 'Pendiente', cls: 'bg-orange-500/20 text-orange-400 border-orange-500/30' };
      case 'paused': return { label: 'Pausado', cls: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' };
      case 'scheduled': return { label: 'Programado', cls: 'bg-blue-500/20 text-blue-400 border-blue-500/30' };
      case 'deleted': return { label: 'Eliminado', cls: 'bg-red-500/20 text-red-400 border-red-500/30' };
      case 'cancelled': return { label: 'Cancelado', cls: 'bg-red-500/20 text-red-400 border-red-500/30' };
      default: return { label: status || 'Activo', cls: 'bg-zinc-500/20 text-zinc-400 border-zinc-500/30' };
    }
  };

  // Apply event filter
  // ══════════════════════════════════════════════════════════════════════════
  // LOS EVENTOS, AGRUPADOS POR LO QUE HAY QUE HACER CON ELLOS
  // ══════════════════════════════════════════════════════════════════════════
  // Antes esto era una lista sola con chips de filtro. El problema no era el
  // filtro: era que por defecto se veía TODO junto, así que los eliminados y
  // los que ya pasaron tapaban a los que importan. Y para no verlos había que
  // acordarse de tocar un chip cada vez que se entraba.
  //
  // Ahora se agrupa por estado. Lo que pide acción arriba y abierto; el archivo
  // abajo y cerrado, pero a un clic. La preferencia de qué está abierto se
  // guarda en el navegador, así el panel se abre como lo dejaste.
  const eventosFiltrados = events.filter(e => {
    if (!eventSearch.trim()) return true;
    const q = eventSearch.toLowerCase();
    return e.title.toLowerCase().includes(q) ||
           e.organizerEmail?.toLowerCase().includes(q) ||
           e.venue?.toLowerCase().includes(q);
  });

  const ahora = new Date();
  const fechaDe = (e: EventData): Date | null =>
    e.date?.toDate ? e.date.toDate() : e.date?.seconds ? new Date(e.date.seconds * 1000) : null;
  const yaPaso = (e: EventData): boolean => {
    const d = fechaDe(e);
    if (!d) return false;
    // Mismo criterio que la cartelera: sin hora de fin, un evento se da por
    // terminado 3 horas después de empezar.
    const fin = (e as any).endDate?.toDate ? (e as any).endDate.toDate() : new Date(d.getTime() + 3 * 60 * 60 * 1000);
    return fin < ahora;
  };

  const gruposEventos = (() => {
    const paraAprobar: EventData[] = [];
    const activos: EventData[] = [];
    const pausados: EventData[] = [];
    const pasados: EventData[] = [];
    const ocultos: EventData[] = [];
    const eliminados: EventData[] = [];

    for (const e of eventosFiltrados) {
      const st = e.status || 'active';
      if (st === 'deleted' || st === 'cancelled') { eliminados.push(e); continue; }
      if (st === 'pending') { paraAprobar.push(e); continue; }
      if ((e as any).hidden) { ocultos.push(e); continue; }
      if (yaPaso(e)) { pasados.push(e); continue; }
      if (st === 'paused') { pausados.push(e); continue; }
      activos.push(e);
    }

    return [
      { key: 'para-aprobar', titulo: 'Para aprobar', ayuda: 'Cargados por un productor. No se ven ni se venden hasta que los publiques.', eventos: paraAprobar, defecto: true, acento: true },
      { key: 'activos', titulo: 'A la venta', ayuda: 'Publicados y con fecha por delante.', eventos: activos, defecto: true, acento: false },
      { key: 'pausados', titulo: 'Pausados', ayuda: 'Publicados pero con la venta frenada.', eventos: pausados, defecto: true, acento: false },
      { key: 'pasados', titulo: 'Ya pasaron', ayuda: 'Terminados. Quedan para consultar las ventas.', eventos: pasados, defecto: false, acento: false },
      { key: 'ocultos', titulo: 'Ocultos', ayuda: 'No aparecen en la cartelera, pero el link directo funciona.', eventos: ocultos, defecto: false, acento: false },
      { key: 'eliminados', titulo: 'Eliminados', ayuda: 'Dados de baja. Se pueden restaurar.', eventos: eliminados, defecto: false, acento: false },
    ].filter(g => g.eventos.length > 0);
  })();

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
            Panel de <span className="text-orange-500">Administración</span>
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
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-10">
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

      {/* ==================== COMISIÓN DE ENTRÁ ====================
          Un solo número, el que se cobra de verdad. Reemplaza al bloque de
          "Comisiones por tier", que configuraba tarifas por plan de suscripción
          que nadie aplicaba: el servidor cobraba 8% fijo pase lo que pase. */}
      {isSuperAdmin && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="mb-8">
          <div className="bg-white/5 rounded-3xl border border-white/10 p-6">
            <div className="flex flex-wrap items-start justify-between gap-6">
              <div className="max-w-md">
                <h2 className="text-xl font-heading font-black">
                  <span className="text-orange-500">Comisión</span> de ENTRÁ
                </h2>
                <p className="text-sm text-zinc-400 mt-2 leading-relaxed">
                  Es el porcentaje que cobra ENTRÁ sobre cada entrada vendida.
                  Rige para <b className="text-zinc-200">todos los eventos</b>, los que ya están publicados
                  y los que se creen después.
                </p>
                <p className="text-xs text-zinc-500 mt-3 leading-relaxed">
                  El cargo lo paga el comprador, así que el productor cobra siempre el precio
                  que puso. Si subís la comisión, sube el precio final de la entrada; si la bajás,
                  baja. Las ventas ya hechas no se tocan.
                </p>
              </div>

              <div className="flex items-end gap-3">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">
                    Comisión actual
                  </label>
                  <div className="relative">
                    <Input
                      type="text"
                      inputMode="decimal"
                      value={comisionInput}
                      onChange={(e) => setComisionInput(e.target.value)}
                      className="w-28 bg-white/5 border-white/10 rounded-xl pl-4 pr-9 h-12 font-black text-lg"
                    />
                    <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-zinc-500 font-bold">%</span>
                  </div>
                </div>
                <Button
                  onClick={guardarComision}
                  disabled={comisionGuardando || comisionInput.trim() === String(comisionActual)}
                  className="h-12 px-6 orange-gradient border-none text-white rounded-xl font-heading font-black uppercase text-xs tracking-wide gap-2"
                >
                  {comisionGuardando ? <Loader className="w-4 h-4 animate-spin" /> : comisionGuardada ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
                  {comisionGuardada ? 'Guardada' : 'Guardar'}
                </Button>
              </div>
            </div>

            {comisionError && (
              <p className="text-xs text-red-400 mt-4">{comisionError}</p>
            )}
          </div>
        </motion.div>
      )}


      {/* Users Table */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="mb-8">
        <div className="bg-white/5 rounded-3xl border border-white/10 p-6">
          <h2 className="text-xl font-heading font-black mb-4">
            <span className="text-orange-500">Usuarios</span>
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
            <h2 className="text-xl font-heading font-black">
              <span className="text-orange-500">Eventos</span>
              <span className="text-zinc-500 text-sm font-normal ml-3">
                {eventosFiltrados.length}{eventosFiltrados.length !== events.length ? ` de ${events.length}` : ''}
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

            </div>
          </div>

          {gruposEventos.length === 0 ? (
            <div className="text-center py-12">
              <Calendar className="w-12 h-12 text-muted-foreground mx-auto mb-3 opacity-50" />
              <p className="text-sm text-muted-foreground">
                {events.length === 0
                  ? 'No hay eventos en la base de datos. Creá el primero con el botón de arriba.'
                  : 'Ningún evento coincide con la búsqueda.'}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {gruposEventos.map(grupo => {
                const abierta = seccionesAbiertas[grupo.key] ?? grupo.defecto;
                return (
                  <div
                    key={grupo.key}
                    className={`rounded-2xl border overflow-hidden ${
                      grupo.acento ? 'border-orange-500/30 bg-orange-500/[0.04]' : 'border-white/10 bg-white/[0.02]'
                    }`}
                  >
                    <button
                      onClick={() => alternarSeccion(grupo.key, grupo.defecto)}
                      className="w-full flex items-center justify-between gap-4 px-5 py-4 text-left hover:bg-white/[0.03] transition"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2.5">
                          <ChevronDown
                            className={`w-4 h-4 shrink-0 transition-transform ${abierta ? '' : '-rotate-90'} ${
                              grupo.acento ? 'text-orange-400' : 'text-zinc-500'
                            }`}
                          />
                          <span className={`font-bold text-sm ${grupo.acento ? 'text-orange-400' : 'text-white'}`}>
                            {grupo.titulo}
                          </span>
                          <span className="text-xs text-zinc-500 font-bold">{grupo.eventos.length}</span>
                        </div>
                        <p className="text-[11px] text-zinc-500 mt-1 ml-[26px] truncate">{grupo.ayuda}</p>
                      </div>
                      {!abierta && (
                        <span className="text-[10px] uppercase tracking-widest text-zinc-600 font-bold shrink-0">Ver</span>
                      )}
                    </button>

                    {abierta && (
                      <div className="overflow-x-auto border-t border-white/5">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-white/10">
                              <th className="text-left py-3 px-4 text-zinc-500 font-bold text-xs uppercase tracking-widest">Título</th>
                              <th className="text-left py-3 px-4 text-zinc-500 font-bold text-xs uppercase tracking-widest">Fecha</th>
                              <th className="text-left py-3 px-4 text-zinc-500 font-bold text-xs uppercase tracking-widest">Tickets</th>
                              <th className="text-left py-3 px-4 text-zinc-500 font-bold text-xs uppercase tracking-widest">Estado</th>
                              <th className="text-left py-3 px-4 text-zinc-500 font-bold text-xs uppercase tracking-widest">Comisión</th>
                              <th className="text-left py-3 px-4 text-zinc-500 font-bold text-xs uppercase tracking-widest">Acciones</th>
                            </tr>
                          </thead>
                          <tbody>
                  {grupo.eventos.map(e => {
                    const badge = statusBadge(e.status || 'active');
                    const totalAvailable = (e.tickets || []).reduce((s, t) => s + (t.available || 0), 0);
                    const totalCapacity = (e.tickets || []).reduce((s, t) => s + (t.available || 0), 0);
                    const isDeleted = (e.status || 'active') === 'deleted';
                    return (
                      <tr key={e.id} className="border-b border-white/5 hover:bg-white/5 transition">
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-3">
                            {e.image && e.image !== "" && (
                              <img src={e.image} alt={e.title} className="w-10 h-10 rounded-lg object-cover" referrerPolicy="no-referrer" />
                            )}
                            <div>
                              <p className="text-zinc-200 font-medium">{e.title}</p>
                              <p className="text-xs text-zinc-500">{e.isVenueTBD ? 'Lugar por confirmar' : (e.venue || '—')}{e.location ? `, ${e.location}` : ''}</p>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-zinc-500 text-xs">{e.isDateTBD ? 'PRÓXIMAMENTE' : formatDate(e.date)}</td>
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
                          {/* Se muestra la comisión VIGENTE, que es la que se le va a
                              cobrar a la próxima venta de este evento. Si el evento
                              nació con otra, se aclara abajo como dato histórico: el
                              número grande nunca puede ser uno que no se cobra. */}
                          <div className="flex flex-col">
                            <span className="text-zinc-200 font-bold text-xs">{comisionActual}%</span>
                            {e.commissionRate != null && e.commissionRate !== comisionActual && (
                              <span className="text-[10px] text-zinc-600">se creó con {e.commissionRate}%</span>
                            )}
                          </div>
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
                                {e.status === 'pending' ? (
                                  <button
                                    onClick={() => handleEventStatusChange(e.id, 'active')}
                                    className="px-3 py-1.5 rounded-xl bg-orange-500/20 hover:bg-orange-500/30 border border-orange-500/40 text-orange-400 text-xs font-bold transition flex items-center gap-1"
                                  >
                                    <Check className="w-3.5 h-3.5" /> Publicar
                                  </button>
                                ) : e.status === 'active' ? (
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
                                {['active', 'paused'].includes(e.status || 'active') && (
                                  <button
                                    onClick={() => setConfirmCancel({ id: e.id, title: e.title })}
                                    className="px-3 py-1.5 rounded-xl bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-400 text-xs font-bold transition"
                                    title="Cancelar el evento y avisar por mail a todos los compradores"
                                  >
                                    Cancelar evento
                                  </button>
                                )}
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
                );
              })}
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

      {/* ==================== CONFIRM CANCEL EVENT MODAL ==================== */}
      {confirmCancel && (
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
              <h3 className="text-2xl font-black mb-2">¿Cancelar el evento?</h3>
              <p className="text-zinc-400 text-sm">
                <strong className="text-white">{confirmCancel.title}</strong> se marcará como cancelado, saldrá de la venta y{' '}
                <strong className="text-white">se les avisará por mail a todos los que tienen entradas</strong>. Esta acción no se puede deshacer.
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmCancel(null)}
                disabled={cancellingEvent}
                className="flex-1 px-6 py-4 rounded-2xl bg-white/5 hover:bg-white/10 font-bold transition disabled:opacity-50"
              >
                Volver
              </button>
              <button
                onClick={() => handleCancelEvent(confirmCancel.id)}
                disabled={cancellingEvent}
                className="flex-1 px-6 py-4 rounded-2xl bg-red-600 hover:bg-red-700 text-white font-bold transition disabled:opacity-50"
              >
                {cancellingEvent ? 'Cancelando...' : 'Cancelar y avisar'}
              </button>
            </div>
          </motion.div>
        </div>
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

// Convierte lo que guarda Firebase (Timestamp, un instante absoluto) al formato
// "yyyy-MM-ddTHH:mm" EN HORA LOCAL que espera el input datetime-local.
// Ojo: NUNCA usar toISOString() acá. Devuelve la hora en UTC y en Argentina
// (UTC-3) corría los horarios +3 horas con solo abrir y guardar el evento.
// El camino inverso (guardar) ya es correcto: new Date("yyyy-MM-ddTHH:mm")
// interpreta hora local, igual que la creación de eventos en CreateEvent.
function toDatetimeLocalValue(date: any): string {
  try {
    const d = date?.toDate ? date.toDate() : date?.seconds ? new Date(date.seconds * 1000) : null;
    if (!d || isNaN(d.getTime())) return '';
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  } catch {
    return '';
  }
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
  const [ticketToDelete, setTicketToDelete] = useState<number | null>(null);
  const [showSavedFeedback, setShowSavedFeedback] = useState(false);
  const [dateStr, setDateStr] = useState<string>(() => toDatetimeLocalValue(event.date));
  // Fin del evento (opcional). Mismo patron que el inicio: el input se llena en
  // HORA LOCAL con toDatetimeLocalValue (nunca toISOString, que corria +3hs) y
  // al guardar new Date(str) interpreta hora local.
  const [endDateStr, setEndDateStr] = useState<string>(() => toDatetimeLocalValue(event.endDate));

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
    setTicketToDelete(idx);
  };

  const confirmRemoveTicket = () => {
    if (ticketToDelete === null) return;
    const tickets = [...(form.tickets || [])];
    tickets.splice(ticketToDelete, 1);
    setForm({ ...form, tickets });
    setTicketToDelete(null);
  };

  const handleSubmit = async () => {
    const updated = { ...form };
    if (dateStr) {
      updated.date = new Date(dateStr);
    }
    // Fin del evento (solo eventos de un dia; los multi-dia lo manejan solos)
    if (!event.isMultiDay) {
      if (endDateStr) {
        const end = new Date(endDateStr);
        const start = dateStr ? new Date(dateStr) : (event.date?.toDate ? event.date.toDate() : null);
        if (!isNaN(end.getTime()) && start && end.getTime() <= start.getTime()) {
          alert('El fin del evento no puede ser anterior (ni igual) al inicio. Revisá la fecha y hora de fin.');
          return;
        }
        updated.endDate = end;
      } else {
        // Vacio = borrar el campo: vuelve la regla de inicio + 3 horas
        updated.endDate = null;
      }
    }
    await onSave(updated);
    setShowSavedFeedback(true);
    setTimeout(() => {
      setShowSavedFeedback(false);
    }, 1500);
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

          {/* Fin del evento (opcional, solo eventos de un dia) */}
          {!event.isMultiDay && (
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Fin del evento (opcional)</label>
              <input
                type="datetime-local"
                value={endDateStr}
                onChange={e => setEndDateStr(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-2xl h-12 px-4 text-sm focus:outline-none focus:border-primary/50 [color-scheme:dark]"
              />
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                A esta hora termina la venta y el evento sale de la cartelera. Si lo dejás vacío, se da por finalizado 3 horas después del inicio.
              </p>
            </div>
          )}

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
            {form.image && form.image !== "" && (
              <img src={form.image} alt="preview" className="w-full h-40 object-cover rounded-2xl mt-2" referrerPolicy="no-referrer" />
            )}
          </div>

          {/* Status */}
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Estado</label>
            <div className="flex gap-2 flex-wrap">
              {(['pending', 'active', 'paused', 'scheduled', 'deleted'] as const).map(s => (
                <button
                  key={s}
                  onClick={() => setForm({ ...form, status: s })}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition ${
                    form.status === s
                      ? 'orange-gradient text-white'
                      : 'bg-white/5 border border-white/10 text-muted-foreground hover:text-white'
                  }`}
                >
                  {s === 'pending' ? 'Pendiente' : s === 'active' ? 'Activo' : s === 'paused' ? 'Pausado' : s === 'scheduled' ? 'Programado' : 'Eliminado'}
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
              <div key={idx} className="space-y-2 bg-white/5 border border-white/10 rounded-2xl p-4">
                <div className="grid grid-cols-12 gap-2 items-center">
                  <div className="col-span-11">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 block mb-1">Nombre del sector/entrada</label>
                    <Input
                      placeholder="Ej: General, VIP..."
                      value={t.type}
                      onChange={e => updateTicket(idx, 'type', e.target.value)}
                      className="bg-white/5 border-white/10 h-10 rounded-xl text-sm"
                    />
                  </div>
                  <div className="col-span-1 flex justify-end items-end h-full">
                    <button
                      onClick={() => removeTicketType(idx)}
                      className="w-10 h-10 rounded-xl bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-400 flex items-center justify-center transition-all"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <div className="flex justify-between items-center px-1">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Precio ($)</label>
                      {t.price > 0 && <span className="text-[10px] font-black text-primary">{formatCurrency(t.price)}</span>}
                    </div>
                    <Input
                      type="number"
                      placeholder="0"
                      value={t.price === 0 ? '' : t.price}
                      onChange={e => updateTicket(idx, 'price', e.target.value === '' ? '' : Number(e.target.value))}
                      className="bg-white/5 border-white/10 h-10 rounded-xl text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 block px-1">Disponibles</label>
                    <Input
                      type="number"
                      placeholder="0"
                      value={t.available === 0 ? '' : t.available}
                      onChange={e => updateTicket(idx, 'available', e.target.value === '' ? '' : Number(e.target.value))}
                      className="bg-white/5 border-white/10 h-10 rounded-xl text-sm"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Delete Ticket Confirmation Modal */}
        {ticketToDelete !== null && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-center justify-center p-6">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="bg-zinc-900 border border-white/10 p-8 rounded-[2rem] max-w-sm w-full space-y-6 shadow-2xl"
            >
              <div className="text-center space-y-2">
                <div className="w-16 h-16 bg-red-500/20 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Trash2 className="w-8 h-8" />
                </div>
                <h3 className="text-xl font-black">¿Eliminar sector?</h3>
                <p className="text-sm text-muted-foreground">
                  Estás por eliminar el sector <strong className="text-white">{form.tickets[ticketToDelete]?.type}</strong>. 
                  Esta acción solo se guardará si confirmás los cambios del evento.
                </p>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setTicketToDelete(null)}
                  className="flex-1 px-4 py-3 rounded-xl bg-white/5 hover:bg-white/10 font-bold transition"
                >
                  Cancelar
                </button>
                <button
                  onClick={confirmRemoveTicket}
                  className="flex-1 px-4 py-3 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold transition"
                >
                  Eliminar
                </button>
              </div>
            </motion.div>
          </div>
        )}

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
            className={`flex-1 h-12 font-bold flex items-center justify-center gap-2 border-none ${
              showSavedFeedback 
                ? 'bg-green-500 hover:bg-green-600 text-white' 
                : 'orange-gradient text-white'
            }`}
          >
            {saving ? (
              <Loader className="w-4 h-4 animate-spin" />
            ) : showSavedFeedback ? (
              <Check className="w-4 h-4" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            {saving ? 'Guardando...' : showSavedFeedback ? '¡Guardado!' : 'Guardar cambios'}
          </Button>
        </div>
      </motion.div>
    </div>
  );
}

