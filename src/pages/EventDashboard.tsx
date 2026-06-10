import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Link, useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, BarChart3, Calendar, Clock, DollarSign, Download,
  Edit, Gift, Loader2, MapPin, Minus, Plus, Save, Search, Send, Ticket,
  Trash, Users, Eye, Copy, Check, RotateCcw, AlertTriangle, Tag, Percent, Sparkles, Mail, Scan,
  Upload, Image as ImageIcon, Link as LinkIcon, Trash2
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
import { formatCurrency } from '@/src/lib/utils';
import { uploadEventImage } from '@/src/lib/imageUpload';
import { EVENT_CATEGORIES } from '@/src/lib/categories';

interface TicketType {
  type: string;
  price: number;
  available: number;
  description?: string;
  isEarlyBird?: boolean;
}

interface EventData {
  id: string;
  title: string;
  description?: string;
  date: any;
  endDate?: any;
  venue: string;
  location: string;
  image: string;
  category: string;
  status: string;
  tickets: TicketType[];
  ticketsSold: number;
  totalRevenue: number;
  organizerEmail: string;
  officialSaleLaunched?: boolean;
  isMultiDay?: boolean;
  days?: Array<{ date: any; startTime?: string; endTime?: string }>;
  entryMode?: 'per_day' | 'whole_event';
  isFree?: boolean;
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

// =================== CSV EXPORT HELPERS ===================

// Escapa un valor para CSV: envuelve en comillas si tiene coma, comillas o salto de línea
const csvEscape = (val: any): string => {
  if (val === null || val === undefined) return '';
  const str = String(val);
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
};

// Convierte un array de objetos a string CSV con headers
const toCsv = (rows: Record<string, any>[], headers: { key: string; label: string }[]): string => {
  const headerLine = headers.map(h => csvEscape(h.label)).join(',');
  const lines = rows.map(row =>
    headers.map(h => csvEscape(row[h.key])).join(',')
  );
  return [headerLine, ...lines].join('\n');
};

// Dispara la descarga del CSV con BOM para que Excel abra los acentos bien
const downloadCsv = (csv: string, filename: string) => {
  const bom = '\uFEFF'; // UTF-8 BOM para Excel
  const blob = new Blob([bom + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

// Formatea un timestamp de Firestore o Date para CSV (dd/mm/yyyy hh:mm)
const formatCsvDate = (val: any): string => {
  if (!val) return '';
  try {
    const d = val?.toDate ? val.toDate() : new Date(val);
    if (isNaN(d.getTime())) return '';
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = d.getFullYear();
    const hh = String(d.getHours()).padStart(2, '0');
    const mi = String(d.getMinutes()).padStart(2, '0');
    return `${dd}/${mm}/${yyyy} ${hh}:${mi}`;
  } catch {
    return '';
  }
};

export default function EventDashboard() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user: authUser, profile } = useAuth();
  const [user, setUser] = useState<any>(null);
  const [event, setEvent] = useState<EventData | null>(null);
  const [orders, setOrders] = useState<OrderData[]>([]);
  const [tickets, setTickets] = useState<any[]>([]);
  const [discountCodes, setDiscountCodes] = useState<any[]>([]);
  const [emailLogs, setEmailLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'resumen' | 'tickets' | 'cortesias' | 'ventas' | 'asistentes' | 'descuentos' | 'envios'>('resumen');
  const [isSaving, setIsSaving] = useState(false);
  const [showSavedFeedback, setShowSavedFeedback] = useState(false);
  const [isEditingEvent, setIsEditingEvent] = useState(false);
  const [editForm, setEditForm] = useState<Partial<EventData>>({});
  // Estado editable de fechas / multi-día / gratis-pago / imagen
  const [editIsMultiDay, setEditIsMultiDay] = useState(false);
  const [editIsFree, setEditIsFree] = useState(false);
  const [editEntryMode, setEditEntryMode] = useState<'per_day' | 'whole_event'>('whole_event');
  const [editDate, setEditDate] = useState('');
  const [editTime, setEditTime] = useState('');
  const [editDays, setEditDays] = useState<Array<{ date: string; startTime: string; endTime: string }>>([]);
  const [editImageUploading, setEditImageUploading] = useState(false);
  const [editImageError, setEditImageError] = useState('');
  const [saveError, setSaveError] = useState('');

  // Discount form state
  const [discountForm, setDiscountForm] = useState({
    code: '',
    type: 'percentage' as 'percentage' | 'fixed',
    value: 0,
    maxUses: '',
    validUntil: ''
  });
  const [creatingDiscount, setCreatingDiscount] = useState(false);
  const [discountFormError, setDiscountFormError] = useState<string | null>(null);

  // Filters for attendees
  const [attendeeSearch, setAttendeeSearch] = useState('');
  const [attendeeStatusFilter, setAttendeeStatusFilter] = useState<'all' | 'checked-in' | 'pending'>('all');
  const [attendeeTypeFilter, setAttendeeTypeFilter] = useState<'all' | 'purchased' | 'courtesy'>('all');
  const [attendeeSectorFilter, setAttendeeSectorFilter] = useState('all');

  // Filters for sales
  const [saleSearch, setSaleSearch] = useState('');
  const [saleStatusFilter, setSaleStatusFilter] = useState<'all' | 'confirmed' | 'pending' | 'cancelled'>('all');

  // New sector form state
  const [newSector, setNewSector] = useState({ type: '', price: '' as any, available: '' as any });
  // Aviso de capacidad (no se puede dejar el evento sin entradas a la venta)
  const [capacityWarning, setCapacityWarning] = useState('');

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

  // Stats calculados desde la colección de TICKETS (fuente de verdad), no desde
  // orders, para que las devoluciones se reflejen siempre. El organizador cobra
  // el precio base de cada ticket válido (no cortesía, no devuelto/cancelado).
  const paidActiveTickets = activeTickets.filter(t => !t.isCourtesy);
  const realTicketsSold = paidActiveTickets.length;
  const realTotalRevenue = paidActiveTickets.reduce((s, t) => s + (Number(t.price) || 0), 0);
  const validOrdersCount = new Set(paidActiveTickets.map(t => t.orderId).filter(Boolean)).size;

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

    // 4. Discount codes listener
    const qDiscounts = query(collection(db, 'discount_codes'), where('eventId', '==', id));
    const unsubDiscounts = onSnapshot(qDiscounts, (snap) => {
      const discountsList = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      // Ordenar por activos primero, luego por fecha de creación
      discountsList.sort((a: any, b: any) => {
        if (a.active !== b.active) return a.active ? -1 : 1;
        return (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0);
      });
      setDiscountCodes(discountsList);
    });

    // 5. Email logs listener (registro de envíos de confirmación)
    const qEmailLogs = query(collection(db, 'email_logs'), where('eventId', '==', id));
    const unsubEmailLogs = onSnapshot(qEmailLogs, (snap) => {
      const logsList = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      logsList.sort((a: any, b: any) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
      setEmailLogs(logsList);
    }, (err) => {
      // Si la regla de Firestore aún no fue publicada, no rompemos el dashboard.
      console.error('[EventDashboard] No se pudieron leer email_logs:', err);
    });

    return () => {
      unsubEvent();
      unsubOrders();
      unsubTickets();
      unsubDiscounts();
      unsubEmailLogs();
    };
  }, [id, user]);

  // No re-poblamos el form mientras se está editando (evita pisar cambios en curso
  // si llega una actualización en tiempo real del evento).
  useEffect(() => {
    if (event && !isEditingEvent) {
      setEditForm({
        title: event.title,
        description: event.description || '',
        venue: event.venue,
        location: event.location,
        category: event.category,
        status: event.status,
        image: event.image || ''
      });
    }
  }, [event, isEditingEvent]);

  // ---- Helpers de fecha ----
  const pad2 = (n: number) => String(n).padStart(2, '0');
  const tsToParts = (ts: any): { date: string; time: string } => {
    const d = ts?.toDate ? ts.toDate() : (ts?.seconds ? new Date(ts.seconds * 1000) : null);
    if (!d || isNaN(d.getTime())) return { date: '', time: '' };
    // Año 2100 = "a confirmar", no lo mostramos
    if (d.getFullYear() >= 2100) return { date: '', time: '' };
    return {
      date: `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`,
      time: `${pad2(d.getHours())}:${pad2(d.getMinutes())}`
    };
  };

  // Abre el editor tomando una "foto" del evento actual
  const openEditor = () => {
    if (!event) return;
    setEditImageError('');
    setEditForm({
      title: event.title,
      description: event.description || '',
      venue: event.venue,
      location: event.location,
      category: event.category,
      status: event.status,
      image: event.image || ''
    });
    setEditIsMultiDay(Boolean(event.isMultiDay));
    setEditIsFree(Boolean(event.isFree));
    setEditEntryMode(event.entryMode === 'per_day' ? 'per_day' : 'whole_event');
    const main = tsToParts(event.date);
    setEditDate(main.date);
    setEditTime(main.time);
    if (event.isMultiDay && Array.isArray(event.days) && event.days.length > 0) {
      setEditDays(event.days.map((d: any) => {
        const p = tsToParts(d.date);
        return { date: p.date, startTime: d.startTime || p.time || '', endTime: d.endTime || '' };
      }));
    } else {
      setEditDays([{ date: main.date, startTime: main.time, endTime: '' }]);
    }
    setIsEditingEvent(true);
  };

  const addEditDay = () => setEditDays(prev => [...prev, { date: '', startTime: '', endTime: '' }]);
  const removeEditDay = (i: number) => setEditDays(prev => (prev.length > 1 ? prev.filter((_, idx) => idx !== i) : prev));
  const updateEditDay = (i: number, patch: Partial<{ date: string; startTime: string; endTime: string }>) =>
    setEditDays(prev => prev.map((d, idx) => (idx === i ? { ...d, ...patch } : d)));

  const handleEditImageFile = async (file: File | undefined) => {
    if (!file) return;
    setEditImageError('');
    setEditImageUploading(true);
    try {
      const { url } = await uploadEventImage(file, event?.id || 'event');
      setEditForm(f => ({ ...f, image: url }));
    } catch (err) {
      setEditImageError(err instanceof Error ? err.message : 'No se pudo subir la imagen.');
    } finally {
      setEditImageUploading(false);
    }
  };

  const handleSaveEventDetails = async () => {
    if (!event) return;
    try {
      setIsSaving(true);
      setSaveError('');

      const update: any = {
        title: editForm.title,
        description: editForm.description || '',
        venue: editForm.venue,
        location: editForm.location,
        category: editForm.category,
        status: editForm.status,
        image: editForm.image || '',
        isFree: editIsFree,
        isMultiDay: editIsMultiDay,
        updatedAt: Timestamp.now()
      };

      // Si se marca gratuito, ponemos los precios en 0 (igual que al crear el evento)
      // para que no quede ningún precio viejo colgado en las filas de tickets.
      if (editIsFree && Array.isArray(event.tickets)) {
        update.tickets = event.tickets.map((t: any) => ({ ...t, price: 0 }));
        update.price = 0;
      }

      if (editIsMultiDay) {
        const built = editDays
          .filter(d => d.date)
          .map(d => {
            const st = d.startTime || '00:00';
            return {
              date: Timestamp.fromDate(new Date(`${d.date}T${st}:00`)),
              startTime: st,
              endTime: d.endTime || ''
            };
          })
          .sort((a, b) => a.date.seconds - b.date.seconds);
        if (built.length === 0) {
          setEditImageError('Agregá al menos un día con fecha.');
          setIsSaving(false);
          return;
        }
        update.days = built;
        update.date = built[0].date;
        update.endDate = built[built.length - 1].date;
        update.entryMode = editEntryMode;
      } else {
        if (editDate) {
          update.date = Timestamp.fromDate(new Date(`${editDate}T${(editTime || '00:00')}:00`));
        }
        update.isMultiDay = false;
      }

      // Defensa: Firestore rechaza valores undefined → los quitamos
      Object.keys(update).forEach(k => { if (update[k] === undefined) delete update[k]; });

      await updateDoc(doc(db, 'events', event.id), update);
      setShowSavedFeedback(true);
      setTimeout(() => {
        setIsEditingEvent(false);
        setShowSavedFeedback(false);
      }, 1500);
    } catch (error: any) {
      const raw = String(error?.message || error || '');
      let msg = 'No se pudo guardar. Probá de nuevo.';
      if (raw.toLowerCase().includes('permission') || raw.toLowerCase().includes('insufficient')) {
        msg = 'No se pudo guardar por permisos de la base de datos. Reintentá; si persiste, hay que republicar las reglas de Firestore.';
      } else if (raw.toLowerCase().includes('undefined') || raw.toLowerCase().includes('invalid')) {
        msg = 'No se pudo guardar: un campo quedó vacío o inválido. Revisá fecha, días y ubicación.';
      } else if (raw) {
        msg = 'No se pudo guardar: ' + raw.slice(0, 140);
      }
      setSaveError(msg);
      console.error('[handleSaveEventDetails]', error);
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

    // No permitir que el evento quede sin capacidad: la capacidad total
    // (disponibles + ya vendidos) debe ser mayor a 1. No bloquea el caso
    // "agotado" porque ahí los vendidos mantienen la capacidad total alta.
    if (field === 'available') {
      const newTotalCap =
        newTickets.reduce((s, t) => s + (Number(t.available) || 0), 0) +
        (Number(event.ticketsSold) || 0);
      if (newTotalCap <= 1) {
        setCapacityWarning('El evento no puede quedar sin entradas: dejá más de 1 en la capacidad total.');
        return; // no guardamos este cambio
      }
    }
    setCapacityWarning('');

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

    // No permitir quedarse sin capacidad al eliminar un sector
    const remainingCap =
      newTickets.reduce((s, t) => s + (Number(t.available) || 0), 0) +
      (Number(event.ticketsSold) || 0);
    if (newTickets.length === 0 || remainingCap <= 1) {
      alert('No podés eliminar este sector: el evento quedaría sin entradas a la venta. Tiene que haber más de 1 entrada en total.');
      setTicketToDelete(null);
      return;
    }

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

      const newTickets = [...(event.tickets || []), { 
        ...newSector,
        price: Number(newSector.price) || 0,
        available: Number(newSector.available) || 0
      }];
      
      try {
        setIsSaving(true);
        await updateDoc(doc(db, 'events', event.id), {
          tickets: newTickets,
          updatedAt: Timestamp.now()
        });
        setNewSector({ type: '', price: '' as any, available: '' as any });
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

  // =================== EXPORT HANDLERS ===================

  const handleExportAttendees = () => {
    if (!event) return;
    if (!tickets || tickets.length === 0) {
      alert('No hay asistentes para exportar todavía.');
      return;
    }

    // Ordenamos por fecha de compra descendente (más recientes primero)
    const sorted = [...tickets].sort((a, b) => {
      const at = a.createdAt?.seconds || 0;
      const bt = b.createdAt?.seconds || 0;
      return bt - at;
    });

    const rows = sorted.map((t: any) => ({
      nombre: t.buyerName || '',
      email: t.buyerEmail || '',
      dni: t.buyerDni || t.buyerDNI || '',
      telefono: t.buyerPhone || '',
      tipo: t.ticketType || '',
      origen: t.isCourtesy ? 'Cortesía' : 'Compra',
      precio: typeof t.price === 'number' ? t.price : '',
      codigoTicket: t.qrCode || t.id || '',
      fechaCompra: formatCsvDate(t.createdAt),
      estadoCheckIn: t.status === 'used' ? 'Ingresó' : (t.status === 'valid' ? 'Pendiente' : (t.status || '')),
      transferido: t.transferredFrom ? `Sí (de ${t.transferredFrom})` : 'No',
    }));

    const headers = [
      { key: 'nombre', label: 'Nombre' },
      { key: 'email', label: 'Email' },
      { key: 'dni', label: 'DNI' },
      { key: 'telefono', label: 'Teléfono' },
      { key: 'tipo', label: 'Tipo de ticket' },
      { key: 'origen', label: 'Origen' },
      { key: 'precio', label: 'Precio' },
      { key: 'codigoTicket', label: 'Código de ticket' },
      { key: 'fechaCompra', label: 'Fecha de compra' },
      { key: 'estadoCheckIn', label: 'Check-in' },
      { key: 'transferido', label: 'Transferido' },
    ];

    const csv = toCsv(rows, headers);
    const safeTitle = (event.title || 'evento').replace(/[^a-zA-Z0-9]+/g, '-').toLowerCase();
    const today = new Date().toISOString().slice(0, 10);
    downloadCsv(csv, `asistentes-${safeTitle}-${today}.csv`);

    // Audit trail
    logAction('EXPORT_ATTENDEES_CSV', 'events', event.id, { count: rows.length });
  };

  const handleExportSales = () => {
    if (!event) return;
    if (!orders || orders.length === 0) {
      alert('No hay ventas para exportar todavía.');
      return;
    }

    const sorted = [...orders].sort((a, b) => {
      const at = a.createdAt?.seconds || 0;
      const bt = b.createdAt?.seconds || 0;
      return bt - at;
    });

    const rows = sorted.map((o: any) => ({
      idOrden: (o.id || '').slice(0, 12),
      comprador: o.buyerName || '',
      email: o.buyerEmail || '',
      detalle: (o.items || []).map((it: any) => `${it.type} x${it.quantity}`).join(' | '),
      cantidad: (o.items || []).reduce((s: number, it: any) => s + (Number(it.quantity) || 0), 0),
      subtotal: typeof o.subtotal === 'number' ? o.subtotal : '',
      comision: typeof o.commission === 'number' ? o.commission : '',
      total: typeof o.total === 'number' ? o.total : '',
      fecha: formatCsvDate(o.createdAt),
      estado: o.status === 'confirmed' ? 'Completado' : (o.status || ''),
      metodoPago: o.paymentMethod || '',
    }));

    const headers = [
      { key: 'idOrden', label: 'ID Orden' },
      { key: 'comprador', label: 'Comprador' },
      { key: 'email', label: 'Email' },
      { key: 'detalle', label: 'Detalle' },
      { key: 'cantidad', label: 'Cantidad' },
      { key: 'subtotal', label: 'Subtotal' },
      { key: 'comision', label: 'Comisión' },
      { key: 'total', label: 'Total' },
      { key: 'fecha', label: 'Fecha' },
      { key: 'estado', label: 'Estado' },
      { key: 'metodoPago', label: 'Método de pago' },
    ];

    const csv = toCsv(rows, headers);
    const safeTitle = (event.title || 'evento').replace(/[^a-zA-Z0-9]+/g, '-').toLowerCase();
    const today = new Date().toISOString().slice(0, 10);
    downloadCsv(csv, `ventas-${safeTitle}-${today}.csv`);

    logAction('EXPORT_SALES_CSV', 'events', event.id, { count: rows.length });
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

Te confirmamos que tu devolución por la entrada de "${eventTitle}" ${ticketType ? `(${ticketType})` : ''} ${price > 0 ? `por un total de ${formatCurrency(price)}` : ''} está en proceso.

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

  // =================== DISCOUNT HANDLERS ===================

  const handleCreateDiscount = async () => {
    if (!event || !authUser) return;
    if (!discountForm.code || discountForm.value <= 0) {
      setDiscountFormError('El código y el valor son obligatorios');
      return;
    }

    // Validar que el código no exista ya para este evento
    const exists = discountCodes.some(d => d.code === discountForm.code.toUpperCase());
    if (exists) {
      setDiscountFormError('Este código ya existe para este evento');
      return;
    }

    try {
      setCreatingDiscount(true);
      setDiscountFormError(null);

      const newDiscount = {
        eventId: event.id,
        code: discountForm.code.toUpperCase().trim(),
        type: discountForm.type,
        value: Number(discountForm.value),
        maxUses: discountForm.maxUses ? Number(discountForm.maxUses) : null,
        usedCount: 0,
        validUntil: discountForm.validUntil ? Timestamp.fromDate(new Date(discountForm.validUntil)) : null,
        active: true,
        createdBy: authUser.uid,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now()
      };

      await addDoc(collection(db, 'discount_codes'), newDiscount);
      await logAction('CREATE_DISCOUNT_CODE', 'events', event.id, { code: newDiscount.code });
      
      setDiscountForm({
        code: '',
        type: 'percentage',
        value: 0,
        maxUses: '',
        validUntil: ''
      });
    } catch (error) {
      console.error('Error creating discount:', error);
      handleFirestoreError(error, OperationType.CREATE, 'discount_codes');
      setDiscountFormError('Error al crear el código de descuento');
    } finally {
      setCreatingDiscount(false);
    }
  };

  const handleToggleDiscount = async (discountId: string, currentStatus: boolean) => {
    try {
      await updateDoc(doc(db, 'discount_codes', discountId), {
        active: !currentStatus,
        updatedAt: Timestamp.now()
      });
      await logAction('TOGGLE_DISCOUNT_CODE', 'discount_codes', discountId, { active: !currentStatus });
    } catch (error) {
      console.error('Error toggling discount:', error);
      handleFirestoreError(error, OperationType.UPDATE, `discount_codes/${discountId}`);
    }
  };

  const handleDeleteDiscount = async (discountId: string, code: string) => {
    if (!confirm(`¿Estás seguro de eliminar el código ${code}?`)) return;
    try {
      await deleteDoc(doc(db, 'discount_codes', discountId));
      await logAction('DELETE_DISCOUNT_CODE', 'discount_codes', discountId, { code });
    } catch (error) {
      console.error('Error deleting discount:', error);
      handleFirestoreError(error, OperationType.DELETE, `discount_codes/${discountId}`);
    }
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

  // Vendidos REALES por tipo, contados desde la colección de tickets
  // (excluye cortesías y devoluciones). Es la fuente de verdad, no una estimación.
  const soldByType = (type: string) =>
    tickets.filter(
      (t: any) => t.ticketType === type && !t.isCourtesy && t.status !== 'refunded' && t.status !== 'cancelled'
    ).length;

  const totalCap = (event.tickets || []).reduce((s, t) => s + (t.available || 0), 0) + (Number(event.ticketsSold) || 0);
  const soldPercent = totalCap > 0 ? Math.round(((Number(event.ticketsSold) || 0) / totalCap) * 100) : 0;

  const tabs = [
    { key: 'resumen', label: 'Resumen', icon: BarChart3 },
    { key: 'tickets', label: 'Tickets y Capacidad', icon: Ticket },
    { key: 'descuentos', label: 'Descuentos', icon: Tag },
    { key: 'cortesias', label: 'Cortesías', icon: Gift },
    { key: 'ventas', label: 'Ventas', icon: DollarSign },
    { key: 'asistentes', label: 'Asistentes', icon: Users },
    { key: 'envios', label: 'Envíos', icon: Mail },
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
          <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-2 [&_button]:w-full sm:[&_button]:w-auto [&_button]:justify-center">
            {!event.officialSaleLaunched && event.status === 'active' && (
              <button
                onClick={async () => {
                  if (confirm('¿Estás seguro de lanzar la venta oficial? Esto habilitará todos los tickets para el público.')) {
                    try {
                      setIsSaving(true);
                      await updateDoc(doc(db, 'events', event.id), {
                        officialSaleLaunched: true,
                        updatedAt: Timestamp.now()
                      });
                      await logAction('LAUNCH_OFFICIAL_SALE', 'events', event.id);
                    } catch (error) {
                      handleFirestoreError(error, OperationType.UPDATE, `events/${event.id}`);
                    } finally {
                      setIsSaving(false);
                    }
                  }
                }}
                disabled={isSaving}
                className="flex items-center gap-2 orange-gradient text-white text-sm font-heading font-black px-5 py-2.5 rounded-xl transition-all"
              >
                <Sparkles className="w-4 h-4" /> Lanzar Venta Oficial
              </button>
            )}
            <button
              onClick={openEditor}
              className="flex items-center gap-2 bg-white/5 border border-white/10 text-sm font-heading font-black px-4 py-2.5 rounded-xl hover:border-blue-500/30 transition-all text-blue-400"
            >
              <Edit className="w-4 h-4" /> Editar Info
            </button>
            <Link to={`/evento/${event.id}`}>
              <button className="flex items-center gap-2 bg-white/5 border border-white/10 text-sm font-heading font-black px-4 py-2.5 rounded-xl hover:border-orange-500/30 transition-all">
                <Eye className="w-4 h-4" /> Ver página pública
              </button>
            </Link>
            <Link to={`/control-acceso?event=${event.id}`}>
              <button className="flex items-center gap-2 orange-gradient text-white text-sm font-heading font-black px-4 py-2.5 rounded-xl hover:brightness-110 transition-all">
                <Scan className="w-4 h-4" /> Control de Acceso
              </button>
            </Link>
            {canRefund && activeTickets.length > 0 && (
              <button
                onClick={() => setShowBulkRefundModal(true)}
                className="flex items-center gap-2 bg-red-500/10 border border-red-500/30 text-sm font-heading font-black px-4 py-2.5 rounded-xl hover:bg-red-500/20 transition-all text-red-400"
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
          { label: 'Ingresos', value: formatCurrency(realTotalRevenue), sub: `${formatCurrency(refundedRevenue)} devueltos · ${validOrdersCount} ventas`, icon: DollarSign, color: 'text-green-500', bg: 'bg-green-500/10' },
          { label: 'Cortesías', value: totalCourtesies.toString(), sub: `${totalCourtesies} tickets emitidos`, icon: Gift, color: 'text-purple-500', bg: 'bg-purple-500/10' },
          { label: 'Check-ins', value: activeTickets.filter(t => t.status === 'used').length.toString(), sub: 'Asistentes en el lugar', icon: Users, color: 'text-blue-500', bg: 'bg-blue-500/10' },
        ].map((stat, i) => (
          <motion.div key={i} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}
            className="bg-white/5 rounded-3xl border border-white/10 p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold uppercase tracking-widest text-zinc-500">{stat.label}</span>
              <div className={`${stat.bg} p-2 rounded-xl`}><stat.icon className={`w-4 h-4 ${stat.color}`} /></div>
            </div>
            <p className="text-2xl font-heading font-black">{stat.value || '0'}</p>
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
                ? 'bg-orange-500 text-white'
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
                const ticketSold = soldByType(ticket.type);
                const ticketTotal = (Number(ticket.available) || 0) + ticketSold;
                const pct = ticketTotal > 0 ? Math.round((ticketSold / ticketTotal) * 100) : 0;
                const safePct = isNaN(pct) ? 0 : pct;
                return (
                  <div key={i} className="space-y-2">
                    <div className="flex justify-between items-center">
                      <div>
                        <span className="font-bold text-sm">{ticket.type}</span>
                        <span className="text-xs text-zinc-500 ml-2">({formatCurrency(Number(ticket.price) || 0)} c/u)</span>
                      </div>
                      <span className="text-xs font-bold">{(Number(ticketSold) || 0)}/{(Number(ticketTotal) || 0)}</span>
                    </div>
                    <div className="w-full h-2 bg-white/5 rounded-full overflow-hidden">
                      <div className="h-full orange-gradient rounded-full" style={{ width: `${safePct}%` }} />
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
                    <p className="text-sm font-bold">{formatCurrency(order.total || 0)}</p>
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

            {capacityWarning && (
              <div className="flex items-center gap-2 mb-4 px-4 py-3 rounded-2xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm font-bold">
                <AlertTriangle className="w-4 h-4 shrink-0" /> {capacityWarning}
              </div>
            )}

            <div className="space-y-4">
              {(event.tickets || []).map((ticket, i) => {
                const ticketSold = soldByType(ticket.type);
                const ticketTotal = (Number(ticket.available) || 0) + ticketSold;
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
        <div className="flex justify-between items-center mb-1">
          <label className="text-xs text-zinc-500 block">Precio ($)</label>
          {ticket.price && Number(ticket.price) > 0 && (
            <span className="text-[10px] font-black text-primary">{formatCurrency(Number(ticket.price))}</span>
          )}
        </div>
        <input 
          type="number" 
          placeholder="0"
          value={ticket.price === 0 ? '' : ticket.price} 
          onChange={e => handleUpdateTicket(i, 'price', e.target.value === '' ? '' : Number(e.target.value))}
          className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-orange-500/50" 
        />
      </div>
      <div>
        <label className="text-xs text-zinc-500 block mb-1">Capacidad total</label>
        <input 
          type="number" 
          placeholder="0"
          value={ticketTotal === 0 ? '' : ticketTotal} 
          onChange={e => handleUpdateTicket(i, 'available', (e.target.value === '' ? 0 : Number(e.target.value)) - ticketSold)}
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
                      <div className="h-full orange-gradient rounded-full" style={{ width: `${safePct}%` }} />
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
                  <div className="flex justify-between items-center mb-1">
                    <label className="text-xs text-zinc-500 block">Precio ($)</label>
                    {newSector.price && Number(newSector.price) > 0 && (
                      <span className="text-[10px] font-black text-primary">{formatCurrency(Number(newSector.price))}</span>
                    )}
                  </div>
                  <input 
                    type="number" 
                    placeholder="0" 
                    value={newSector.price || ''}
                    onChange={e => setNewSector({...newSector, price: e.target.value === '' ? '' : Number(e.target.value)})}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-orange-500/50" 
                  />
                </div>
                <div>
                  <label className="text-xs text-zinc-500 block mb-1">Cantidad disponible</label>
                  <input 
                    type="number" 
                    placeholder="0" 
                    value={newSector.available || ''}
                    onChange={e => setNewSector({...newSector, available: e.target.value === '' ? '' : Number(e.target.value)})}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-orange-500/50" 
                  />
                </div>
              </div>
              <button 
                onClick={handleAddSector}
                disabled={isSaving}
                className="mt-4 flex items-center gap-2 orange-gradient text-white font-heading font-black px-5 py-2.5 rounded-xl text-sm disabled:opacity-50"
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
                className={`flex items-center gap-2 font-heading font-black px-5 py-2.5 rounded-xl text-sm transition-all ${
                  showSavedFeedback
                    ? 'bg-green-500 text-white'
                    : 'orange-gradient text-white'
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
                  <select 
                    value={courtesyType} 
                    onChange={e => setCourtesyType(e.target.value)}
                    className="w-full bg-zinc-900 text-white border border-white/10 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-orange-500/50 appearance-none shadow-xl"
                  >
                    <option value="" className="bg-zinc-900">Seleccioná el tipo</option>
                    {(event.tickets || []).map((t, i) => <option key={i} value={t.type} className="bg-zinc-900">{t.type}</option>)}
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
                  className="flex items-center gap-2 orange-gradient text-white font-heading font-black px-5 py-2.5 rounded-xl text-sm disabled:opacity-50"
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
                <div className="text-4xl font-black text-transparent bg-clip-text orange-gradient">{totalCourtesies}</div>
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
                <button
                  onClick={handleExportSales}
                  disabled={!orders || orders.length === 0}
                  className="flex items-center gap-2 bg-white/5 border border-white/10 font-bold px-4 py-2 rounded-xl text-xs hover:border-orange-500/30 disabled:opacity-40 disabled:cursor-not-allowed transition"
                >
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
                      <td className="p-2 font-bold">{formatCurrency(order.total || 0)}</td>
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
              <button
                onClick={handleExportAttendees}
                disabled={!tickets || tickets.length === 0}
                className="flex items-center gap-2 bg-white/5 border border-white/10 font-bold px-4 py-2 rounded-xl text-xs hover:border-orange-500/30 disabled:opacity-40 disabled:cursor-not-allowed transition"
              >
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

      {/* ==================== ENVÍOS ==================== */}
      {activeTab === 'envios' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <div className="bg-white/5 rounded-3xl border border-white/10 p-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
              <div>
                <h3 className="font-heading font-black text-lg">Envíos de email</h3>
                <p className="text-xs text-zinc-500">
                  {emailLogs.length} {emailLogs.length === 1 ? 'envío registrado' : 'envíos registrados'}
                </p>
              </div>
              <div className="flex gap-2">
                <span className="text-[10px] font-bold uppercase tracking-widest px-3 py-1.5 rounded-full bg-green-500/10 text-green-400 border border-green-500/20">
                  {emailLogs.filter((l: any) => l.status === 'sent').length} enviados
                </span>
                <span className="text-[10px] font-bold uppercase tracking-widest px-3 py-1.5 rounded-full bg-red-500/10 text-red-400 border border-red-500/20">
                  {emailLogs.filter((l: any) => l.status === 'failed').length} fallidos
                </span>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/10 text-left">
                    <th className="p-2 text-xs font-bold uppercase tracking-widest text-zinc-500">Destinatario</th>
                    <th className="p-2 text-xs font-bold uppercase tracking-widest text-zinc-500">Entradas</th>
                    <th className="p-2 text-xs font-bold uppercase tracking-widest text-zinc-500">Estado</th>
                    <th className="p-2 text-xs font-bold uppercase tracking-widest text-zinc-500">Fecha</th>
                  </tr>
                </thead>
                <tbody>
                  {emailLogs.map((log: any, idx: number) => (
                    <tr key={log.id || idx} className="border-b border-white/5">
                      <td className="p-2">
                        <p className="font-bold">{log.buyerName || '—'}</p>
                        <p className="text-zinc-400 text-xs">{log.buyerEmail || '—'}</p>
                      </td>
                      <td className="p-2 text-zinc-300">{log.ticketCount || 1}</td>
                      <td className="p-2">
                        {log.status === 'sent' ? (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-green-500/10 text-green-400">Enviado</span>
                        ) : (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-500/10 text-red-400" title={log.error || ''}>
                            Falló
                          </span>
                        )}
                      </td>
                      <td className="p-2 text-zinc-400 text-xs">
                        {log.createdAt?.toDate ? log.createdAt.toDate().toLocaleString('es-AR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {emailLogs.length === 0 && (
                <p className="text-center text-zinc-500 py-8 text-sm">
                  Todavía no hay envíos registrados. Aparecerán acá automáticamente cuando se concrete una compra.
                </p>
              )}
            </div>
          </div>
        </motion.div>
      )}

      {/* ==================== DESCUENTOS ==================== */}
      {activeTab === 'descuentos' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
          <div className="grid gap-6 md:grid-cols-3">
            {/* Create discount form */}
            <div className="md:col-span-1 bg-white/5 rounded-3xl border border-white/10 p-6 h-fit">
              <h3 className="font-bold text-lg mb-1">Nuevo Código</h3>
              <p className="text-xs text-zinc-500 mb-6">Creá cupones de descuento para tus asistentes.</p>

              <div className="space-y-4">
                <div>
                  <label className="text-xs text-zinc-500 block mb-1 uppercase font-bold tracking-widest">Código</label>
                  <input 
                    type="text" 
                    placeholder="EJ: PROMO20" 
                    value={discountForm.code}
                    onChange={e => setDiscountForm({...discountForm, code: e.target.value.toUpperCase()})}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-orange-500/50 font-mono" 
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-zinc-500 block mb-1 uppercase font-bold tracking-widest">Tipo</label>
                    <select 
                      value={discountForm.type}
                      onChange={e => setDiscountForm({...discountForm, type: e.target.value as any})}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-orange-500/50 appearance-none"
                    >
                      <option value="percentage">Porcentaje (%)</option>
                      <option value="fixed">Monto Fijo ($)</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-zinc-500 block mb-1 uppercase font-bold tracking-widest">Valor</label>
                    <input 
                      type="number" 
                      placeholder="Ej: 20" 
                      value={discountForm.value || ''}
                      onChange={e => setDiscountForm({...discountForm, value: Number(e.target.value)})}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-orange-500/50" 
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs text-zinc-500 block mb-1 uppercase font-bold tracking-widest">Límite de usos (opcional)</label>
                  <input 
                    type="number" 
                    placeholder="Sin límite" 
                    value={discountForm.maxUses}
                    onChange={e => setDiscountForm({...discountForm, maxUses: e.target.value})}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-orange-500/50" 
                  />
                </div>

                <div>
                  <label className="text-xs text-zinc-500 block mb-1 uppercase font-bold tracking-widest">Válido hasta (opcional)</label>
                  <input 
                    type="date" 
                    value={discountForm.validUntil}
                    onChange={e => setDiscountForm({...discountForm, validUntil: e.target.value})}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-orange-500/50 appearance-none" 
                  />
                </div>

                {discountFormError && (
                  <p className="text-xs font-bold text-red-500">{discountFormError}</p>
                )}

                <button 
                  onClick={handleCreateDiscount}
                  disabled={creatingDiscount || !discountForm.code || discountForm.value <= 0}
                  className="w-full flex items-center justify-center gap-2 orange-gradient text-white font-bold h-12 rounded-2xl disabled:opacity-50"
                >
                  {creatingDiscount ? <Loader2 className="w-5 h-5 animate-spin" /> : <Plus className="w-5 h-5" />}
                  Crear Código
                </button>
              </div>
            </div>

            {/* Discount codes list */}
            <div className="md:col-span-2 bg-white/5 rounded-3xl border border-white/10 p-6">
              <h3 className="font-bold text-lg mb-4">Códigos Activos</h3>
              
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/10 text-left">
                      <th className="p-2 text-xs font-bold uppercase tracking-widest text-zinc-500">Código</th>
                      <th className="p-2 text-xs font-bold uppercase tracking-widest text-zinc-500">Descuento</th>
                      <th className="p-2 text-xs font-bold uppercase tracking-widest text-zinc-500">Usos</th>
                      <th className="p-2 text-xs font-bold uppercase tracking-widest text-zinc-500">Validez</th>
                      <th className="p-2 text-xs font-bold uppercase tracking-widest text-zinc-500">Estado</th>
                      <th className="p-2 text-xs font-bold uppercase tracking-widest text-zinc-500 text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {discountCodes.map((d) => {
                      const isExpired = d.validUntil && d.validUntil.toDate() < new Date();
                      const isExhausted = d.maxUses && d.usedCount >= d.maxUses;
                      const status = !d.active ? 'Pausado' : (isExpired ? 'Expirado' : (isExhausted ? 'Agotado' : 'Activo'));
                      
                      return (
                        <tr key={d.id} className="border-b border-white/5 group">
                          <td className="p-2">
                            <span className="font-mono font-black text-orange-500">{d.code}</span>
                          </td>
                          <td className="p-2">
                            <span className="font-bold">
                              {d.type === 'percentage' ? `${d.value}%` : formatCurrency(d.value)}
                            </span>
                          </td>
                          <td className="p-2">
                            <span className="text-zinc-400">
                              {d.usedCount} / {d.maxUses || '∞'}
                            </span>
                          </td>
                          <td className="p-2 text-xs text-zinc-500">
                            {d.validUntil ? formatDate(d.validUntil) : 'Permanente'}
                          </td>
                          <td className="p-2">
                            <span className={`text-[10px] font-bold uppercase px-2 py-1 rounded-full ${
                              status === 'Activo' ? 'bg-green-500/20 text-green-400' : 
                              status === 'Pausado' ? 'bg-yellow-500/20 text-yellow-400' : 
                              'bg-red-500/20 text-red-400'
                            }`}>
                              {status}
                            </span>
                          </td>
                          <td className="p-2 text-right">
                            <div className="flex justify-end gap-1">
                              <button 
                                onClick={() => handleToggleDiscount(d.id, d.active)}
                                title={d.active ? "Pausar" : "Activar"}
                                className="p-2 hover:bg-white/5 rounded-xl transition-colors"
                              >
                                {d.active ? <Clock className="w-4 h-4 text-yellow-500" /> : <Check className="w-4 h-4 text-green-500" />}
                              </button>
                              <button 
                                onClick={() => handleDeleteDiscount(d.id, d.code)}
                                className="p-2 hover:bg-red-500/10 rounded-xl transition-colors"
                              >
                                <Trash className="w-4 h-4 text-red-400" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                    {discountCodes.length === 0 && (
                      <tr>
                        <td colSpan={6} className="p-12 text-center">
                          <Tag className="w-12 h-12 text-zinc-700 mx-auto mb-4" />
                          <p className="text-zinc-500 font-bold">No hay códigos de descuento creados</p>
                          <p className="text-xs text-zinc-600 mt-1">Creá el primero usando el formulario de la izquierda</p>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
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
              {/* IMAGEN */}
              <div>
                <label className="text-xs font-bold uppercase tracking-widest text-zinc-500 block mb-2">Flyer / Imagen</label>
                <div className="w-full aspect-[16/9] bg-white/5 rounded-2xl flex items-center justify-center border border-white/10 overflow-hidden mb-2">
                  {editForm.image ? (
                    <img src={editForm.image} className="w-full h-full object-cover" />
                  ) : (
                    <div className="flex flex-col items-center gap-1.5 text-zinc-500">
                      <ImageIcon className="w-7 h-7" />
                      <span className="text-xs">Subí una imagen o pegá un link</span>
                    </div>
                  )}
                </div>
                <div className="flex gap-2">
                  <label className={`flex-1 cursor-pointer flex items-center justify-center gap-2 h-11 rounded-xl border-2 border-dashed transition-colors text-sm font-bold ${editImageUploading ? 'border-orange-500/40 text-orange-400' : 'border-white/15 text-zinc-400 hover:border-orange-500/40 hover:text-orange-400'}`}>
                    {editImageUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                    {editImageUploading ? 'Subiendo...' : 'Subir imagen'}
                    <input type="file" accept="image/*" className="hidden" disabled={editImageUploading}
                      onChange={e => { handleEditImageFile(e.target.files?.[0]); e.target.value = ''; }} />
                  </label>
                  {editForm.image && (
                    <button type="button" onClick={() => setEditForm(f => ({ ...f, image: '' }))}
                      className="h-11 px-3 rounded-xl bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors text-sm font-bold flex items-center gap-1.5">
                      <Trash2 className="w-4 h-4" /> Quitar
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-2 mt-2">
                  <LinkIcon className="w-4 h-4 text-zinc-500 shrink-0" />
                  <input type="text" placeholder="...o pegá un link https://..."
                    value={editForm.image && editForm.image.startsWith('data:') ? '' : (editForm.image || '')}
                    onChange={e => setEditForm({ ...editForm, image: e.target.value })}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-orange-500/50" />
                </div>
                {editImageError && <p className="text-xs text-red-400 mt-1.5">{editImageError}</p>}
              </div>

              {/* TÍTULO */}
              <div>
                <label className="text-xs font-bold uppercase tracking-widest text-zinc-500 block mb-1">Título</label>
                <input type="text" value={editForm.title} onChange={e => setEditForm({...editForm, title: e.target.value})}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-orange-500/50" />
              </div>

              {/* TIPO DE EVENTO (CATEGORÍA) */}
              <div>
                <label className="text-xs font-bold uppercase tracking-widest text-zinc-500 block mb-2">Tipo de evento</label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {EVENT_CATEGORIES.map(cat => {
                    const active = editForm.category === cat.value;
                    return (
                      <button
                        key={cat.value}
                        type="button"
                        onClick={() => setEditForm({ ...editForm, category: cat.value })}
                        className={`flex items-center gap-2 px-3 h-11 rounded-xl border text-xs font-bold transition-all ${active ? 'border-orange-500 bg-orange-500/10 text-orange-400' : 'border-white/10 bg-white/5 text-zinc-400 hover:border-white/20'}`}
                      >
                        <cat.icon className="w-4 h-4 shrink-0" />
                        <span className="truncate">{cat.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* EVENTO DE VARIOS DÍAS */}
              <div className="flex items-center justify-between gap-3 p-3 rounded-xl bg-white/5 border border-white/10">
                <div>
                  <p className="text-sm font-bold">Evento de varios días</p>
                  <p className="text-[11px] text-zinc-500">Activá para configurar varias jornadas.</p>
                </div>
                <button type="button" onClick={() => setEditIsMultiDay(v => !v)} aria-label="Varios días"
                  className={`relative w-12 h-7 rounded-full transition-colors shrink-0 ${editIsMultiDay ? 'bg-orange-500' : 'bg-white/15'}`}>
                  <span className={`absolute top-1 left-1 w-5 h-5 rounded-full bg-white transition-transform ${editIsMultiDay ? 'translate-x-5' : ''}`} />
                </button>
              </div>

              {/* FECHA(S) */}
              {!editIsMultiDay ? (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold uppercase tracking-widest text-zinc-500 block mb-1">Fecha</label>
                    <input type="date" value={editDate} onChange={e => setEditDate(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-orange-500/50 [color-scheme:dark]" />
                  </div>
                  <div>
                    <label className="text-xs font-bold uppercase tracking-widest text-zinc-500 block mb-1">Hora</label>
                    <input type="time" value={editTime} onChange={e => setEditTime(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-orange-500/50 [color-scheme:dark]" />
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <label className="text-xs font-bold uppercase tracking-widest text-zinc-500 block">Jornadas</label>
                  {editDays.map((d, i) => (
                    <div key={i} className="p-3 rounded-xl bg-white/5 border border-white/10 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-zinc-400">Día {i + 1}</span>
                        {editDays.length > 1 && (
                          <button type="button" onClick={() => removeEditDay(i)} className="text-red-400 hover:text-red-300">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                      <input type="date" value={d.date} onChange={e => updateEditDay(i, { date: e.target.value })}
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-orange-500/50 [color-scheme:dark]" />
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <span className="text-[10px] text-zinc-500 block mb-1">Desde</span>
                          <input type="time" value={d.startTime} onChange={e => updateEditDay(i, { startTime: e.target.value })}
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-orange-500/50 [color-scheme:dark]" />
                        </div>
                        <div>
                          <span className="text-[10px] text-zinc-500 block mb-1">Hasta</span>
                          <input type="time" value={d.endTime} onChange={e => updateEditDay(i, { endTime: e.target.value })}
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-orange-500/50 [color-scheme:dark]" />
                        </div>
                      </div>
                    </div>
                  ))}
                  <button type="button" onClick={addEditDay}
                    className="w-full flex items-center justify-center gap-2 h-11 rounded-xl border-2 border-dashed border-white/10 text-zinc-400 hover:border-orange-500/40 hover:text-orange-400 transition-colors text-sm font-bold">
                    <Plus className="w-4 h-4" /> Agregar día
                  </button>

                  {/* Modo de QR */}
                  <div>
                    <label className="text-xs font-bold uppercase tracking-widest text-zinc-500 block mb-2">Modo de QR</label>
                    <div className="grid grid-cols-1 gap-2">
                      <button type="button" onClick={() => setEditEntryMode('whole_event')}
                        className={`text-left p-3 rounded-xl border transition-all ${editEntryMode === 'whole_event' ? 'border-orange-500 bg-orange-500/10' : 'border-white/10 bg-white/5 hover:border-white/20'}`}>
                        <p className="text-sm font-bold">Un QR para todo el evento</p>
                        <p className="text-[11px] text-zinc-500">Mismo QR cada día, pero una sola vez por día.</p>
                      </button>
                      <button type="button" onClick={() => setEditEntryMode('per_day')}
                        className={`text-left p-3 rounded-xl border transition-all ${editEntryMode === 'per_day' ? 'border-orange-500 bg-orange-500/10' : 'border-white/10 bg-white/5 hover:border-white/20'}`}>
                        <p className="text-sm font-bold">Un QR por día</p>
                        <p className="text-[11px] text-zinc-500">Si elige 4 días, recibe 4 QR.</p>
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* GRATIS / PAGO */}
              <div className="flex items-center justify-between gap-3 p-3 rounded-xl bg-white/5 border border-white/10">
                <div>
                  <p className="text-sm font-bold">Evento gratuito</p>
                  <p className="text-[11px] text-zinc-500">Reservan sin pagar (igual sacan su QR). Los precios se editan en la pestaña Tickets.</p>
                </div>
                <button type="button" onClick={() => setEditIsFree(v => !v)} aria-label="Evento gratuito"
                  className={`relative w-12 h-7 rounded-full transition-colors shrink-0 ${editIsFree ? 'bg-orange-500' : 'bg-white/15'}`}>
                  <span className={`absolute top-1 left-1 w-5 h-5 rounded-full bg-white transition-transform ${editIsFree ? 'translate-x-5' : ''}`} />
                </button>
              </div>

              {/* UBICACIÓN */}
              <div>
                <label className="text-xs font-bold uppercase tracking-widest text-zinc-500 block mb-1">Lugar / Dirección</label>
                <input type="text" value={editForm.venue} onChange={e => setEditForm({...editForm, venue: e.target.value})}
                  placeholder="Ej: Centro de Convenciones, Av. Figueroa Alcorta 2099"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-orange-500/50" />
                <p className="text-[11px] text-zinc-500 mt-1 flex items-center gap-1">
                  <MapPin className="w-3 h-3" /> Esto es lo que usa el botón "Cómo llegar" en Google Maps. Poné una dirección real para que la encuentre.
                </p>
              </div>
              <div>
                <label className="text-xs font-bold uppercase tracking-widest text-zinc-500 block mb-1">Ciudad</label>
                <input type="text" value={editForm.location} onChange={e => setEditForm({...editForm, location: e.target.value})}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-orange-500/50" />
              </div>

              {/* DESCRIPCIÓN */}
              <div>
                <label className="text-xs font-bold uppercase tracking-widest text-zinc-500 block mb-1">Descripción</label>
                <textarea rows={4} value={editForm.description} onChange={e => setEditForm({...editForm, description: e.target.value})}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-orange-500/50 resize-none" />
              </div>

              {/* ESTADO (PUBLICAR) */}
              <div>
                <label className="text-xs font-bold uppercase tracking-widest text-zinc-500 block mb-1">Estado</label>
                <select value={editForm.status} onChange={e => setEditForm({...editForm, status: e.target.value})}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-orange-500/50 [color-scheme:dark]">
                  <option value="pending">Pendiente (no visible en la cartelera)</option>
                  <option value="active">Activo (visible y a la venta)</option>
                  <option value="paused">Pausado</option>
                  <option value="cancelled">Cancelado</option>
                </select>
              </div>
            </div>

            {saveError && (
              <div className="flex items-start gap-2 px-4 py-3 rounded-2xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm font-bold">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" /> {saveError}
              </div>
            )}

            <div className="flex gap-3 pt-4">
              <button onClick={() => { setIsEditingEvent(false); setSaveError(''); }} className="flex-1 px-6 py-3 rounded-2xl bg-white/5 hover:bg-white/10 font-bold transition">
                Cancelar
              </button>
              <button 
                onClick={handleSaveEventDetails} 
                disabled={isSaving}
                className={`flex-1 px-6 py-3 rounded-2xl font-bold transition flex items-center justify-center gap-2 ${
                  showSavedFeedback 
                    ? 'bg-green-500 text-white' 
                    : 'orange-gradient text-white'
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
                    <span className="font-bold text-orange-400">{formatCurrency(ticketToRefund.price || 0)}</span>
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
                className="flex-1 px-6 py-3 rounded-2xl orange-gradient text-white font-bold transition disabled:opacity-50"
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


