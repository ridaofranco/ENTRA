import * as React from 'react';
import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Card } from '@/src/components/ui/card';
import { Button } from '@/src/components/ui/button';
import { Input } from '@/src/components/ui/input';
import { Textarea } from '@/src/components/ui/textarea';
import { Badge } from '@/src/components/ui/badge';
import {
  Calendar,
  MapPin,
  Image as ImageIcon,
  Ticket,
  Plus,
  Trash2,
  ArrowLeft,
  Sparkles,
  Info,
  Upload,
  Loader2,
  Link as LinkIcon,
  Users
} from 'lucide-react';
import { collection, setDoc, doc, getDoc, Timestamp } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '@/src/lib/firebase';
import { useAuth } from '@/src/context/AuthContext';
import { logAction } from '@/src/services/auditService';
import { formatCurrency } from '@/src/lib/utils';
import { uploadEventImage } from '@/src/lib/imageUpload';
import { EVENT_CATEGORIES } from '@/src/lib/categories';

export default function CreateEvent() {
  const navigate = useNavigate();
  const { user, profile, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(false);
  const [ticketToDelete, setTicketToDelete] = useState<number | null>(null);

  const [isDateProximamente, setIsDateProximamente] = useState(false);
  const [isTimeProximamente, setIsTimeProximamente] = useState(false);
  const [isVenueProximamente, setIsVenueProximamente] = useState(false);
  const [isHidden, setIsHidden] = useState(false);
  const [imageUploading, setImageUploading] = useState(false);
  const [imageError, setImageError] = useState('');

  const handleImageFile = async (
    file: File | undefined,
    setImage: (url: string) => void
  ) => {
    if (!file) return;
    setImageError('');
    setImageUploading(true);
    try {
      const { url } = await uploadEventImage(file, user?.uid || 'misc');
      setImage(url);
    } catch (err) {
      setImageError(err instanceof Error ? err.message : 'No se pudo subir la imagen.');
    } finally {
      setImageUploading(false);
    }
  };

  // =================== GRATIS vs PAGO ===================
  const [isFreeEvent, setIsFreeEvent] = useState(false);

  // =================== EVENTO MULTI-DÍA ===================
  const [isMultiDay, setIsMultiDay] = useState(false);
  const [sameSchedule, setSameSchedule] = useState(true);
  const [commonStart, setCommonStart] = useState('');
  const [commonEnd, setCommonEnd] = useState('');
  const [entryMode, setEntryMode] = useState<'per_day' | 'whole_event'>('whole_event');
  const [days, setDays] = useState<Array<{ date: string; startTime: string; endTime: string }>>([
    { date: '', startTime: '', endTime: '' },
  ]);

  // Fin del evento (opcional): datetime-local en HORA LOCAL. Si el productor lo
  // carga, la venta termina exactamente ahi; si queda vacio, el evento se da por
  // finalizado 3 horas despues del inicio (regla central en lib/utils isEventFinished).
  const [endDateTime, setEndDateTime] = useState('');

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    date: '',
    time: '',
    venue: '',
    location: '',
    category: 'Música',
    image: '',
    price: 0,
    allowTransfer: true,
  });

  const [tickets, setTickets] = useState([
    { type: 'General', price: '' as any, available: '' as any, isEarlyBird: false }
  ]);

  // =================== CUSTOM FIELDS STATE ===================
  const [customFields, setCustomFields] = useState<Array<{
    id: string;
    label: string;
    type: 'text' | 'number' | 'select' | 'textarea';
    required: boolean;
    placeholder: string;
    options: string[];
  }>>([]);
  const [customFieldToDelete, setCustomFieldToDelete] = useState<number | null>(null);

  // If still loading auth/profile, show a clear loading indicator
  if (authLoading) {
    return (
      <div className="pt-40 pb-20 px-6 text-center max-w-xl mx-auto flex flex-col items-center justify-center">
        <Sparkles className="w-12 h-12 text-primary animate-pulse mb-4" />
        <p className="text-zinc-500 font-bold uppercase tracking-widest text-sm">Verificando cuenta...</p>
      </div>
    );
  }
  
  const isAuthorized = user && profile && (profile.role === 'organizer' || profile.role === 'admin' || profile.role === 'superadmin');

  if (!isAuthorized) {
    return (
      <div className="pt-40 pb-20 px-6 text-center max-w-xl mx-auto">
        <div className="w-20 h-20 bg-primary/10 text-primary rounded-3xl flex items-center justify-center mx-auto mb-8">
          <Sparkles className="w-10 h-10" />
        </div>
        <h1 className="text-4xl font-heading font-black tracking-tighter mb-4 uppercase">
          {user ? "Solicitá tu cuenta" : "Empezá a vender hoy"}
        </h1>
        <p className="text-muted-foreground mb-8">
          {user 
            ? "Para crear eventos en ENTRÁ, tu cuenta debe ser habilitada como Organizador. Contactanos para solicitar el alta."
            : "Para crear y gestionar tus eventos en ENTRÁ, primero necesitás iniciar sesión con tu cuenta."}
        </p>
        {!user ? (
          <Link to="/auth/login?redirect=/crear-evento">
            <Button className="h-14 px-12 orange-gradient border-none font-heading font-black text-lg rounded-xl hover:brightness-110">
              Iniciar Sesión
            </Button>
          </Link>
        ) : (
          <Link to="/contacto">
            <Button className="h-14 px-12 bg-white/5 border border-white/10 font-heading font-black text-lg rounded-xl">
              Contactar Soporte
            </Button>
          </Link>
        )}
      </div>
    );
  }

  const addTicketType = () => {
    setTickets([...tickets, { type: '', price: '' as any, available: '' as any, isEarlyBird: false }]);
  };

  const removeTicketType = (index: number) => {
    setTicketToDelete(index);
  };

  const confirmRemoveTicket = () => {
    if (ticketToDelete === null) return;
    setTickets(tickets.filter((_, i) => i !== ticketToDelete));
    setTicketToDelete(null);
  };

  // =================== CUSTOM FIELD HELPERS ===================
  const generateFieldId = () => Math.random().toString(36).substring(2, 10);

  const addCustomField = () => {
    setCustomFields([
      ...customFields,
      {
        id: generateFieldId(),
        label: '',
        type: 'text',
        required: false,
        placeholder: '',
        options: [],
      },
    ]);
  };

  const updateCustomField = (index: number, updates: Partial<typeof customFields[0]>) => {
    const updated = [...customFields];
    updated[index] = { ...updated[index], ...updates };
    setCustomFields(updated);
  };

  const confirmRemoveCustomField = () => {
    if (customFieldToDelete !== null) {
      setCustomFields(customFields.filter((_, i) => i !== customFieldToDelete));
      setCustomFieldToDelete(null);
    }
  };

  const handleOptionsChange = (index: number, optionsStr: string) => {
    // El organizador escribe las opciones separadas por coma: "S, M, L, XL"
    const opts = optionsStr.split(',').map(o => o.trim()).filter(Boolean);
    updateCustomField(index, { options: opts });
  };

  // =================== MULTI-DÍA HELPERS ===================
  const addDay = () => setDays([...days, { date: '', startTime: '', endTime: '' }]);
  const removeDay = (i: number) => setDays(days.length > 1 ? days.filter((_, idx) => idx !== i) : days);
  const updateDay = (i: number, patch: Partial<{ date: string; startTime: string; endTime: string }>) => {
    const next = [...days];
    next[i] = { ...next[i], ...patch };
    setDays(next);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // ---- Validación de capacidad ----
    // No se puede crear un evento sin capacidad: cada entrada/sector debe tener
    // una cantidad cargada y el evento debe tener más de 1 entrada a la venta.
    const totalCapacity = tickets.reduce((acc, t) => acc + (Number(t.available) || 0), 0);
    const algunSinCapacidad = tickets.some(t => !(Number(t.available) > 0));
    if (tickets.length === 0 || algunSinCapacidad) {
      alert('Cada entrada/sector tiene que tener una capacidad cargada (cuántos tickets se ponen a la venta).');
      return;
    }
    if (totalCapacity <= 1) {
      alert('El evento tiene que tener más de 1 entrada a la venta en total.');
      return;
    }

    setLoading(true);
    try {
      // 1. Obtener plan del usuario y tiers globales para snapshot
      const userSnap = await getDoc(doc(db, 'users', user.uid));
      const userPlan = userSnap.exists() ? (userSnap.data().plan || 'starter') : 'starter';
      
      const configSnap = await getDoc(doc(db, 'platform_config', 'settings'));
      const tiers = configSnap.exists() ? configSnap.data().commissionTiers : null;
      const commissionRate = 8; // Comisión única del 8% para el nuevo modelo ENTRÁ

      let eventDate: Date;
      let multiDayExtra: any = { isMultiDay: false };
      if (isMultiDay) {
        const built = days
          .filter(d => d.date)
          .map(d => {
            const st = (sameSchedule ? commonStart : d.startTime) || '00:00';
            const et = (sameSchedule ? commonEnd : d.endTime) || '';
            return { date: Timestamp.fromDate(new Date(`${d.date}T${st}:00`)), startTime: st, endTime: et };
          })
          .sort((a, b) => a.date.seconds - b.date.seconds);
        if (built.length > 0) {
          eventDate = built[0].date.toDate();
          multiDayExtra = { isMultiDay: true, days: built, entryMode, endDate: built[built.length - 1].date };
        } else {
          eventDate = new Date('2100-01-01T00:00:00');
        }
      } else if (isDateProximamente) {
        // We use a far-future placeholder date (e.g. 2100-01-01) but store isDateTBD flag as true
        eventDate = new Date('2100-01-01T00:00:00');
      } else {
        const timeVal = isTimeProximamente ? '00:00' : (formData.time || '00:00');
        eventDate = new Date(`${formData.date}T${timeVal}`);
      }

      // Fin explicito (solo eventos de un dia con fecha confirmada). El input
      // datetime-local se interpreta en hora local con new Date(), igual que el
      // inicio: NUNCA pasar por toISOString() aca (corria los horarios 3 horas).
      let explicitEnd: Date | null = null;
      if (!isMultiDay && !isDateProximamente && endDateTime) {
        explicitEnd = new Date(endDateTime);
        if (isNaN(explicitEnd.getTime())) explicitEnd = null;
        if (explicitEnd && explicitEnd.getTime() <= eventDate.getTime()) {
          alert('El fin del evento no puede ser anterior (ni igual) al inicio. Revisá la fecha y hora de fin.');
          setLoading(false);
          return;
        }
      }

      // Create a copy of formData without the 'time' field which is not needed in Firestore
      const { time, ...restFormData } = formData;
      if (isVenueProximamente) {
        restFormData.venue = 'Por definir';
      }
      
      // Calculate minimum price from tickets
      const minPrice = tickets.length > 0 ? Math.min(...tickets.map(t => Number(t.price) || 0)) : 0;
      
      // We generate the ID first so we can include it in the document and use a single write
      const eventRef = doc(collection(db, 'events'));
      const eventId = eventRef.id;

      const eventData = {
        ...restFormData,
        id: eventId,
        price: isFreeEvent ? 0 : minPrice,
        isFree: isFreeEvent,
        date: Timestamp.fromDate(eventDate),
        ...multiDayExtra,
        ...(explicitEnd ? { endDate: Timestamp.fromDate(explicitEnd) } : {}),
        isDateTBD: isMultiDay ? false : isDateProximamente,
        isTimeTBD: isMultiDay ? false : (isTimeProximamente || isDateProximamente),
        isVenueTBD: isVenueProximamente,
        ...(isHidden ? { hidden: true } : {}),
        tickets: tickets.map(t => ({
          ...t,
          price: isFreeEvent ? 0 : (Number(t.price) || 0),
          available: Number(t.available) || 0
        })),
        customFields: customFields.filter(cf => cf.label.trim() !== ''), // solo guardamos los que tengan label
        organizerId: user.uid,
        organizerEmail: user.email || '',
        organizerName: profile?.displayName || user.displayName || 'Organizador',
        organizerPlan: userPlan, // Snapshot del plan al crear
        commissionRate: commissionRate, // Snapshot de la tasa al crear
        ticketsSold: 0,
        totalRevenue: 0,
        status: 'pending',
        officialSaleLaunched: false,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      };
      
      await setDoc(eventRef, eventData);

      // Log the action
      await logAction('CREATE_EVENT_PENDING', 'events', eventId, { title: eventData.title });

      // AVISO A ENTRÁ. Es la pieza que reemplaza al WhatsApp: hasta acá el evento
      // quedaba en 'pending' y nadie se enteraba, así que dependía de que alguien
      // se acordara de mirar el panel. Se manda sin await y sin mirar la
      // respuesta: el evento YA está creado, y un aviso que no sale no puede
      // hacer que al productor le aparezca un error.
      fetch('/api/organizador', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'event-submitted',
          eventId,
          eventTitle: eventData.title,
          eventDate: eventData.isDateTBD
            ? 'A confirmar'
            : (eventData.date?.toDate?.()?.toLocaleString('es-AR', {
                dateStyle: 'full', timeStyle: 'short',
                timeZone: 'America/Argentina/Buenos_Aires',
              }) || ''),
          venue: eventData.venue,
          location: eventData.location,
          tickets: eventData.tickets,
          // Cuánto puede llegar a recaudar si vende todo: es el dato que dice si
          // este evento importa, y no está en ninguna pantalla del panel.
          potencial: isFreeEvent
            ? 'evento gratis'
            : `$${eventData.tickets
                .reduce((s: number, t: any) => s + (Number(t.price) || 0) * (Number(t.available) || 0), 0)
                .toLocaleString('es-AR')}`,
          organizerName: eventData.organizerName,
          organizerEmail: eventData.organizerEmail,
        }),
      }).catch(() => {});

      alert('Evento enviado a revisión. Te avisamos por mail apenas lo publiquemos.');
      navigate('/dashboard');
    } catch (error: any) {
      console.error("Error creating event:", error);
      let errorMsg = 'No se pudo enviar el evento a revisión.';
      try {
        const parsed = JSON.parse(error.message);
        if (parsed.error.includes('permissions')) {
          errorMsg = 'Error de permisos: Tu cuenta no tiene habilitada la creación de eventos. Contactá a soporte.';
        }
      } catch {
        errorMsg = error.message || errorMsg;
      }
      alert(errorMsg);
      handleFirestoreError(error, OperationType.CREATE, 'events');
    } finally {
      setLoading(false);
    }
  };

  // Capacidad total y validez (cada entrada con cupo y más de 1 en total)
  const totalCapacity = tickets.reduce((acc, t) => acc + (Number(t.available) || 0), 0);
  const capacityValid = tickets.length > 0 && tickets.every(t => Number(t.available) > 0) && totalCapacity > 1;

  return (
    <div className="pt-32 pb-20 px-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-4 mb-12">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="rounded-full">
          <ArrowLeft className="w-6 h-6" />
        </Button>
        <h1 className="text-4xl font-heading font-black tracking-tighter uppercase">Crear <span className="orange-text-gradient">Evento</span></h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-12">
        {/* Basic Info */}
        <section className="space-y-6">
          <div className="flex items-center gap-2 text-primary">
            <Info className="w-5 h-5" />
            <h2 className="text-xl font-heading font-black uppercase tracking-tight">Información Básica</h2>
          </div>
          <Card className="glass p-8 rounded-[2.5rem] border-white/5 space-y-6">
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Título del Evento</label>
              <Input
                required
                placeholder="Ej: Noche de Jazz en Palermo"
                className="bg-white/5 border-white/10 h-14 rounded-2xl text-lg"
                value={formData.title}
                onChange={e => setFormData({...formData, title: e.target.value})}
              />
            </div>

            {/* Tipo de evento (categoría) — alimenta el filtro de la cartelera */}
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Tipo de evento</label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {EVENT_CATEGORIES.map(cat => {
                  const active = formData.category === cat.value;
                  return (
                    <button
                      key={cat.value}
                      type="button"
                      onClick={() => setFormData({ ...formData, category: cat.value })}
                      className={`flex items-center gap-2 px-3 h-12 rounded-2xl border text-sm font-bold transition-all ${active ? 'border-primary bg-primary/10 text-primary' : 'border-white/10 bg-white/5 text-muted-foreground hover:border-white/20'}`}
                    >
                      <cat.icon className="w-4 h-4 shrink-0" />
                      <span className="truncate">{cat.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Toggle: evento oculto (solo por link) */}
            <div className="flex items-center justify-between gap-4 p-4 rounded-2xl bg-white/5 border border-white/10">
              <div>
                <p className="text-sm font-heading font-black uppercase tracking-wide">Evento oculto</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">No aparece en la cartelera pública. Solo entra quien tenga el link directo.</p>
              </div>
              <button
                type="button"
                onClick={() => setIsHidden(v => !v)}
                aria-label="Evento oculto"
                className={`relative w-12 h-7 rounded-full transition-colors shrink-0 ${isHidden ? 'bg-primary' : 'bg-white/15'}`}
              >
                <span className={`absolute top-1 left-1 w-5 h-5 rounded-full bg-white transition-transform ${isHidden ? 'translate-x-5' : ''}`} />
              </button>
            </div>

            {/* Toggle: evento de varios días */}
            <div className="flex items-center justify-between gap-4 p-4 rounded-2xl bg-white/5 border border-white/10">
              <div>
                <p className="text-sm font-heading font-black uppercase tracking-wide">Evento de varios días</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">Para festivales o eventos de más de una jornada (ej: 5 días).</p>
              </div>
              <button
                type="button"
                onClick={() => setIsMultiDay(v => !v)}
                aria-label="Activar evento multi-día"
                className={`relative w-12 h-7 rounded-full transition-colors shrink-0 ${isMultiDay ? 'bg-primary' : 'bg-white/15'}`}
              >
                <span className={`absolute top-1 left-1 w-5 h-5 rounded-full bg-white transition-transform ${isMultiDay ? 'translate-x-5' : ''}`} />
              </button>
            </div>

            {!isMultiDay ? (
            <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <div className="flex justify-between items-center mb-1">
                  <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Fecha</label>
                  <label className="flex items-center gap-1.5 cursor-pointer select-none">
                    <input 
                      type="checkbox" 
                      className="accent-primary rounded border-white/10 bg-white/5 w-3.5 h-3.5"
                      checked={isDateProximamente}
                      onChange={e => {
                        setIsDateProximamente(e.target.checked);
                        if (e.target.checked) {
                          setFormData(prev => ({ ...prev, date: '' }));
                        }
                      }}
                    />
                    <span className="text-[10px] uppercase font-bold text-primary tracking-wide">Próximamente / TBD</span>
                  </label>
                </div>
                <Input 
                  required={!isDateProximamente}
                  disabled={isDateProximamente}
                  type="date" 
                  className="bg-white/5 border-white/10 h-14 rounded-2xl disabled:opacity-40 disabled:cursor-not-allowed text-white"
                  value={isDateProximamente ? "" : formData.date}
                  onChange={e => setFormData({...formData, date: e.target.value})}
                />
              </div>
              <div className="space-y-2">
                <div className="flex justify-between items-center mb-1">
                  <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Hora</label>
                  <label className="flex items-center gap-1.5 cursor-pointer select-none">
                    <input 
                      type="checkbox" 
                      className="accent-primary rounded border-white/10 bg-white/5 w-3.5 h-3.5 disabled:opacity-40"
                      checked={isTimeProximamente || isDateProximamente}
                      disabled={isDateProximamente}
                      onChange={e => {
                        setIsTimeProximamente(e.target.checked);
                        if (e.target.checked) {
                          setFormData(prev => ({ ...prev, time: '' }));
                        }
                      }}
                    />
                    <span className="text-[10px] uppercase font-bold text-primary tracking-wide">Próximamente / TBD</span>
                  </label>
                </div>
                <Input 
                  required={!isTimeProximamente && !isDateProximamente}
                  disabled={isTimeProximamente || isDateProximamente}
                  type="time" 
                  className="bg-white/5 border-white/10 h-14 rounded-2xl disabled:opacity-40 disabled:cursor-not-allowed text-white"
                  value={(isTimeProximamente || isDateProximamente) ? "" : formData.time}
                  onChange={e => setFormData({...formData, time: e.target.value})}
                />
              </div>
            </div>

            {/* Fin del evento (opcional) */}
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                Fin del evento <span className="text-primary/70 normal-case tracking-normal">(opcional)</span>
              </label>
              <Input
                type="datetime-local"
                disabled={isDateProximamente}
                className="bg-white/5 border-white/10 h-14 rounded-2xl disabled:opacity-40 disabled:cursor-not-allowed text-white [color-scheme:dark]"
                value={isDateProximamente ? '' : endDateTime}
                onChange={e => setEndDateTime(e.target.value)}
              />
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                A esta hora termina la venta y el evento sale de la cartelera. Si lo dejás vacío, se da por finalizado 3 horas después del inicio.
              </p>
            </div>
            </>
            ) : (
            <div className="space-y-5">
              {/* Mismo horario para todos los días */}
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input type="checkbox" className="accent-primary w-4 h-4" checked={sameSchedule} onChange={e => setSameSchedule(e.target.checked)} />
                <span className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Mismo horario todos los días</span>
              </label>

              {sameSchedule && (
                <div className="grid grid-cols-2 gap-4 max-w-sm">
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Desde</label>
                    <Input type="time" className="bg-white/5 border-white/10 h-12 rounded-2xl text-white" value={commonStart} onChange={e => setCommonStart(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Hasta</label>
                    <Input type="time" className="bg-white/5 border-white/10 h-12 rounded-2xl text-white" value={commonEnd} onChange={e => setCommonEnd(e.target.value)} />
                  </div>
                </div>
              )}

              {/* Lista de días */}
              <div className="space-y-3">
                {days.map((d, i) => (
                  <div key={i} className="flex flex-col sm:flex-row sm:items-end gap-3 p-4 rounded-2xl bg-white/5 border border-white/10">
                    <div className="flex items-center gap-3 sm:block">
                      <div className="flex items-center justify-center w-9 h-9 shrink-0 rounded-xl bg-primary/15 text-primary font-heading font-black text-sm">{i + 1}</div>
                    </div>
                    <div className="flex-grow space-y-2">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Día {i + 1}</label>
                      <Input type="date" className="bg-white/5 border-white/10 h-12 rounded-2xl text-white w-full" value={d.date} onChange={e => updateDay(i, { date: e.target.value })} />
                    </div>
                    {!sameSchedule && (
                      <div className="flex gap-2">
                        <div className="space-y-2">
                          <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Desde</label>
                          <Input type="time" className="bg-white/5 border-white/10 h-12 rounded-2xl text-white" value={d.startTime} onChange={e => updateDay(i, { startTime: e.target.value })} />
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Hasta</label>
                          <Input type="time" className="bg-white/5 border-white/10 h-12 rounded-2xl text-white" value={d.endTime} onChange={e => updateDay(i, { endTime: e.target.value })} />
                        </div>
                      </div>
                    )}
                    {days.length > 1 && (
                      <button type="button" onClick={() => removeDay(i)} className="h-12 w-12 shrink-0 flex items-center justify-center rounded-xl bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors self-end">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
                <button type="button" onClick={addDay} className="w-full flex items-center justify-center gap-2 h-12 rounded-2xl border-2 border-dashed border-white/10 text-muted-foreground hover:border-primary/40 hover:text-primary transition-colors text-sm font-bold">
                  <Plus className="w-4 h-4" /> Agregar día
                </button>
              </div>

              {/* Modalidad de ingreso */}
              <div className="space-y-2 pt-2">
                <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Modalidad de ingreso (QR)</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button type="button" onClick={() => setEntryMode('whole_event')} className={`text-left p-4 rounded-2xl border transition-all ${entryMode === 'whole_event' ? 'border-primary bg-primary/10' : 'border-white/10 bg-white/5 hover:border-white/20'}`}>
                    <p className="text-sm font-heading font-black">Un QR para todo el evento</p>
                    <p className="text-[11px] text-muted-foreground mt-1">Entra todos los días con el mismo QR, una vez por día (no se reusa el mismo día).</p>
                  </button>
                  <button type="button" onClick={() => setEntryMode('per_day')} className={`text-left p-4 rounded-2xl border transition-all ${entryMode === 'per_day' ? 'border-primary bg-primary/10' : 'border-white/10 bg-white/5 hover:border-white/20'}`}>
                    <p className="text-sm font-heading font-black">Un QR por día</p>
                    <p className="text-[11px] text-muted-foreground mt-1">Reservan por jornada. Permite cupo distinto por día (ej: día 1 solo invitados).</p>
                  </button>
                </div>
              </div>
            </div>
            )}
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Descripción</label>
              <Textarea 
                required
                placeholder="Contanos de qué se trata el evento..." 
                className="bg-white/5 border-white/10 min-h-[150px] rounded-2xl"
                value={formData.description}
                onChange={e => setFormData({...formData, description: e.target.value})}
              />
            </div>
          </Card>
        </section>

        {/* Location & Image */}
        <section className="space-y-6">
          <div className="flex items-center gap-2 text-primary">
            <MapPin className="w-5 h-5" />
            <h2 className="text-xl font-heading font-black uppercase tracking-tight">Lugar y Estética</h2>
          </div>
          <Card className="glass p-8 rounded-[2.5rem] border-white/5 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <div className="flex justify-between items-center mb-1">
                  <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Nombre del Lugar</label>
                  <label className="flex items-center gap-1.5 cursor-pointer select-none">
                    <input 
                      type="checkbox" 
                      className="accent-primary rounded border-white/10 bg-white/5 w-3.5 h-3.5"
                      checked={isVenueProximamente}
                      onChange={e => {
                        setIsVenueProximamente(e.target.checked);
                        if (e.target.checked) {
                          setFormData(prev => ({ ...prev, venue: 'Por definir' }));
                        } else {
                          setFormData(prev => ({ ...prev, venue: '' }));
                        }
                      }}
                    />
                    <span className="text-[10px] uppercase font-bold text-primary tracking-wide">Próximamente / TBD</span>
                  </label>
                </div>
                <Input 
                  required={!isVenueProximamente}
                  disabled={isVenueProximamente}
                  placeholder={isVenueProximamente ? "Por definir" : "Ej: Estadio Obras"} 
                  className="bg-white/5 border-white/10 h-14 rounded-2xl disabled:opacity-40 disabled:cursor-not-allowed text-white"
                  value={isVenueProximamente ? "Por definir" : formData.venue}
                  onChange={e => setFormData({...formData, venue: e.target.value})}
                />
              </div>
              <div className="space-y-2">
                <div className="flex justify-between items-center mb-1">
                  <label className="text-xs font-bold uppercase tracking-widest text-zinc-500">Ciudad / Zona</label>
                </div>
                <Input 
                  required
                  placeholder="Ej: CABA, Buenos Aires" 
                  className="bg-white/5 border-white/10 h-14 rounded-2xl text-white"
                  value={formData.location}
                  onChange={e => setFormData({...formData, location: e.target.value})}
                />
              </div>
            </div>
            <div className="space-y-3">
              <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Flyer / Imagen del evento</label>

              {/* Preview grande */}
              <div className="w-full aspect-[16/9] bg-white/5 rounded-2xl flex items-center justify-center border border-white/10 overflow-hidden">
                {formData.image && formData.image !== "" ? (
                  <img src={formData.image} className="w-full h-full object-cover" />
                ) : (
                  <div className="flex flex-col items-center gap-2 text-muted-foreground">
                    <ImageIcon className="w-8 h-8" />
                    <span className="text-xs">Subí una imagen o pegá un link</span>
                  </div>
                )}
              </div>

              <div className="flex flex-col sm:flex-row gap-3">
                {/* Subir archivo */}
                <label className={`flex-1 cursor-pointer flex items-center justify-center gap-2 h-12 rounded-2xl border-2 border-dashed transition-colors text-sm font-bold ${imageUploading ? 'border-primary/40 text-primary' : 'border-white/15 text-muted-foreground hover:border-primary/40 hover:text-primary'}`}>
                  {imageUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                  {imageUploading ? 'Subiendo...' : 'Subir imagen'}
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    disabled={imageUploading}
                    onChange={e => { handleImageFile(e.target.files?.[0], (url) => setFormData(fd => ({ ...fd, image: url }))); e.target.value = ''; }}
                  />
                </label>
                {formData.image && (
                  <button
                    type="button"
                    onClick={() => setFormData(fd => ({ ...fd, image: '' }))}
                    className="h-12 px-4 rounded-2xl bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors text-sm font-bold flex items-center justify-center gap-2"
                  >
                    <Trash2 className="w-4 h-4" /> Quitar
                  </button>
                )}
              </div>

              {/* O pegar link */}
              <div className="flex items-center gap-2">
                <LinkIcon className="w-4 h-4 text-muted-foreground shrink-0" />
                <Input
                  placeholder="...o pegá un link https://..."
                  className="bg-white/5 border-white/10 h-12 rounded-2xl flex-grow"
                  value={formData.image.startsWith('data:') ? '' : formData.image}
                  onChange={e => setFormData({ ...formData, image: e.target.value })}
                />
              </div>
              {imageError && <p className="text-xs text-red-400">{imageError}</p>}
            </div>
          </Card>
        </section>

        {/* Tickets */}
        <section className="space-y-6">
          <div className="flex items-center gap-2 text-primary">
            <Ticket className="w-5 h-5" />
            <h2 className="text-xl font-heading font-black uppercase tracking-tight">Tickets y Precios</h2>
          </div>
          <Card className="glass p-8 rounded-[2.5rem] border-white/5 space-y-6">
            {/* Toggle: evento gratuito */}
            <div className="flex items-center justify-between gap-4 p-4 rounded-2xl bg-white/5 border border-white/10">
              <div>
                <p className="text-sm font-heading font-black uppercase tracking-wide">Evento gratuito</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">Los asistentes reservan su lugar sin pagar (igual sacan su QR de acceso).</p>
              </div>
              <button
                type="button"
                onClick={() => setIsFreeEvent(v => !v)}
                aria-label="Evento gratuito"
                className={`relative w-12 h-7 rounded-full transition-colors shrink-0 ${isFreeEvent ? 'bg-primary' : 'bg-white/15'}`}
              >
                <span className={`absolute top-1 left-1 w-5 h-5 rounded-full bg-white transition-transform ${isFreeEvent ? 'translate-x-5' : ''}`} />
              </button>
            </div>

            {tickets.map((ticket, index) => (
              <div key={index} className="bg-white/5 border border-white/10 p-5 rounded-[2rem] relative group mb-6 transition-all hover:border-primary/20">
                <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                  {/* Nombre del Ticket - col-span-4 */}
                  <div className="space-y-1.5 md:col-span-4">
                    <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 ml-1">Tipo de Entrada</label>
                    <Input 
                      placeholder="Ej: General, VIP, Early Bird" 
                      className="bg-zinc-900/50 border-white/10 h-11 rounded-xl text-sm font-bold focus:ring-primary/20 shadow-inner"
                      value={ticket.type}
                      onChange={e => {
                        const newTickets = [...tickets];
                        newTickets[index].type = e.target.value;
                        setTickets(newTickets);
                      }}
                    />
                  </div>

                  {/* Precio - col-span-3 */}
                  <div className="space-y-1.5 md:col-span-3">
                    <div className="flex justify-between items-center px-1">
                      <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Precio ($)</label>
                      {ticket.price && Number(ticket.price) > 0 && (
                        <span className="text-[10px] font-black text-primary animate-in fade-in slide-in-from-right-1">{formatCurrency(Number(ticket.price))}</span>
                      )}
                    </div>
                    <Input
                      type="number"
                      placeholder={isFreeEvent ? 'Gratis' : '0'}
                      disabled={isFreeEvent}
                      className="bg-zinc-900/50 border-white/10 h-11 rounded-xl text-sm font-bold shadow-inner disabled:opacity-40 disabled:cursor-not-allowed"
                      value={isFreeEvent ? '' : (ticket.price === 0 ? '' : ticket.price)}
                      onChange={e => {
                        const newTickets = [...tickets];
                        newTickets[index].price = e.target.value === '' ? '' : Number(e.target.value);
                        setTickets(newTickets);
                      }}
                    />
                  </div>

                  {/* Cupo - col-span-3 */}
                  <div className="space-y-1.5 md:col-span-3">
                    <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 ml-1">Cupo (Disponibles) <span className="text-primary">*</span></label>
                    <Input 
                      type="number"
                      placeholder="100"
                      className="bg-zinc-900/50 border-white/10 h-11 rounded-xl text-sm font-bold shadow-inner"
                      value={ticket.available === 0 ? '' : ticket.available}
                      onChange={e => {
                        const newTickets = [...tickets];
                        newTickets[index].available = e.target.value === '' ? '' : Number(e.target.value);
                        setTickets(newTickets);
                      }}
                    />
                  </div>

                  {/* Early Bird - col-span-2 */}
                  <div className="space-y-1.5 md:col-span-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 ml-1">Early Bird</label>
                    <button
                      type="button"
                      onClick={() => {
                        const newTickets = [...tickets];
                        newTickets[index].isEarlyBird = !newTickets[index].isEarlyBird;
                        setTickets(newTickets);
                      }}
                      className={`w-full h-11 rounded-xl border flex items-center justify-center transition-all ${
                        ticket.isEarlyBird 
                          ? "bg-orange-500/10 border-orange-500/30 text-orange-400" 
                          : "bg-zinc-900/50 border-white/10 text-zinc-500"
                      }`}
                    >
                      <Sparkles className={`w-3.5 h-3.5 mr-2 ${ticket.isEarlyBird ? "animate-pulse" : ""}`} />
                      <span className="text-[10px] font-black uppercase">{ticket.isEarlyBird ? "SÍ" : "NO"}</span>
                    </button>
                  </div>
                </div>

                {tickets.length > 1 && (
                  <Button 
                    type="button"
                    variant="ghost" 
                    size="icon" 
                    onClick={() => removeTicketType(index)}
                    className="absolute -right-3 -top-3 w-8 h-8 rounded-full bg-red-500/10 text-red-400 opacity-0 group-hover:opacity-100 transition-opacity border border-red-500/20 hover:bg-red-500/20 hover:text-red-300 z-10"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                )}
              </div>
            ))}
            <Button 
              type="button"
              variant="outline" 
              onClick={addTicketType}
              className="w-full h-14 border-dashed border-white/10 hover:border-primary/50 hover:bg-primary/5 rounded-2xl text-muted-foreground hover:text-primary transition-all"
            >
              <Plus className="w-5 h-5 mr-2" />
              Agregar otro tipo de entrada
            </Button>
          </Card>
        </section>

        {/* ==================== CUSTOM FIELDS ==================== */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="bg-white/5 rounded-3xl border border-white/10 p-6"
        >
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-heading font-black text-lg">Campos personalizados</h3>
              <p className="text-xs text-zinc-500 mt-1">
                Agregá preguntas extras que los compradores deben completar al comprar (ej: talle, restricciones alimentarias, empresa).
                {customFields.length === 0 && ' Esto es opcional.'}
              </p>
            </div>
          </div>

          {customFields.length > 0 && (
            <div className="space-y-4 mb-4">
              {customFields.map((field, index) => (
                <div key={field.id} className="bg-white/5 rounded-2xl border border-white/10 p-4 space-y-3">
                  {/* Row 1: Label + Type + Required + Delete */}
                  <div className="grid grid-cols-12 gap-3 items-end">
                    {/* Label */}
                    <div className="col-span-12 md:col-span-5">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 block mb-1">
                        Nombre del campo
                      </label>
                      <input
                        type="text"
                        value={field.label}
                        onChange={(e) => updateCustomField(index, { label: e.target.value })}
                        placeholder="Ej: Talle de remera"
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-orange-500/50"
                      />
                    </div>

                    {/* Type */}
                    <div className="col-span-6 md:col-span-3">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 block mb-1">
                        Tipo
                      </label>
                      <select
                        value={field.type}
                        onChange={(e) =>
                          updateCustomField(index, {
                            type: e.target.value as 'text' | 'number' | 'select' | 'textarea',
                            // Limpiamos options si cambian de select a otro tipo
                            options: e.target.value === 'select' ? field.options : [],
                          })
                        }
                        className="w-full bg-zinc-900 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-orange-500/50 appearance-none"
                      >
                        <option value="text" className="bg-zinc-900 text-white">Texto</option>
                        <option value="number" className="bg-zinc-900 text-white">Número</option>
                        <option value="select" className="bg-zinc-900 text-white">Lista de opciones</option>
                        <option value="textarea" className="bg-zinc-900 text-white">Texto largo</option>
                      </select>
                    </div>

                    {/* Required toggle */}
                    <div className="col-span-4 md:col-span-3">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 block mb-1">
                        ¿Obligatorio?
                      </label>
                      <button
                        type="button"
                        onClick={() => updateCustomField(index, { required: !field.required })}
                        className={`w-full px-3 py-2 rounded-xl text-sm font-bold border transition ${
                          field.required
                            ? 'bg-orange-500/20 border-orange-500/40 text-orange-400'
                            : 'bg-white/5 border-white/10 text-zinc-400'
                        }`}
                      >
                        {field.required ? 'Sí' : 'No'}
                      </button>
                    </div>

                    {/* Delete */}
                    <div className="col-span-2 md:col-span-1 flex items-end justify-end">
                      <button
                        type="button"
                        onClick={() => setCustomFieldToDelete(index)}
                        className="p-2 rounded-xl bg-white/5 border border-white/10 hover:border-red-500/30 hover:text-red-400 transition"
                        title="Eliminar campo"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Row 2: Placeholder */}
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 block mb-1">
                      Placeholder (texto de ayuda)
                    </label>
                    <input
                      type="text"
                      value={field.placeholder}
                      onChange={(e) => updateCustomField(index, { placeholder: e.target.value })}
                      placeholder="Ej: Ingresá tu talle (S, M, L, XL)"
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-orange-500/50"
                    />
                  </div>

                  {/* Row 3: Options (only for select type) */}
                  {field.type === 'select' && (
                    <div>
                      <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 block mb-1">
                        Opciones (separadas por coma)
                      </label>
                      <input
                        type="text"
                        value={field.options.join(', ')}
                        onChange={(e) => handleOptionsChange(index, e.target.value)}
                        placeholder="S, M, L, XL"
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-orange-500/50"
                      />
                      {field.options.length > 0 && (
                        <div className="flex gap-1.5 mt-2 flex-wrap">
                          {field.options.map((opt, oi) => (
                            <span
                              key={oi}
                              className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-orange-500/10 text-orange-400"
                            >
                              {opt}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          <button
            type="button"
            onClick={addCustomField}
            className="w-full border-2 border-dashed border-white/10 rounded-2xl py-3 text-sm font-bold text-zinc-500 hover:text-orange-400 hover:border-orange-500/30 transition"
          >
            + Agregar campo personalizado
          </button>
        </motion.div>

        {/* Toggle: permitir transferencia */}
        <div className="flex items-center justify-between p-6 rounded-[2rem] bg-white/5 border border-white/10">
          <div className="flex-1 pr-4">
            <label className="font-bold text-lg block mb-1">Permitir transferencia de tickets</label>
            <p className="text-sm text-zinc-400">
              Los compradores podrán transferir su ticket a otra persona sin costo. El QR original queda invalidado al transferir.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setFormData({ ...formData, allowTransfer: !formData.allowTransfer })}
            className={`relative w-14 h-8 rounded-full transition-colors ${
              formData.allowTransfer ? 'bg-orange-500' : 'bg-white/10'
            }`}
            aria-label="Toggle transferencias"
          >
            <div
              className={`absolute top-1.5 w-5 h-5 bg-white rounded-full transition-transform ${
                formData.allowTransfer ? 'translate-x-7' : 'translate-x-1.5'
              }`}
            />
          </button>
        </div>

        {/* Resumen de capacidad */}
        <div className={`flex items-center justify-between gap-3 px-5 py-4 rounded-2xl border ${capacityValid ? 'bg-white/5 border-white/10' : 'bg-red-500/5 border-red-500/30'}`}>
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm font-bold">Capacidad total del evento</span>
          </div>
          <span className={`text-lg font-heading font-black ${capacityValid ? 'text-primary' : 'text-red-400'}`}>
            {totalCapacity} {totalCapacity === 1 ? 'entrada' : 'entradas'}
          </span>
        </div>
        {!capacityValid && (
          <p className="text-xs text-red-400 -mt-2 px-1">
            Cada entrada tiene que tener un cupo cargado y el evento debe tener más de 1 entrada a la venta.
          </p>
        )}

        <Button
          type="submit"
          disabled={loading || !capacityValid}
          className="w-full h-20 orange-gradient border-none font-heading font-black text-2xl rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? "Enviando..." : "Enviar a revisión"}
        </Button>
      </form>

      {/* Delete Ticket Confirmation Modal */}
      {ticketToDelete !== null && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-6">
          <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
            className="bg-zinc-900 border border-white/10 p-8 rounded-[2.5rem] max-w-md w-full space-y-6">
            <div className="flex items-center gap-3">
              <div className="bg-red-500/20 p-3 rounded-2xl">
                <Trash2 className="w-6 h-6 text-red-400" />
              </div>
              <h3 className="text-2xl font-black">Eliminar Sector</h3>
            </div>
            <p className="text-sm text-zinc-400">
              ¿Estás seguro de eliminar el sector <strong className="text-white">{tickets[ticketToDelete]?.type || 'este sector'}</strong>?
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
                className="flex-1 px-6 py-3 rounded-2xl bg-red-600 text-white font-bold transition"
              >
                Eliminar
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Delete Custom Field Confirmation */}
      {customFieldToDelete !== null && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-zinc-900 rounded-3xl border border-white/10 p-6 max-w-sm w-full"
          >
            <h3 className="font-bold text-lg mb-2">Eliminar campo</h3>
            <p className="text-sm text-zinc-400 mb-6">
              ¿Estás seguro de que querés eliminar el campo
              <strong className="text-white">
                {' '}
                {customFields[customFieldToDelete]?.label || '(sin nombre)'}
              </strong>
              ? Si ya hay compradores que lo completaron, sus respuestas seguirán en los tickets, pero el campo no se mostrará más en Checkout.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setCustomFieldToDelete(null)}
                className="flex-1 px-4 py-2.5 rounded-2xl bg-white/5 hover:bg-white/10 font-bold text-sm transition"
              >
                Cancelar
              </button>
              <button
                onClick={confirmRemoveCustomField}
                className="flex-1 px-4 py-2.5 rounded-2xl bg-red-500/20 text-red-400 hover:bg-red-500/30 font-bold text-sm transition"
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
