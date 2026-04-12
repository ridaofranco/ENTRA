import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Link, useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, BarChart3, Calendar, Clock, DollarSign, Download,
  Edit, Gift, Loader2, MapPin, Minus, Plus, Save, Search, Send, Ticket,
  Trash, Users, Eye, Copy, Check, RotateCcw, AlertTriangle
} from 'lucide-react';
import { 
  doc, 
  getDoc, 
  collection, 
  query, 
  where, 
  getDocs, 
  onSnapshot, 
  updateDoc, 
  addDoc, 
  deleteDoc,
  Timestamp 
} from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { db, auth, handleFirestoreError, OperationType } from '@/src/lib/firebase';
import { useAuth } from '@/src/context/AuthContext';
import { logAction } from '@/src/services/auditService';

interface TicketType {
  type: string;
  price: number;
  available: number;
  description?: string;
}

interface EventData {
  id: string;
  title: string;
  date: any;
  venue: string;
  location: string;
  image: string;
  category: string;
  status: string;
  tickets: TicketType[];
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

interface CourtesyData {
  name: string;
  email: string;
  ticketType: string;
  quantity: number;
  reason: string;
  date: string;
  status: string;
}

export default function EventDashboard() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user: authUser, profile } = useAuth();
  const [user, setUser] = useState<any>(null);
  const [event, setEvent] = useState<EventData | null>(null);
  const [orders, setOrders] = useState<OrderData[]>([]);
  const [tickets, setTickets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'resumen' | 'tickets' | 'cortesias' | 'ventas' | 'asistentes'>('resumen');
  const [isSaving, setIsSaving] = useState(false);
  const [showSavedFeedback, setShowSavedFeedback] = useState(false);
  const [isEditingEvent, setIsEditingEvent] = useState(false);
  const [editForm, setEditForm] = useState<Partial<EventData>>({});

  // Filters for attendees
  const [attendeeSearch, setAttendeeSearch] = useState('');
  const [attendeeStatusFilter, setAttendeeStatusFilter] = useState<'all' | 'checked-in' | 'pending'>('all');
  const [attendeeTypeFilter, setAttendeeTypeFilter] = useState<'all' | 'purchased' | 'courtesy'>('all');
  const [attendeeSectorFilter, setAttendeeSectorFilter] = useState('all');

  // Filters for sales
  const [saleSearch, setSaleSearch] = useState('');
  const [saleStatusFilter, setSaleStatusFilter] = useState<'all' | 'confirmed' | 'pending' | 'cancelled'>('all');

  // New sector form state
  const [newSector, setNewSector] = useState({ type: '', price: 0, available: 0 });

  // Refund bulk confirmation state
  const [bulkRefundConfirm, setBulkRefundConfirm] = useState('');
  const [showBulkRefundModal, setShowBulkRefundModal] = useState(false);
  const [ticketToRefund, setTicketToRefund] = useState<any>(null);
  const [ticketToDelete, setTicketToDelete] = useState<number | null>(null);
  const [courtesyToDelete, setCourtesyToDelete] = useState<string | null>(null);
  const [showRefundEmailConfirm, setShowRefundEmailConfirm] = useState<any>(null);

  // Courtesy form state
  const [courtesyName, setCourtesyName] = useState('');
  const [courtesyEmail, setCourtesyEmail] = useState('');
  const [courtesyPhone, setCourtesyPhone] = useState('');
  const [courtesyDni, setCourtesyDni] = useState('');
  const [courtesyType, setCourtesyType] = useState('');
  const [courtesyQty, setCourtesyQty] = useState(1);
  const [courtesyReason, setCourtesyReason] = useState('');
  const [courtesySendEmail, setCourtesySendEmail] = useState(true);

  // Active tickets (excluding refunded ones)
  const activeTickets = tickets.filter(t => t.status !== 'refunded');

  // Refunded tickets (for KPI adjustments)
  const refundedTickets = tickets.filter(t => t.status === 'refunded');
  const refundedPaidTickets = refundedTickets.filter(t => !t.isCourtesy);
  const refundedCount = refundedPaidTickets.length;
  const refundedRevenue = refundedPaidTickets.reduce((s, t) => s + (Number(t.price) || 0), 0);

  // Courtesies list (excluding refunded)
  const courtesies = activeTickets.filter(t => t.isCourtesy);
  const totalCourtesies = courtesies.length;

  // Permission check — who can refund tickets
  const canRefund =
    profile?.role === 'superadmin' ||
    profile?.role === 'admin' ||
    (profile?.role === 'organizer' && event?.organizerEmail === authUser?.email) ||
    authUser?.email === 'ridaofrancorg@gmail.com';

  // Real-time stats calculation — NET of platform commission AND refunds.
  // Organizers should only see what they actually earn (total - fee). ENTRÁ keeps the fee.
  const grossRevenue = orders.filter(o => o.status === 'confirmed').reduce(
    (sum, o: any) => sum + (Number(o.subtotal) || (Number(o.total) || 0) - (Number(o.fee) || 0)),
    0
  );
  const grossTicketsSold = orders.filter(o => o.status === 'confirmed').reduce((sum, o: any) => {
    return sum + (o.items || []).reduce((s: number, item: any) => s + (item.quantity || 0), 0);
  }, 0);
  const realTotalRevenue = Math.max(0, grossRevenue - refundedRevenue);
  const realTicketsSold = Math.max(0, grossTicketsSold - refundedCount);

  // Filtered attendees
  const filteredAttendees = activeTickets.filter(t => {
    const matchesSearch = 
      t.buyerName?.toLowerCase().includes(attendeeSearch.toLowerCase()) ||
      t.buyerEmail?.toLowerCase().includes(attendeeSearch.toLowerCase()) ||
      t.qrCode?.toLowerCase().includes(attendeeSearch.toLowerCase());
      
    const matchesStatus = 
      attendeeStatusFilter === 'all' || 
      (attendeeStatusFilter === 'checked-in' && t.status === 'used') ||
      (attendeeStatusFilter === 'pending' && t.status !== 'used');
      
    const matchesType = 
      attendeeTypeFilter === 'all' ||
      (attendeeTypeFilter === 'purchased' && !t.isCourtesy) ||
      (attendeeTypeFilter === 'courtesy' && t.isCourtesy);
      
    const matchesSector = 
      attendeeSectorFilter === 'all' || t.ticketType === attendeeSectorFilter;
      
    return matchesSearch && matchesStatus && matchesType && matchesSector;
  });

  // Filtered sales
  const filteredOrders = orders.filter(o => {
    const matchesSearch = 
      o.buyerName?.toLowerCase().includes(saleSearch.toLowerCase()) ||
      o.buyerEmail?.toLowerCase().includes(saleSearch.toLowerCase()) ||
      o.id?.toLowerCase().includes(saleSearch.toLowerCase());
      
    const matchesStatus = 
      saleStatusFilter === 'all' || o.status === saleStatusFilter;
      
    return matchesSearch && matchesStatus;
  });

  // Auth
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      if (firebaseUser) setUser(firebaseUser);
      else navigate('/auth/login');
    });
    return () => unsubscribe();
  }, [navigate]);

  // Load event data with real-time listeners
  useEffect(() => {
    if (!id || !user) return;

    setLoading(true);

    // 1. Event listener
    const unsubEvent = onSnapshot(doc(db, 'events', id), (doc) => {
      if (doc.exists()) {
        setEvent({ id: doc.id, ...doc.data() } as EventData);
      }
      setLoading(false);
    });

    // 2. Orders listener
    const qOrders = query(collection(db, 'orders'), where('eventId', '==', id));
    const unsubOrders = onSnapshot(qOrders, (snap) => {
      const ordersList = snap.docs.map(d => ({ id: d.id, ...d.data() } as OrderData));
      ordersList.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
      setOrders(ordersList);
    });

    // 3. Tickets listener (for courtesies and check-ins)
    const qTickets = query(collection(db, 'tickets'), where('eventId', '==', id));
    const unsubTickets = onSnapshot(qTickets, (snap) => {
      const ticketsList = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setTickets(ticketsList);
    });

    return () => {
      unsubEvent();
      unsubOrders();
      unsubTickets();
    };
  }, [id, user]);

  useEffect(() => {
    if (event) {
      setEditForm({
        title: event.title,
        description: event.description || '',
        venue: event.venue,
        location: event.location,
        category: event.category,
        status: event.status
      });
    }
  }, [event]);

  const handleSaveEventDetails = async () => {
    if (!event) return;
    try {
      setIsSaving(true);
      await updateDoc(doc(db, 'events', event.id), {
        ...editForm,
        updatedAt: Timestamp.now()
      });
      setShowSavedFeedback(true);
      setTimeout(() => {
        setIsEditingEvent(false);
        setShowSavedFeedback(false);
      }, 1500);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `events/${event.id}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleManualSave = async () => {
    if (!event) return;
    try {
      setIsSaving(true);
      // Aunque se guarda auto, hacemos un update final para asegurar y dar feedback
      await updateDoc(doc(db, 'events', event.id), {
        updatedAt: Timestamp.now()
      });
      setShowSavedFeedback(true);
      setTimeout(() => setShowSavedFeedback(false), 3000);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `events/${event.id}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdateTicket = async (idx: number, field: string, value: any) => {
    if (!event) return;
    const newTickets = [...(event.tickets || [])];
    newTickets[idx] = { ...newTickets[idx], [field]: value };
    
    try {
      await updateDoc(doc(db, 'events', event.id), {
        tickets: newTickets,
        updatedAt: Timestamp.now()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `events/${event.id}`);
    }
  };

  const handleRemoveTicket = (idx: number) => {
    setTicketToDelete(idx);
  };

  const confirmRemoveTicket = async () => {
    if (!event || ticketToDelete === null) return;
    
    const newTickets = (event.tickets || []).filter((_, i) => i !== ticketToDelete);
    
    try {
      setIsSaving(true);
      await updateDoc(doc(db, 'events', event.id), {
        tickets: newTickets,
        updatedAt: Timestamp.now()
      });
      setTicketToDelete(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `events/${event.id}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddSector = async () => {
    if (!event || !newSector.type || newSector.available <= 0) {
      alert('Por favor completa el nombre y la cantidad del sector');
      return;
    }

    const newTickets = [...(event.tickets || []), { ...newSector }];
    
    try {
      setIsSaving(true);
      await updateDoc(doc(db, 'events', event.id), {
        tickets: newTickets,
        updatedAt: Timestamp.now()
      });
      setNewSector({ type: '', price: 0, available: 0 });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `events/${event.id}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleGenerateCourtesy = async () => {
    if (!event || !courtesyName || !courtesyEmail || !courtesyType) {
      alert('Por favor completa los campos obligatorios');
      return;
    }

    try {
      setIsSaving(true);
      
      // Generate UUID for QR code
      const generateUUID = () => {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
          const r = (Math.random() * 16) | 0;
          const v = c === 'x' ? r : (r & 0x3) | 0x8;
          return v.toString(16);
        });
      };

      for (let i = 0; i < courtesyQty; i++) {
        const qrCode = generateUUID();
        const ticketData = {
          eventId: event.id,
          eventTitle: event.title,
          buyerName: courtesyName,
          buyerEmail: courtesyEmail,
          buyerPhone: courtesyPhone,
          buyerDni: courtesyDni,
          ticketType: courtesyType,
          price: 0,
          isCourtesy: true,
          courtesyReason: courtesyReason,
          status: 'valid',
          qrCode,
          createdAt: Timestamp.now(),
        };

        await addDoc(collection(db, 'tickets'), ticketData);
      }

      // Log action
      await logAction('GENERATE_COURTESY', 'events', event.id, { 
        name: courtesyName || 'Sin nombre', 
        qty: courtesyQty || 1, 
        type: courtesyType || 'Sin tipo' 
      });

      if (courtesySendEmail) {
        console.log(`Simulating email send to ${courtesyEmail}`);
      }

      alert('Cortesía(s) generada(s) con éxito');
      setCourtesyName('');
      setCourtesyEmail('');
      setCourtesyPhone('');
      setCourtesyDni('');
      setCourtesyType('');
      setCourtesyQty(1);
      setCourtesyReason('');
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'tickets');
    } finally {
      setIsSaving(false);
    }
  };

  const handleResendEmail = async (ticket: any) => {
    try {
      setIsSaving(true);
      // Simulate email resend
      console.log(`Resending email to ${ticket.buyerEmail}`);
      await logAction('RESEND_COURTESY_EMAIL', 'tickets', ticket.id, { email: ticket.buyerEmail || 'Sin email' });
      alert(`Email reenviado a ${ticket.buyerEmail}`);
    } catch (error) {
      console.error('Error resending email:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDownloadTicket = async (ticket: any) => {
    try {
      const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${ticket.qrCode}`;
      const response = await fetch(qrUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `ticket-${ticket.buyerName.replace(/\s+/g, '-').toLowerCase()}-${ticket.qrCode.slice(0, 8)}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error downloading ticket:', error);
      alert('Error al descargar el ticket');
    }
  };

  const handleDeleteCourtesy = (ticketId: string) => {
    setCourtesyToDelete(ticketId);
  };

  const confirmDeleteCourtesy = async () => {
    if (!courtesyToDelete) return;
    try {
      setIsSaving(true);
      await deleteDoc(doc(db, 'tickets', courtesyToDelete));
      await logAction('DELETE_COURTESY', 'tickets', courtesyToDelete);
      setCourtesyToDelete(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `tickets/${courtesyToDelete}`);
    } finally {
      setIsSaving(false);
    }
  };

  // ===== REFUND (soft delete + restore stock) =====
  // Build a friendly refund-in-progress email and return a mailto: URL.
  // We use mailto so the email opens in the user's default mail client
  // (Gmail / Outlook / etc.) — no backend needed.
  const buildRefundMailto = (ticket: any) => {
    if (!event || !ticket?.buyerEmail) return null;
    const eventTitle = event.title || 'tu evento';
    const ticketType = ticket.ticketType || '';
    const price = Number(ticket.price) || 0;
    const buyerName = ticket.buyerName || 'Hola';

    const subject = `Devolución en proceso — ${eventTitle}`;
    const body =
`Hola ${buyerName},

Te confirmamos que tu devolución por la entrada de "${eventTitle}" ${ticketType ? `(${ticketType})` : ''} ${price > 0 ? `por un total de $${price.toLocaleString('es-AR')}` : ''} está en proceso.

El monto será reintegrado al mismo medio de pago que utilizaste al momento de la compra. Tené en cuenta que los tiempos de acreditación dependen de tu banco o tarjeta y, según el medio de pago, pueden variar entre 5 y 15 días hábiles.

Si tenés cualquier consulta sobre tu devolución, respondé a este mismo correo y te ayudamos enseguida.

¡Gracias por elegir ENTRÁ!
El equipo de ENTRÁ`;

    return `mailto:${encodeURIComponent(ticket.buyerEmail)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  };

  // Soft-delete one ticket and restore its stock to the event.
  // Used after refunding a customer manually (e.g. via MercadoPago transfer).
  const handleRefundTicket = async (ticket: any) => {
    if (!event || !canRefund) {
      alert('No tenés permisos para devolver tickets');
      return;
    }
    setTicketToRefund(ticket);
  };

  const confirmRefundTicket = async () => {
    if (!event || !ticketToRefund) return;

    try {
      setIsSaving(true);

      // 1) Soft-delete the ticket
      await updateDoc(doc(db, 'tickets', ticketToRefund.id), {
        status: 'refunded',
        refundedAt: Timestamp.now(),
        refundedBy: authUser?.email || 'unknown',
      });

      // 2) Restore stock to the matching ticket type
      const newTickets = (event.tickets || []).map(t =>
        t.type === ticketToRefund.ticketType
          ? { ...t, available: (Number(t.available) || 0) + 1 }
          : t
      );

      // 3) Update event counters (only for paid tickets, not courtesies)
      const updates: any = {
        tickets: newTickets,
        updatedAt: Timestamp.now(),
      };
      if (!ticketToRefund.isCourtesy) {
        updates.ticketsSold = Math.max(0, (Number(event.ticketsSold) || 0) - 1);
        updates.totalRevenue = Math.max(0, (Number(event.totalRevenue) || 0) - (Number(ticketToRefund.price) || 0));
      }
      await updateDoc(doc(db, 'events', event.id), updates);

      await logAction('REFUND_TICKET', 'tickets', ticketToRefund.id, {
        buyer: ticketToRefund.buyerName || 'Sin nombre',
        type: ticketToRefund.ticketType || 'Sin tipo',
        price: ticketToRefund.price || 0,
        isCourtesy: !!ticketToRefund.isCourtesy,
      });

      // Open the pre-filled refund email in the user's mail client (only for paid tickets)
      if (!ticketToRefund.isCourtesy && ticketToRefund.buyerEmail) {
        setShowRefundEmailConfirm(ticketToRefund);
      } else {
        setTicketToRefund(null);
      }
    } catch (error: any) {
      console.error('Refund error:', error);
      alert(`Error al devolver ticket: ${error.message || 'Error desconocido'}`);
      handleFirestoreError(error, OperationType.UPDATE, `tickets/${ticketToRefund.id}`);
    } finally {
      setIsSaving(false);
    }
  };

  // Bulk refund — soft-delete ALL active tickets of the event and restore all stock.
  // Requires typing the event title as a confirmation to avoid accidents.
  const handleRefundAllTickets = async () => {
    if (!event || !canRefund) {
      alert('No tenés permisos para devolver tickets');
      return;
    }
    if (bulkRefundConfirm.trim() !== event.title.trim()) {
      alert('El nombre del evento no coincide. Escribilo exactamente igual para confirmar.');
      return;
    }
    if (activeTickets.length === 0) {
      alert('No hay tickets activos para devolver');
      setShowBulkRefundModal(false);
      return;
    }

    try {
      setIsSaving(true);

      // Soft-delete every active ticket sequentially
      const now = Timestamp.now();
      const refundedBy = authUser?.email || 'unknown';
      for (const t of activeTickets) {
        await updateDoc(doc(db, 'tickets', t.id), {
          status: 'refunded',
          refundedAt: now,
          refundedBy,
        });
      }

      // Restore all stock: for each type, count active tickets and add back
      const restoredTickets = (event.tickets || []).map(tt => {
        const count = activeTickets.filter(a => a.ticketType === tt.type).length;
        return { ...tt, available: (Number(tt.available) || 0) + count };
      });

      // Zero out paid-ticket counters (courtesies don't contribute anyway)
      const paidCount = activeTickets.filter(a => !a.isCourtesy).length;
      const paidRevenue = activeTickets
        .filter(a => !a.isCourtesy)
        .reduce((s, a) => s + (Number(a.price) || 0), 0);

      await updateDoc(doc(db, 'events', event.id), {
        tickets: restoredTickets,
        ticketsSold: Math.max(0, (Number(event.ticketsSold) || 0) - paidCount),
        totalRevenue: Math.max(0, (Number(event.totalRevenue) || 0) - paidRevenue),
        updatedAt: now,
      });

      await logAction('REFUND_ALL_TICKETS', 'events', event.id, {
        refunded: activeTickets.length,
        paidCount,
        paidRevenue,
      });

      alert(`${activeTickets.length} tickets devueltos. El evento quedó limpio.`);
      setShowBulkRefundModal(false);
      setBulkRefundConfirm('');
    } catch (error: any) {
      console.error('Bulk refund error:', error);
      alert(`Error al devolver tickets: ${error.message || 'Error desconocido'}`);
      handleFirestoreError(error, OperationType.UPDATE, `events/${event.id}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSendWhatsApp = (ticket?: any) => {
    const phone = ticket ? ticket.buyerPhone : courtesyPhone;
    const name = ticket ? ticket.buyerName : courtesyName;
    const type = ticket ? ticket.ticketType : courtesyType;
    
    if (!phone) {
      alert('Por favor declará un número de teléfono');
      return;
    }

    const cleanPhone = phone.replace(/\D/g, '');
    const message = encodeURIComponent(`¡Hola ${name}! Aquí tenés tu cortesía (${type}) para el evento ${event?.title}. ¡Te esperamos!`);
    window.open(`https://wa.me/${cleanPhone}?text=${message}`, '_blank');
  };

  const formatDate = (date: any) => {
    try {
      if (date?.toDate) return date.toDate().toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric' });
      if (date?.seconds) return new Date(date.seconds * 1000).toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric' });
    } catch {}
    return '';
  };

  const formatShortDate = (date: any) => {
    try {
      if (date?.toDate) return date.toDate().toLocaleDateString('es-AR', { day: 'numeric', month: 'short' });
      if (date?.seconds) return new Date(date.seconds * 1000).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' });
    } catch {}
    return '';
  };

  if (loading) {
    return (
      <div className="pt-32 pb-20 px-6 max-w-6xl mx-auto flex flex-col items-center justify-center min-h-[60vh]">
        <Loader2 className="w-10 h-10 text-orange-500 animate-spin mb-4" />
        <p className="text-zinc-400">Cargando evento...</p>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="pt-32 pb-20 px-6 max-w-6xl mx-auto text-center">
        <p className="text-zinc-400">Evento no encontrado</p>
        <Link to="/dashboard" className="text-orange-500 hover:underline mt-4 inline-block">Volver al dashboard</Link>
      </div>
    );
  }

  const totalCap = (event.tickets || []).reduce((s, t) => s + (t.available || 0), 0) + (Number(event.ticketsSold) || 0);
  const soldPercent = totalCap > 0 ? Math.round(((Number(event.ticketsSold) || 0) / totalCap) * 100) : 0;

  const tabs = [
    { key: 'resumen', label: 'Resumen', icon: BarChart3 },
    { key: 'tickets', label: 'Tickets y Capacidad', icon: Ticket },
    { key: 'cortesias', label: 'Cortesías', icon: Gift },
    { key: 'ventas', label: 'Ventas', icon: DollarSign },
    { key: 'asistentes', label: 'Asistentes', icon: Users },
  ] as const;

  return (
    <div className="pt-32 pb-20 px-6 max-w-6xl mx-auto">
      {/* Back link + Header */}
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}>
        <Link to="/dashboard" className="inline-flex items-center gap-1 text-sm text-orange-500 font-bold hover:underline mb-6">
          <ArrowLeft className="w-4 h-4" /> Volver al dashboard
        </Link>

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-2xl md:text-3xl font-black tracking-tight">{event.title}</h1>
              <span className={`text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded-full ${
                event.status === 'active' ? 'bg-green-500/20 text-green-400' : 'bg-zinc-500/20 text-zinc-400'
              }`}>
                {event.status === 'active' ? 'Publicado' : event.status}
              </span>
            </div>
            <div className="flex flex-wrap gap-4 text-zinc-400 text-sm">
              <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5" /> {formatDate(event.date)}</span>
              {event.venue && <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" /> {event.venue}</span>}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setIsEditingEvent(true)}
              className="flex items-center gap-2 bg-white/5 border border-white/10 text-sm font-bold px-4 py-2.5 rounded-xl hover:border-blue-500/30 transition-all text-blue-400"
            >
              <Edit className="w-4 h-4" /> Editar Info
            </button>
            <Link to={`/evento/${event.id}`}>
              <button className="flex items-center gap-2 bg-white/5 border border-white/10 text-sm font-bold px-4 py-2.5 rounded-xl hover:border-orange-500/30 transition-all">
                <Eye className="w-4 h-4" /> Ver página pública
              </button>
            </Link>
            {canRefund && activeTickets.length > 0 && (
              <button
                onClick={() => setShowBulkRefundModal(true)}
                className="flex items-center gap-2 bg-red-500/10 border border-red-500/30 text-sm font-bold px-4 py-2.5 rounded-xl hover:bg-red-500/20 transition-all text-red-400"
                title="Devolver TODOS los tickets y limpiar el evento"
              >
                <AlertTriangle className="w-4 h-4" /> Devolver todos ({activeTickets.length})
              </button>
            )}
          </div>
        </div>
      </motion.div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Tickets Vendidos', value: `${realTicketsSold} / ${totalCap}`, sub: `${totalCap > 0 ? Math.round((realTicketsSold / totalCap) * 100) : 0}% vendido`, icon: Ticket, color: 'text-orange-500', bg: 'bg-orange-500/10' },
          { label: 'Ingresos', value: `$${realTotalRevenue.toLocaleString('es-AR')}`, sub: `$${refundedRevenue.toLocaleString('es-AR')} devueltos · ${orders.filter(o => o.status === 'confirmed').length} transacciones`, icon: DollarSign, color: 'text-green-500', bg: 'bg-green-500/10' },
          { label: 'Cortesías', value: totalCourtesies.toString(), sub: `${totalCourtesies} tickets emitidos`, icon: Gift, color: 'text-purple-500', bg: 'bg-purple-500/10' },
          { label: 'Check-ins', value: activeTickets.filter(t => t.status === 'used').length.toString(), sub: 'Asistentes en el lugar', icon: Users, color: 'text-blue-500', bg: 'bg-blue-500/10' },
        ].map((stat, i) => (
          <motion.div key={i} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}
            className="bg-white/5 rounded-3xl border border-white/10 p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold uppercase tracking-widest text-zinc-500">{stat.label}</span>
              <div className={`${stat.bg} p-2 rounded-xl`}><stat.icon className={`w-4 h-4 ${stat.color}`} /></div>
            </div>
            <p className="text-xl font-black">{stat.value || '0'}</p>
            <p className="text-xs text-zinc-500 mt-1">{stat.sub || ''}</p>
          </motion.div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl font-bold text-xs whitespace-nowrap transition-all ${
              activeTab === tab.key
                ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/20'
                : 'bg-white/5 text-zinc-400 hover:bg-white/10 border border-white/10'
            }`}
          >
            <tab.icon className="w-3.5 h-3.5" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* ==================== RESUMEN ==================== */}
      {activeTab === 'resumen' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="grid gap-6 md:grid-cols-2">
          {/* Ticket breakdown */}
          <div className="bg-white/5 rounded-3xl border border-white/10 p-6">
            <h3 className="font-bold mb-4">Desglose por tipo de ticket</h3>
            <div className="space-y-4">
              {(event.tickets || []).map((ticket, i) => {
                const ticketTotal = (Number(ticket.available) || 0) + Math.round((Number(event.ticketsSold) || 0) * (totalCap > 0 ? ((Number(ticket.available) || 0) / totalCap) : 0));
                const ticketSold = Math.max(0, ticketTotal - (Number(ticket.available) || 0));
                const pct = ticketTotal > 0 ? Math.round((ticketSold / ticketTotal) * 100) : 0;
                const safePct = isNaN(pct) ? 0 : pct;
                return (
                  <div key={i} className="space-y-2">
                    <div className="flex justify-between items-center">
                      <div>
                        <span className="font-bold text-sm">{ticket.type}</span>
                        <span className="text-xs text-zinc-500 ml-2">(${(Number(ticket.price) || 0).toLocaleString('es-AR')} c/u)</span>
                      </div>
                      <span className="text-xs font-bold">{(Number(ticketSold) || 0)}/{(Number(ticketTotal) || 0)}</span>
                    </div>
                    <div className="w-full h-2 bg-white/5 rounded-full overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-orange-500 to-orange-600 rounded-full" style={{ width: `${safePct}%` }} />
                    </div>
                    <p className="text-[10px] text-zinc-500">{safePct}% vendido</p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Recent activity */}
          <div className="bg-white/5 rounded-3xl border border-white/10 p-6">
            <h3 className="font-bold mb-4">Actividad reciente</h3>
            <div className="space-y-3">
              {orders.slice(0, 6).map((order, i) => (
                <div key={i} className="flex justify-between items-start py-2 border-b border-white/5 last:border-0">
                  <div>
                    <p className="text-sm font-bold">{order.buyerName}</p>
                    <p className="text-xs text-zinc-500">
                      {order.items?.map(it => `${it.type} x${it.quantity}`).join(', ')}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold">${order.total?.toLocaleString('es-AR')}</p>
                    <p className="text-[10px] text-zinc-500">{formatShortDate(order.createdAt)}</p>
                  </div>
                </div>
              ))}
              {orders.length === 0 && <p className="text-sm text-zinc-500 text-center py-4">Sin actividad todavía</p>}
            </div>
          </div>
        </motion.div>
      )}

      {/* ==================== TICKETS Y CAPACIDAD ==================== */}
      {activeTab === 'tickets' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
          <div className="bg-white/5 rounded-3xl border border-white/10 p-6">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h3 className="font-bold text-lg">Gestión de Tickets y Capacidad</h3>
                <p className="text-xs text-zinc-500 mt-1">Editá precios, cantidades y agregá nuevos sectores en cualquier momento</p>
              </div>
            </div>

            <div className="space-y-4">
              {(event.tickets || []).map((ticket, i) => {
                const ticketTotal = (Number(ticket.available) || 0) + Math.round((Number(event.ticketsSold) || 0) * ((Number(ticket.available) || 0) / (totalCap || 1)));
                const ticketSold = Math.max(0, ticketTotal - (Number(ticket.available) || 0));
                const pct = ticketTotal > 0 ? Math.round((ticketSold / ticketTotal) * 100) : 0;
                const safePct = isNaN(pct) ? 0 : pct;
                return (
                  <div key={i} className="bg-white/5 rounded-2xl border border-white/10 p-5 space-y-4">
                    <div className="flex justify-between items-center">
                      <h4 className="font-bold">{ticket.type}</h4>
                      <div className="flex items-center gap-2">
                        <span className={`text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded-full ${
                          (Number(ticket.available) || 0) <= 0 ? 'bg-red-500/20 text-red-400' : 'bg-green-500/20 text-green-400'
                        }`}>
                          {(Number(ticket.available) || 0) <= 0 ? 'Agotado' : 'En venta'}
                        </span>
                        <button 
                          onClick={() => handleRemoveTicket(i)}
                          className="text-red-400 hover:text-red-300 p-1"
                        >
                          <Trash className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label className="text-xs text-zinc-500 block mb-1">Precio ($)</label>
                        <input 
                          type="number" 
                          value={ticket.price || 0} 
                          onChange={e => handleUpdateTicket(i, 'price', Number(e.target.value))}
                          className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-orange-500/50" 
                        />
                      </div>
                      <div>
                        <label className="text-xs text-zinc-500 block mb-1">Capacidad total</label>
                        <input 
                          type="number" 
                          value={ticketTotal || 0} 
                          onChange={e => handleUpdateTicket(i, 'available', Number(e.target.value) - ticketSold)}
                          className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-orange-500/50" 
                        />
                        <p className="text-[10px] text-zinc-500 mt-1">{(Number(ticketSold) || 0)} vendidos</p>
                      </div>
                      <div>
                        <label className="text-xs text-zinc-500 block mb-1">Disponibles</label>
                        <div className="flex items-center gap-2 h-10">
                          <span className="text-2xl font-black">{(Number(ticket.available) || 0)}</span>
                          <span className="text-xs text-zinc-500">restantes</span>
                        </div>
                      </div>
                    </div>

                    <div className="w-full h-2 bg-white/5 rounded-full overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-orange-500 to-orange-600 rounded-full" style={{ width: `${safePct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Add new ticket type */}
            <div className="mt-6 border-2 border-dashed border-white/10 rounded-2xl p-6">
              <h4 className="font-bold mb-4 flex items-center gap-2"><Plus className="w-5 h-5" /> Agregar nuevo sector / tipo de ticket</h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="text-xs text-zinc-500 block mb-1">Nombre del sector</label>
                  <input 
                    type="text" 
                    placeholder="Ej: Campo VIP, Platea Alta..." 
                    value={newSector.type}
                    onChange={e => setNewSector({...newSector, type: e.target.value})}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-orange-500/50" 
                  />
                </div>
                <div>
                  <label className="text-xs text-zinc-500 block mb-1">Precio ($)</label>
                  <input 
                    type="number" 
                    placeholder="Ej: 5000" 
                    value={newSector.price}
                    onChange={e => setNewSector({...newSector, price: Number(e.target.value)})}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-orange-500/50" 
                  />
                </div>
                <div>
                  <label className="text-xs text-zinc-500 block mb-1">Cantidad disponible</label>
                  <input 
                    type="number" 
                    placeholder="Ej: 100" 
                    value={newSector.available}
                    onChange={e => setNewSector({...newSector, available: Number(e.target.value)})}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-orange-500/50" 
                  />
                </div>
              </div>
              <button 
                onClick={handleAddSector}
                disabled={isSaving}
                className="mt-4 flex items-center gap-2 bg-gradient-to-r from-orange-500 to-orange-600 text-white font-bold px-5 py-2.5 rounded-xl text-sm disabled:opacity-50"
              >
                <Plus className="w-4 h-4" /> {isSaving ? 'Agregando...' : 'Agregar sector'}
              </button>
            </div>

            {/* Save button */}
            <div className="flex justify-between items-center mt-6 pt-4 border-t border-white/10">
              <p className="text-xs text-zinc-500">Capacidad total: <strong className="text-white">{totalCap} tickets</strong> ({event.ticketsSold || 0} vendidos + {totalCourtesies} cortesías)</p>
              <button 
                onClick={handleManualSave}
                disabled={isSaving}
                className={`flex items-center gap-2 font-bold px-5 py-2.5 rounded-xl text-sm transition-all shadow-lg ${
                  showSavedFeedback 
                    ? 'bg-green-500 text-white shadow-green-500/20' 
                    : 'bg-gradient-to-r from-orange-500 to-orange-600 text-white shadow-orange-500/20'
                }`}
              >
                {isSaving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : showSavedFeedback ? (
                  <Check className="w-4 h-4" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                {isSaving ? 'Guardando...' : showSavedFeedback ? '¡Guardado!' : 'Guardar cambios'}
              </button>
            </div>
          </div>
        </motion.div>
      )}

      {/* ==================== CORTESÍAS ==================== */}
      {activeTab === 'cortesias' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
          <div className="grid gap-6 md:grid-cols-3">
            {/* Courtesy form */}
            <div className="md:col-span-2 bg-white/5 rounded-3xl border border-white/10 p-6">
              <h3 className="font-bold text-lg mb-1">Generar Tickets de Cortesía</h3>
              <p className="text-xs text-zinc-500 mb-6">Emití invitaciones gratuitas. No descuentan del stock de venta pero sí cuentan para la capacidad.</p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-zinc-500 block mb-1">Nombre del invitado</label>
                  <input type="text" placeholder="Nombre completo" value={courtesyName} onChange={e => setCourtesyName(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-orange-500/50" />
                </div>
                <div>
                  <label className="text-xs text-zinc-500 block mb-1">Email del invitado</label>
                  <input type="email" placeholder="email@ejemplo.com" value={courtesyEmail} onChange={e => setCourtesyEmail(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-orange-500/50" />
                </div>
                <div>
                  <label className="text-xs text-zinc-500 block mb-1">WhatsApp / Teléfono</label>
                  <input type="tel" placeholder="Ej: 5491112345678" value={courtesyPhone} onChange={e => setCourtesyPhone(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-orange-500/50" />
                </div>
                <div>
                  <label className="text-xs text-zinc-500 block mb-1">DNI / Documento</label>
                  <input type="text" placeholder="Ej: 35.123.456" value={courtesyDni} onChange={e => setCourtesyDni(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-orange-500/50" />
                </div>
                <div>
                  <label className="text-xs text-zinc-500 block mb-1">Tipo de ticket</label>
                  <select value={courtesyType} onChange={e => setCourtesyType(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-orange-500/50 appearance-none">
                    <option value="">Seleccioná el tipo</option>
                    {(event.tickets || []).map((t, i) => <option key={i} value={t.type}>{t.type}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-zinc-500 block mb-1">Cantidad</label>
                  <div className="flex items-center gap-2">
                    <button onClick={() => setCourtesyQty(Math.max(1, courtesyQty - 1))} className="w-10 h-10 bg-white/5 border border-white/10 rounded-xl flex items-center justify-center hover:border-orange-500/30">
                      <Minus className="w-4 h-4" />
                    </button>
                    <span className="text-lg font-bold w-8 text-center">{courtesyQty}</span>
                    <button onClick={() => setCourtesyQty(courtesyQty + 1)} className="w-10 h-10 bg-white/5 border border-white/10 rounded-xl flex items-center justify-center hover:border-orange-500/30">
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <div>
                  <label className="text-xs text-zinc-500 block mb-1">Motivo (opcional)</label>
                  <input type="text" placeholder="Ej: Prensa, Sponsor, Artista..." value={courtesyReason} onChange={e => setCourtesyReason(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-orange-500/50" />
                </div>
              </div>

              <label className="flex items-center gap-2 mt-4 text-sm text-zinc-400 cursor-pointer">
                <input type="checkbox" checked={courtesySendEmail} onChange={e => setCourtesySendEmail(e.target.checked)} className="rounded" />
                Enviar ticket por email al invitado
              </label>

              <div className="flex gap-3 mt-6">
                <button 
                  onClick={handleGenerateCourtesy}
                  disabled={isSaving}
                  className="flex items-center gap-2 bg-gradient-to-r from-orange-500 to-orange-600 text-white font-bold px-5 py-2.5 rounded-xl text-sm shadow-lg shadow-orange-500/20 disabled:opacity-50"
                >
                  <Gift className="w-4 h-4" /> {isSaving ? 'Generando...' : 'Generar cortesía'}
                </button>
                <button 
                  onClick={() => handleSendWhatsApp()}
                  className="flex items-center gap-2 bg-white/5 border border-white/10 font-bold px-5 py-2.5 rounded-xl text-sm hover:border-green-500/30 text-green-400"
                >
                  <Send className="w-4 h-4" /> Enviar por WhatsApp
                </button>
              </div>
            </div>

            {/* Courtesy summary */}
            <div className="bg-white/5 rounded-3xl border border-white/10 p-6">
              <h3 className="font-bold mb-4">Resumen de cortesías</h3>
              <div className="text-center py-4">
                <div className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-orange-500 to-orange-600">{totalCourtesies}</div>
                <p className="text-xs text-zinc-500">cortesías emitidas</p>
              </div>
              <div className="border-t border-white/10 pt-4 space-y-2">
                {(event.tickets || []).map((t, i) => {
                  const count = courtesies.filter(c => c.ticketType === t.type).reduce((s, c) => s + c.quantity, 0);
                  return (
                    <div key={i} className="flex justify-between text-sm">
                      <span className="text-zinc-400">{t.type}</span>
                      <span className="font-bold">{count}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Courtesy table */}
          <div className="bg-white/5 rounded-3xl border border-white/10 p-6">
            <h3 className="font-bold mb-4">Cortesías emitidas</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/10 text-left">
                    <th className="p-2 text-xs font-bold uppercase tracking-widest text-zinc-500">Invitado</th>
                    <th className="p-2 text-xs font-bold uppercase tracking-widest text-zinc-500">Email</th>
                    <th className="p-2 text-xs font-bold uppercase tracking-widest text-zinc-500">Tipo</th>
                    <th className="p-2 text-xs font-bold uppercase tracking-widest text-zinc-500">Cant.</th>
                    <th className="p-2 text-xs font-bold uppercase tracking-widest text-zinc-500">Motivo</th>
                    <th className="p-2 text-xs font-bold uppercase tracking-widest text-zinc-500">Fecha</th>
                    <th className="p-2 text-xs font-bold uppercase tracking-widest text-zinc-500">Estado</th>
                    <th className="p-2 text-xs font-bold uppercase tracking-widest text-zinc-500">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {courtesies.map((c, i) => (
                    <tr key={i} className="border-b border-white/5">
                      <td className="p-2 font-bold">{c.buyerName}</td>
                      <td className="p-2 text-zinc-400">{c.buyerEmail}</td>
                      <td className="p-2">{c.ticketType}</td>
                      <td className="p-2">1</td>
                      <td className="p-2"><span className="bg-white/5 px-2 py-0.5 rounded text-xs">{c.courtesyReason || '—'}</span></td>
                      <td className="p-2 text-zinc-400">{formatShortDate(c.createdAt)}</td>
                      <td className="p-2">
                        <span className={`text-[10px] font-bold uppercase px-2 py-1 rounded-full ${
                          c.status === 'valid' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                        }`}>{c.status === 'valid' ? 'Válido' : c.status}</span>
                      </td>
                      <td className="p-2">
                        <div className="flex gap-1">
                          <button 
                            onClick={() => handleResendEmail(c)}
                            title="Reenviar Email"
                            className="p-1.5 hover:bg-white/5 rounded-lg"
                          >
                            <Send className="w-3.5 h-3.5 text-zinc-400" />
                          </button>
                          <button 
                            onClick={() => handleDownloadTicket(c)}
                            title="Descargar Ticket"
                            className="p-1.5 hover:bg-white/5 rounded-lg"
                          >
                            <Download className="w-3.5 h-3.5 text-zinc-400" />
                          </button>
                          <button 
                            onClick={() => handleSendWhatsApp(c)}
                            title="Enviar por WhatsApp"
                            className="p-1.5 hover:bg-white/5 rounded-lg"
                          >
                            <Send className="w-3.5 h-3.5 text-green-400" />
                          </button>
                          <button 
                            onClick={() => handleDeleteCourtesy(c.id)}
                            title="Eliminar Cortesía"
                            className="p-1.5 hover:bg-white/5 rounded-lg"
                          >
                            <Trash className="w-3.5 h-3.5 text-red-400" />
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
      )}

      {/* ==================== VENTAS ==================== */}
      {activeTab === 'ventas' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <div className="bg-white/5 rounded-3xl border border-white/10 p-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
              <div>
                <h3 className="font-bold text-lg">Historial de ventas</h3>
                <p className="text-xs text-zinc-500">{filteredOrders.length} transacciones encontradas</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <div className="relative">
                  <input 
                    type="text" 
                    placeholder="Buscar venta..." 
                    value={saleSearch}
                    onChange={e => setSaleSearch(e.target.value)}
                    className="bg-white/5 border border-white/10 rounded-xl px-4 py-2 pl-9 text-xs focus:outline-none focus:border-orange-500/50" 
                  />
                  <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
                </div>
                <select 
                  value={saleStatusFilter}
                  onChange={e => setSaleStatusFilter(e.target.value as any)}
                  className="bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-orange-500/50 appearance-none cursor-pointer"
                >
                  <option value="all">Todos los estados</option>
                  <option value="confirmed">Confirmados</option>
                  <option value="pending">Pendientes</option>
                  <option value="cancelled">Cancelados</option>
                </select>
                <button className="flex items-center gap-2 bg-white/5 border border-white/10 font-bold px-4 py-2 rounded-xl text-xs hover:border-orange-500/30">
                  <Download className="w-3.5 h-3.5" /> Exportar CSV
                </button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/10 text-left">
                    <th className="p-2 text-xs font-bold uppercase tracking-widest text-zinc-500">ID</th>
                    <th className="p-2 text-xs font-bold uppercase tracking-widest text-zinc-500">Comprador</th>
                    <th className="p-2 text-xs font-bold uppercase tracking-widest text-zinc-500">Detalle</th>
                    <th className="p-2 text-xs font-bold uppercase tracking-widest text-zinc-500">Total</th>
                    <th className="p-2 text-xs font-bold uppercase tracking-widest text-zinc-500">Fecha</th>
                    <th className="p-2 text-xs font-bold uppercase tracking-widest text-zinc-500">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredOrders.map((order, i) => (
                    <tr key={i} className="border-b border-white/5">
                      <td className="p-2 font-mono text-xs text-zinc-400">{order.id.slice(0, 8)}</td>
                      <td className="p-2 font-bold">{order.buyerName}</td>
                      <td className="p-2 text-zinc-400">{order.items?.map(it => `${it.type} x${it.quantity}`).join(', ')}</td>
                      <td className="p-2 font-bold">${order.total?.toLocaleString('es-AR')}</td>
                      <td className="p-2 text-zinc-400">{formatShortDate(order.createdAt)}</td>
                      <td className="p-2">
                        <span className={`text-[10px] font-bold uppercase px-2 py-1 rounded-full ${
                          order.status === 'confirmed' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                        }`}>{order.status === 'confirmed' ? 'Completado' : order.status}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filteredOrders.length === 0 && <p className="text-center text-zinc-500 py-8">No se encontraron ventas con los filtros aplicados</p>}
            </div>
          </div>
        </motion.div>
      )}

      {/* ==================== ASISTENTES ==================== */}
      {activeTab === 'asistentes' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <div className="bg-white/5 rounded-3xl border border-white/10 p-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
              <div>
                <h3 className="font-bold text-lg">Lista de asistentes</h3>
                <p className="text-xs text-zinc-500">{filteredAttendees.length} asistentes encontrados</p>
              </div>
              <button className="flex items-center gap-2 bg-white/5 border border-white/10 font-bold px-4 py-2 rounded-xl text-xs hover:border-orange-500/30">
                <Download className="w-3.5 h-3.5" /> Exportar lista
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
              <div className="relative md:col-span-1">
                <input 
                  type="text" 
                  placeholder="Buscar por nombre, email o ID de ticket..." 
                  value={attendeeSearch}
                  onChange={e => setAttendeeSearch(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 pl-10 text-sm focus:outline-none focus:border-orange-500/50" 
                />
                <Search className="w-4 h-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
              </div>
              
              <select 
                value={attendeeStatusFilter}
                onChange={e => setAttendeeStatusFilter(e.target.value as any)}
                className="bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-orange-500/50 appearance-none cursor-pointer"
              >
                <option value="all">Todos los estados</option>
                <option value="checked-in">Ingresados</option>
                <option value="pending">Pendientes</option>
              </select>

              <select 
                value={attendeeTypeFilter}
                onChange={e => setAttendeeTypeFilter(e.target.value as any)}
                className="bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-orange-500/50 appearance-none cursor-pointer"
              >
                <option value="all">Todos los tipos</option>
                <option value="purchased">Ventas</option>
                <option value="courtesy">Cortesías</option>
              </select>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/10 text-left">
                    <th className="p-2 text-xs font-bold uppercase tracking-widest text-zinc-500">Asistente</th>
                    <th className="p-2 text-xs font-bold uppercase tracking-widest text-zinc-500">Email</th>
                    <th className="p-2 text-xs font-bold uppercase tracking-widest text-zinc-500">Tipo</th>
                    <th className="p-2 text-xs font-bold uppercase tracking-widest text-zinc-500">Origen</th>
                    <th className="p-2 text-xs font-bold uppercase tracking-widest text-zinc-500">Check-in</th>
                    {canRefund && (
                      <th className="p-2 text-xs font-bold uppercase tracking-widest text-zinc-500">Acciones</th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {filteredAttendees.map((ticket, idx) => (
                    <tr key={ticket.id || idx} className="border-b border-white/5">
                      <td className="p-2 font-bold">{ticket.buyerName || '—'}</td>
                      <td className="p-2 text-zinc-400">{ticket.buyerEmail || '—'}</td>
                      <td className="p-2">{ticket.ticketType}</td>
                      <td className="p-2">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          ticket.isCourtesy ? 'bg-purple-500/10 text-purple-400' : 'bg-blue-500/10 text-blue-400'
                        }`}>
                          {ticket.isCourtesy ? 'Cortesía' : 'Compra'}
                        </span>
                      </td>
                      <td className="p-2">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          ticket.status === 'used' ? 'bg-green-500/10 text-green-400' : 'bg-yellow-500/10 text-yellow-400'
                        }`}>
                          {ticket.status === 'used' ? 'Ingresó' : 'Pendiente'}
                        </span>
                      </td>
                      {canRefund && (
                        <td className="p-2">
                          <button
                            onClick={() => handleRefundTicket(ticket)}
                            disabled={isSaving}
                            title={ticket.isCourtesy ? 'Devolver cortesía' : 'Devolver ticket (refund)'}
                            className="flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/20 disabled:opacity-50"
                          >
                            <RotateCcw className="w-3 h-3" />
                            Devolver
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
              {filteredAttendees.length === 0 && <p className="text-center text-zinc-500 py-8">No se encontraron asistentes con los filtros aplicados</p>}
            </div>
          </div>
        </motion.div>
      )}

      {/* ==================== EDIT EVENT MODAL ==================== */}
      {isEditingEvent && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-6">
          <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
            className="bg-zinc-900 border border-white/10 p-8 rounded-[2.5rem] max-w-lg w-full space-y-6 max-h-[90vh] overflow-y-auto">
            <h3 className="text-2xl font-black">Editar Información del Evento</h3>
            
            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold uppercase tracking-widest text-zinc-500 block mb-1">Título</label>
                <input type="text" value={editForm.title} onChange={e => setEditForm({...editForm, title: e.target.value})}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-orange-500/50" />
              </div>
              <div>
                <label className="text-xs font-bold uppercase tracking-widest text-zinc-500 block mb-1">Lugar</label>
                <input type="text" value={editForm.venue} onChange={e => setEditForm({...editForm, venue: e.target.value})}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-orange-500/50" />
              </div>
              <div>
                <label className="text-xs font-bold uppercase tracking-widest text-zinc-500 block mb-1">Ciudad</label>
                <input type="text" value={editForm.location} onChange={e => setEditForm({...editForm, location: e.target.value})}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-orange-500/50" />
              </div>
              <div>
                <label className="text-xs font-bold uppercase tracking-widest text-zinc-500 block mb-1">Descripción</label>
                <textarea rows={4} value={editForm.description} onChange={e => setEditForm({...editForm, description: e.target.value})}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-orange-500/50 resize-none" />
              </div>
            </div>

            <div className="flex gap-3 pt-4">
              <button onClick={() => setIsEditingEvent(false)} className="flex-1 px-6 py-3 rounded-2xl bg-white/5 hover:bg-white/10 font-bold transition">
                Cancelar
              </button>
              <button 
                onClick={handleSaveEventDetails} 
                disabled={isSaving}
                className={`flex-1 px-6 py-3 rounded-2xl font-bold transition flex items-center justify-center gap-2 ${
                  showSavedFeedback 
                    ? 'bg-green-500 text-white' 
                    : 'bg-gradient-to-r from-orange-500 to-orange-600 text-white shadow-lg shadow-orange-500/20'
                } disabled:opacity-50`}
              >
                {isSaving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : showSavedFeedback ? (
                  <Check className="w-4 h-4" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                {isSaving ? 'Guardando...' : showSavedFeedback ? '¡Guardado!' : 'Guardar Cambios'}
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* ==================== BULK REFUND MODAL ==================== */}
      {showBulkRefundModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-6">
          <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
            className="bg-zinc-900 border border-red-500/30 p-8 rounded-[2.5rem] max-w-lg w-full space-y-6">
            <div className="flex items-center gap-3">
              <div className="bg-red-500/20 p-3 rounded-2xl">
                <AlertTriangle className="w-6 h-6 text-red-400" />
              </div>
              <h3 className="text-2xl font-black text-red-400">Devolver TODOS los tickets</h3>
            </div>

            <div className="bg-red-500/5 border border-red-500/20 rounded-2xl p-4 space-y-2 text-sm">
              <p className="text-zinc-300">
                Estás por devolver <strong className="text-red-400">{activeTickets.length} tickets</strong> del evento <strong>{event.title}</strong>.
              </p>
              <p className="text-zinc-400 text-xs">
                Esto marcará todos los tickets como devueltos, restaurará el stock del evento y limpiará los contadores de ventas. Los tickets NO se eliminan de la base de datos (queda el registro de auditoría).
              </p>
              <p className="text-yellow-400 text-xs font-bold pt-2">
                ⚠️ Asegurate de haber devuelto el dinero a cada cliente por MercadoPago ANTES de confirmar.
              </p>
            </div>

            <div>
              <label className="text-xs font-bold uppercase tracking-widest text-zinc-500 block mb-2">
                Para confirmar, escribí el nombre exacto del evento:
              </label>
              <p className="text-xs text-zinc-400 mb-2 font-mono">{event.title}</p>
              <input
                type="text"
                value={bulkRefundConfirm}
                onChange={e => setBulkRefundConfirm(e.target.value)}
                placeholder="Escribí el nombre del evento..."
                className="w-full bg-white/5 border border-red-500/30 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-red-500/60"
              />
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => { setShowBulkRefundModal(false); setBulkRefundConfirm(''); }}
                className="flex-1 px-6 py-3 rounded-2xl bg-white/5 hover:bg-white/10 font-bold transition"
              >
                Cancelar
              </button>
              <button
                onClick={handleRefundAllTickets}
                disabled={isSaving || bulkRefundConfirm.trim() !== event.title.trim()}
                className="flex-1 px-6 py-3 rounded-2xl bg-gradient-to-r from-red-600 to-red-700 text-white font-bold transition disabled:opacity-30 disabled:cursor-not-allowed"
              >
                {isSaving ? 'Devolviendo...' : `Devolver ${activeTickets.length} tickets`}
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* ==================== SINGLE REFUND MODAL ==================== */}
      {ticketToRefund && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-6">
          <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
            className="bg-zinc-900 border border-white/10 p-8 rounded-[2.5rem] max-w-lg w-full space-y-6">
            <div className="flex items-center gap-3">
              <div className="bg-orange-500/20 p-3 rounded-2xl">
                <RotateCcw className="w-6 h-6 text-orange-400" />
              </div>
              <h3 className="text-2xl font-black">Devolver Ticket</h3>
            </div>

            <div className="space-y-4">
              <div className="bg-white/5 rounded-2xl p-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-zinc-500">Asistente:</span>
                  <span className="font-bold">{ticketToRefund.buyerName}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-zinc-500">Tipo:</span>
                  <span className="font-bold">{ticketToRefund.ticketType}</span>
                </div>
                {!ticketToRefund.isCourtesy && (
                  <div className="flex justify-between text-sm">
                    <span className="text-zinc-500">Precio:</span>
                    <span className="font-bold text-orange-400">${(ticketToRefund.price || 0).toLocaleString('es-AR')}</span>
                  </div>
                )}
              </div>

              <p className="text-sm text-zinc-400">
                {ticketToRefund.isCourtesy 
                  ? '¿Estás seguro de devolver esta cortesía? El stock volverá al evento.'
                  : 'Asegurate de haber devuelto el dinero al cliente por MercadoPago antes de confirmar. El ticket quedará invalidado y el stock volverá al evento.'}
              </p>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setTicketToRefund(null)}
                className="flex-1 px-6 py-3 rounded-2xl bg-white/5 hover:bg-white/10 font-bold transition"
              >
                Cancelar
              </button>
              <button
                onClick={confirmRefundTicket}
                disabled={isSaving}
                className="flex-1 px-6 py-3 rounded-2xl bg-gradient-to-r from-orange-500 to-orange-600 text-white font-bold transition disabled:opacity-50"
              >
                {isSaving ? 'Procesando...' : 'Confirmar Devolución'}
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* ==================== DELETE TICKET MODAL ==================== */}
      {ticketToDelete !== null && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-6">
          <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
            className="bg-zinc-900 border border-white/10 p-8 rounded-[2.5rem] max-w-md w-full space-y-6">
            <div className="flex items-center gap-3">
              <div className="bg-red-500/20 p-3 rounded-2xl">
                <Trash className="w-6 h-6 text-red-400" />
              </div>
              <h3 className="text-2xl font-black">Eliminar Sector</h3>
            </div>
            <p className="text-sm text-zinc-400">
              ¿Estás seguro de eliminar el sector <strong className="text-white">{event.tickets[ticketToDelete]?.type}</strong>? 
              Esta acción no se puede deshacer y el sector dejará de estar disponible para la venta.
            </p>
            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setTicketToDelete(null)}
                className="flex-1 px-6 py-3 rounded-2xl bg-white/5 hover:bg-white/10 font-bold transition"
              >
                Cancelar
              </button>
              <button
                onClick={confirmRemoveTicket}
                disabled={isSaving}
                className="flex-1 px-6 py-3 rounded-2xl bg-red-600 text-white font-bold transition disabled:opacity-50"
              >
                {isSaving ? 'Eliminando...' : 'Eliminar Sector'}
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* ==================== DELETE COURTESY MODAL ==================== */}
      {courtesyToDelete !== null && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-6">
          <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
            className="bg-zinc-900 border border-white/10 p-8 rounded-[2.5rem] max-w-md w-full space-y-6">
            <div className="flex items-center gap-3">
              <div className="bg-red-500/20 p-3 rounded-2xl">
                <Trash className="w-6 h-6 text-red-400" />
              </div>
              <h3 className="text-2xl font-black">Eliminar Cortesía</h3>
            </div>
            <p className="text-sm text-zinc-400">
              ¿Estás seguro de eliminar esta cortesía? El ticket quedará invalidado permanentemente.
            </p>
            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setCourtesyToDelete(null)}
                className="flex-1 px-6 py-3 rounded-2xl bg-white/5 hover:bg-white/10 font-bold transition"
              >
                Cancelar
              </button>
              <button
                onClick={confirmDeleteCourtesy}
                disabled={isSaving}
                className="flex-1 px-6 py-3 rounded-2xl bg-red-600 text-white font-bold transition disabled:opacity-50"
              >
                {isSaving ? 'Eliminando...' : 'Eliminar Cortesía'}
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* ==================== REFUND EMAIL CONFIRM MODAL ==================== */}
      {showRefundEmailConfirm && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-6">
          <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
            className="bg-zinc-900 border border-white/10 p-8 rounded-[2.5rem] max-w-md w-full space-y-6">
            <div className="flex items-center gap-3">
              <div className="bg-blue-500/20 p-3 rounded-2xl">
                <Send className="w-6 h-6 text-blue-400" />
              </div>
              <h3 className="text-2xl font-black">Notificar al Cliente</h3>
            </div>
            <p className="text-sm text-zinc-400">
              Ticket de <strong className="text-white">{showRefundEmailConfirm.buyerName}</strong> devuelto correctamente.
              ¿Querés abrir tu cliente de email para avisarle que su devolución está en proceso?
            </p>
            <div className="flex gap-3 pt-2">
              <button
                onClick={() => { setTicketToRefund(null); setShowRefundEmailConfirm(null); }}
                className="flex-1 px-6 py-3 rounded-2xl bg-white/5 hover:bg-white/10 font-bold transition"
              >
                No, cerrar
              </button>
              <button
                onClick={async () => {
                  const mailtoUrl = buildRefundMailto(showRefundEmailConfirm);
                  if (mailtoUrl) {
                    window.open(mailtoUrl, '_blank');
                    await logAction('SEND_REFUND_EMAIL', 'tickets', showRefundEmailConfirm.id, { email: showRefundEmailConfirm.buyerEmail || 'Sin email' });
                  }
                  setTicketToRefund(null);
                  setShowRefundEmailConfirm(null);
                }}
                className="flex-1 px-6 py-3 rounded-2xl bg-blue-600 text-white font-bold transition"
              >
                Sí, enviar email
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}


