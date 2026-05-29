import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card } from '@/src/components/ui/card';
import { Button } from '@/src/components/ui/button';
import { Badge } from '@/src/components/ui/badge';
import { Input } from '@/src/components/ui/input';
import { Html5Qrcode } from 'html5-qrcode';
import { 
  QrCode, Users, CheckCircle2, XCircle, Search, Scan, BarChart, Ticket, 
  ArrowLeft, Camera, Zap, Loader2, Play, Square, Calendar, MapPin, Sparkles, Clock, AlertTriangle
} from 'lucide-react';
import { collection, query, orderBy, limit, onSnapshot, addDoc, Timestamp, doc, updateDoc, where, getDocs } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '@/src/lib/firebase';
import { useAuth } from '@/src/context/AuthContext';
import { cn } from '@/lib/utils';

interface EventData {
  id: string;
  title: string;
  date: string;
  time?: string;
  venue: string;
  location?: string;
  status: string;
  organizerEmail: string;
  category?: string;
  image?: string;
}

interface CheckIn {
  id: string;
  ticketId: string;
  attendeeName: string;
  ticketType?: string;
  timestamp: any;
  status: 'success' | 'warning' | 'error';
  eventId: string;
}

export default function AccessControl() {
  const { user, profile, loading: authLoading } = useAuth();
  const [events, setEvents] = useState<EventData[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<EventData | null>(null);
  const [eventSearch, setEventSearch] = useState('');
  
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [manualTicketCode, setManualTicketCode] = useState('');
  const [processing, setProcessing] = useState(false);
  
  const [scanFeedback, setScanFeedback] = useState<{
    type: 'success' | 'warning' | 'error';
    message: string;
    name?: string;
    ticketType?: string;
    sub?: string;
  } | null>(null);

  // Buscador por persona (apellido / DNI / mail)
  const [personQuery, setPersonQuery] = useState('');
  const [personResults, setPersonResults] = useState<any[]>([]);
  const [searchingPerson, setSearchingPerson] = useState(false);
  const [personSearched, setPersonSearched] = useState(false);

  const [checkIns, setCheckIns] = useState<CheckIn[]>([]);
  const [stats, setStats] = useState({
    ingresaron: 0,
    vendidos: 0,
    faltan: 0
  });

  const html5QrCodeRef = useRef<Html5Qrcode | null>(null);
  const isCooldown = useRef(false);

  // 1. Fetch events for selection
  useEffect(() => {
    if (!user) return;

    const isSuperAdmin = profile?.role === 'superadmin' || profile?.role === 'admin';
    let q;
    
    if (isSuperAdmin) {
      q = query(collection(db, 'events'));
    } else {
      q = query(collection(db, 'events'), where('organizerEmail', '==', user.email));
    }

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as EventData));
      // Exclude deleted events
      const activeEvents = list.filter(e => e.status !== 'deleted');
      setEvents(activeEvents);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'events');
    });

    return () => unsubscribe();
  }, [user, profile]);

  // 2. Real-time stats & history listeners when event is selected
  useEffect(() => {
    if (!selectedEvent) {
      setCheckIns([]);
      setStats({ ingresaron: 0, vendidos: 0, faltan: 0 });
      return;
    }

    // A. Listen to tickets for real-time count
    const qTickets = query(collection(db, 'tickets'), where('eventId', '==', selectedEvent.id));
    const unsubscribeTickets = onSnapshot(qTickets, (snapshot) => {
      const allTickets = snapshot.docs.map(doc => doc.data());
      const vendidos = snapshot.size;
      const ingresaron = allTickets.filter(t => t.status === 'used').length;
      const faltan = Math.max(0, vendidos - ingresaron);
      
      setStats({
        ingresaron,
        vendidos,
        faltan
      });
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'tickets');
    });

    // B. Listen to check-ins for entry history (real-time, filtered by eventId)
    const qCheckins = query(
      collection(db, 'checkins'), 
      where('eventId', '==', selectedEvent.id)
    );
    const unsubscribeCheckins = onSnapshot(qCheckins, (snapshot) => {
      const logs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as CheckIn));
      // Sort in-memory desc to avoid requiring composite indexes
      logs.sort((a, b) => {
        const aTime = a.timestamp?.seconds || 0;
        const bTime = b.timestamp?.seconds || 0;
        return bTime - aTime;
      });
      setCheckIns(logs.slice(0, 50));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'checkins');
    });

    return () => {
      unsubscribeTickets();
      unsubscribeCheckins();
    };
  }, [selectedEvent]);

  // 3. Camera scanning initialize and cleanup
  useEffect(() => {
    if (!selectedEvent || !cameraActive) {
      cleanupScanner();
      return;
    }

    setCameraError(null);
    
    // Tiny delay to ensure DOM element is mounted
    const timer = setTimeout(() => {
      const qrReaderElement = document.getElementById("qr-reader-element");
      if (!qrReaderElement) return;

      try {
        const html5QrCode = new Html5Qrcode("qr-reader-element");
        html5QrCodeRef.current = html5QrCode;

        html5QrCode.start(
          { facingMode: "environment" },
          {
            fps: 15,
            qrbox: (width, height) => {
              const size = Math.min(width, height) * 0.7;
              return { width: size, height: size };
            }
          },
          (decodedText) => {
            if (!isCooldown.current) {
              processTicket(decodedText);
            }
          },
          () => {
            // Noise parser callback (ignored to keep console spam free)
          }
        ).catch((err) => {
          console.error("Camera start failed:", err);
          setCameraError("No se pudo acceder a la cámara trasera. Asegurate de dar permisos de cámara.");
          setCameraActive(false);
        });
      } catch (err) {
        console.error("Scanner exception:", err);
        setCameraError("Error al iniciar el módulo de escaneo.");
        setCameraActive(false);
      }
    }, 150);

    return () => {
      clearTimeout(timer);
      cleanupScanner();
    };
  }, [selectedEvent, cameraActive]);

  const cleanupScanner = () => {
    if (html5QrCodeRef.current) {
      if (html5QrCodeRef.current.isScanning) {
        html5QrCodeRef.current.stop().then(() => {
          html5QrCodeRef.current = null;
        }).catch(err => {
          console.error("Error stopping scanner asynchronously:", err);
          html5QrCodeRef.current = null;
        });
      } else {
        html5QrCodeRef.current = null;
      }
    }
  };

  const triggerVibration = (type: 'success' | 'warning' | 'error') => {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      try {
        if (type === 'success') {
          navigator.vibrate([100, 50, 100]);
        } else if (type === 'warning') {
          navigator.vibrate([300, 150, 300]);
        } else {
          navigator.vibrate(500);
        }
      } catch (err) {
        console.warn("navigator.vibrate is blocked or unsupported.", err);
      }
    }
  };

  // Tiempo transcurrido legible (para "usado hace X")
  const timeAgo = (ts: any): string => {
    try {
      const then = ts?.toDate ? ts.toDate() : (ts?.seconds ? new Date(ts.seconds * 1000) : null);
      if (!then) return '';
      const secs = Math.max(0, Math.floor((Date.now() - then.getTime()) / 1000));
      if (secs < 60) return `hace ${secs} ${secs === 1 ? 'segundo' : 'segundos'}`;
      const mins = Math.floor(secs / 60);
      if (mins < 60) return `hace ${mins} ${mins === 1 ? 'minuto' : 'minutos'}`;
      const hrs = Math.floor(mins / 60);
      const rem = mins % 60;
      if (hrs < 24) return `hace ${hrs}h${rem ? ` ${rem}min` : ''}`;
      return `hace ${Math.floor(hrs / 24)} día(s)`;
    } catch {
      return '';
    }
  };

  // Helper trigger for visual result and haptic feedback
  const triggerFeedback = (
    type: 'success' | 'warning' | 'error',
    message: string,
    name?: string,
    ticketType?: string,
    sub?: string
  ) => {
    setScanFeedback({ type, message, name, ticketType, sub });
    triggerVibration(type);
  };

  // Main ticket processing logic
  const processTicket = async (code: string) => {
    if (!selectedEvent || isCooldown.current || !code.trim()) return;
    
    isCooldown.current = true;
    setProcessing(true);

    try {
      // 1. Search ticket collection by qrCode field
      const ticketsCol = collection(db, 'tickets');
      const q = query(ticketsCol, where('qrCode', '==', code.trim()));
      const snap = await getDocs(q);

      if (snap.empty) {
        triggerFeedback('error', 'Ticket no encontrado / Código inválido');
        return;
      }

      const ticketDoc = snap.docs[0];
      const ticketData = ticketDoc.data();
      const buyerName = ticketData.buyerName || 'Invitado';
      const ticketType = ticketData.ticketType || 'Mismo Tipo';

      // 2. Map of conditions
      if (ticketData.eventId !== selectedEvent.id) {
        triggerFeedback('error', 'Ticket pertenece a otro evento', buyerName, ticketType);
        return;
      }

      if (ticketData.status === 'cancelled' || ticketData.status === 'refunded') {
        triggerFeedback('error', 'Ticket cancelado / devuelto', buyerName, ticketType);
        return;
      }

      if (ticketData.status === 'used') {
        const usedAgo = timeAgo(ticketData.usedAt);
        triggerFeedback(
          'error',
          'DENEGADO · YA UTILIZADO',
          buyerName,
          ticketType,
          usedAgo ? `Ingresó ${usedAgo}` : undefined
        );
        // Registrar el intento de reingreso denegado en el historial
        try {
          await addDoc(collection(db, 'checkins'), {
            ticketId: ticketDoc.id,
            attendeeName: buyerName,
            ticketType: ticketType,
            timestamp: Timestamp.now(),
            status: 'error',
            eventId: selectedEvent.id,
          });
        } catch { /* no bloqueamos por el log */ }
        return;
      }

      // 3. Document is valid! Perform atomic-like state change
      await updateDoc(doc(db, 'tickets', ticketDoc.id), {
        status: 'used',
        usedAt: Timestamp.now()
      });

      // 4. Save checkin list
      await addDoc(collection(db, 'checkins'), {
        ticketId: ticketDoc.id,
        attendeeName: buyerName,
        ticketType: ticketType,
        timestamp: Timestamp.now(),
        status: 'success',
        eventId: selectedEvent.id
      });

      triggerFeedback('success', '¡Ingreso autorizado!', buyerName, ticketType);

    } catch (error) {
      console.error("Access Control verification error:", error);
      triggerFeedback('error', 'Error al procesar ticket');
    } finally {
      setProcessing(false);
      setManualTicketCode('');
      // Enforce 2.5 seconds scanning cooldown to avoid double reading
      setTimeout(() => {
        isCooldown.current = false;
        setScanFeedback(null);
      }, 2500);
    }
  };

  const handleManualCodeSubmit = () => {
    if (!manualTicketCode.trim()) return;
    processTicket(manualTicketCode);
  };

  // Buscar la compra por apellido / DNI / mail (para cuando no tienen el QR)
  const handlePersonSearch = async () => {
    if (!selectedEvent || !personQuery.trim()) return;
    setSearchingPerson(true);
    setPersonSearched(true);
    try {
      const snap = await getDocs(query(collection(db, 'tickets'), where('eventId', '==', selectedEvent.id)));
      const q = personQuery.trim().toLowerCase();
      const results = snap.docs
        .map((d) => ({ id: d.id, ...d.data() } as any))
        .filter(
          (t) =>
            (t.buyerName || '').toLowerCase().includes(q) ||
            (t.buyerEmail || '').toLowerCase().includes(q) ||
            String(t.buyerDni || '').toLowerCase().includes(q)
        )
        .sort((a, b) => (a.status === 'used' ? 1 : 0) - (b.status === 'used' ? 1 : 0))
        .slice(0, 20);
      setPersonResults(results);
    } catch (e) {
      console.error('Error buscando persona:', e);
      setPersonResults([]);
    } finally {
      setSearchingPerson(false);
    }
  };

  // Validar (quemar) una entrada encontrada en la búsqueda por persona
  const handleValidateResult = async (t: any) => {
    isCooldown.current = false; // permitir validar desde la búsqueda aunque venga de un escaneo reciente
    await processTicket(t.qrCode);
    // refrescar resultados para reflejar el nuevo estado (usado / hace cuánto)
    setTimeout(() => { handlePersonSearch(); }, 500);
  };

  const activeEventsList = events.filter(e => 
    e.title.toLowerCase().includes(eventSearch.toLowerCase()) ||
    e.venue.toLowerCase().includes(eventSearch.toLowerCase())
  );

  // loading view
  if (authLoading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-primary animate-spin mx-auto mb-4" />
          <p className="text-zinc-400 text-sm">Validando credenciales...</p>
        </div>
      </div>
    );
  }

  // Access check
  const isAuthorized = user && profile && (profile.role === 'organizer' || profile.role === 'admin' || profile.role === 'superadmin');

  if (!isAuthorized) {
    return (
      <div className="min-h-screen pt-32 pb-20 px-6 max-w-lg mx-auto flex items-center">
        <Card className="glass p-10 rounded-[2.5rem] border-white/5 text-center space-y-6">
          <div className="w-20 h-20 bg-red-500/10 text-red-500 rounded-full flex items-center justify-center mx-auto">
            <XCircle className="w-10 h-10" />
          </div>
          <div>
            <h2 className="text-2xl font-heading font-black uppercase tracking-tight text-white mb-2">Acceso Denegado</h2>
            <p className="text-zinc-400 text-sm leading-relaxed">
              Necesitás una cuenta de organizador autorizada para utilizar las herramientas de control de acceso.
            </p>
          </div>
          <Button onClick={() => window.location.href = '/'} className="w-full h-12 orange-gradient border-none font-bold rounded-xl mt-4">
            Volver al inicio
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen pt-28 pb-20 px-6 max-w-7xl mx-auto space-y-10">
      
      {/* Styles for camera container inside AccessControl */}
      <style>{`
        #qr-reader-element video {
          width: 100% !important;
          height: 100% !important;
          object-fit: cover !important;
          border-radius: 1.5rem !important;
        }
        #qr-reader-element {
          border: none !important;
        }
        #qr-reader-element__dashboard {
          display: none !important;
        }
      `}</style>

      <AnimatePresence mode="wait">
        {!selectedEvent ? (
          /* =========================================================================
             1. SELECTOR DE EVENTO
             ========================================================================= */
          <motion.div
            key="event-selector"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            className="space-y-8"
          >
            <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Badge variant="outline" className="border-primary/30 text-primary uppercase font-mono px-3 py-1 text-[10px]">
                    Puerta de Acceso
                  </Badge>
                  <span className="text-zinc-500 text-xs">• Real-Time Tracking</span>
                </div>
                <h1 className="text-4xl font-heading font-black tracking-tighter uppercase text-white pb-1">Control de Acceso (QR)</h1>
                <p className="text-zinc-400 text-sm max-w-xl">
                  Seleccioná el evento que vas a controlar en boletería. El sistema buscará y validará ingresos en vivo.
                </p>
              </div>

              {/* Search bar inside event list */}
              <div className="relative w-full md:w-80">
                <Search className="absolute left-4.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-zinc-500" />
                <Input 
                  placeholder="Buscar evento..." 
                  className="pl-12 h-11 bg-white/5 border-white/5 rounded-2xl text-white placeholder:text-zinc-500 focus:border-primary/50 transition-all text-sm"
                  value={eventSearch}
                  onChange={(e) => setEventSearch(e.target.value)}
                />
              </div>
            </div>

            {/* Event list grid cards with beautiful glassmorphism */}
            {activeEventsList.length === 0 ? (
              <Card className="glass p-16 rounded-[2.5rem] border-white/5 text-center space-y-4">
                <div className="w-16 h-16 bg-zinc-800/50 text-zinc-400 rounded-full flex items-center justify-center mx-auto">
                  <Calendar className="w-8 h-8" />
                </div>
                <div className="space-y-1">
                  <h3 className="font-heading font-bold text-lg text-white">No se encontraron eventos activos</h3>
                  <p className="text-zinc-500 text-sm max-w-sm mx-auto">
                    {eventSearch ? 'Probá con otro término de búsqueda.' : 'No tenés eventos creados activos para controlar.'}
                  </p>
                </div>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {activeEventsList.map((e) => (
                  <motion.div
                    key={e.id}
                    className="cursor-pointer"
                    onClick={() => setSelectedEvent(e)}
                  >
                    <Card className="glass h-full p-6 rounded-3xl border-white/5 hover:border-primary/25 transition-all relative overflow-hidden group flex flex-col justify-between">
                      <div className="space-y-4">
                        {/* Event Category Badge */}
                        <div className="flex justify-between items-start gap-4">
                          <Badge variant="outline" className="border-white/10 text-zinc-400 bg-white/5 text-[9px] uppercase px-2.5 py-0.5 rounded-lg">
                            {e.category || 'Eventos'}
                          </Badge>
                          <span className="text-[10px] uppercase font-mono tracking-wider text-green-400 bg-green-500/10 px-2 py-0.5 rounded-md font-bold">
                            Activo
                          </span>
                        </div>

                        <div>
                          <h3 className="text-xl font-heading font-black text-white group-hover:text-primary transition-colors leading-tight line-clamp-2">
                            {e.title}
                          </h3>
                        </div>
                      </div>

                      <div className="mt-6 border-t border-white/5 pt-4 space-y-2">
                        <div className="flex items-center gap-2 text-zinc-400 text-xs">
                          <Calendar className="w-4 h-4 text-primary shrink-0" />
                          <span>{e.date} {e.time ? `• ${e.time} hs` : ''}</span>
                        </div>
                        <div className="flex items-center gap-2 text-zinc-400 text-xs">
                          <MapPin className="w-4 h-4 text-zinc-500 shrink-0" />
                          <span className="truncate">{e.venue}</span>
                        </div>
                      </div>

                      {/* Spark decorator inside hover */}
                      <div className="absolute right-6 top-6 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Sparkles className="w-5 h-5 text-primary/40 animate-pulse" />
                      </div>
                    </Card>
                  </motion.div>
                ))}
              </div>
            )}
          </motion.div>
        ) : (
          /* =========================================================================
             2. CAMERAS / CHECK-IN CONTROLS
             ========================================================================= */
          <motion.div
            key="scanner-dashboard"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            className="space-y-8"
          >
            {/* Top Navigation Panel */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/5 pb-6">
              <div className="space-y-1">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => {
                    cleanupScanner();
                    setCameraActive(false);
                    setSelectedEvent(null);
                  }}
                  className="rounded-xl border-white/10 text-zinc-400 hover:text-white mb-2 px-3 h-8 gap-1.5"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Elegir otro evento
                </Button>
                <div className="flex items-center gap-2">
                  <Badge className="bg-primary/10 text-primary border-none text-[9px] uppercase px-2 py-0.5">
                    Modo Control
                  </Badge>
                  <span className="text-zinc-500 text-xs">{selectedEvent.venue}</span>
                </div>
                <h1 className="text-3xl font-heading font-black uppercase text-white tracking-tight line-clamp-1">
                  {selectedEvent.title}
                </h1>
              </div>

              {/* Status info */}
              <div className="flex gap-2 shrink-0">
                <div className="flex items-center gap-1.5 bg-white/5 border border-white/5 rounded-2xl px-3 py-1.5 text-xs text-zinc-300">
                  <span className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse" />
                  <span>Sincronizado</span>
                </div>
              </div>
            </div>

            {/* Grid Layout: Controls / Scanner & History */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
              
              {/* Left Side: Stats & Cam controller (8 cols) */}
              <div className="lg:col-span-7 space-y-6">
                
                {/* Stats Widget cards */}
                <div className="grid grid-cols-3 gap-2 sm:gap-4">
                  {[
                    { label: 'INGRESARON', value: stats.ingresaron, icon: Users, color: 'text-primary' },
                    { label: 'VENDIDOS', value: stats.vendidos, icon: Ticket, color: 'text-sky-400' },
                    { label: 'RESTANTES', value: stats.faltan, icon: BarChart, color: 'text-emerald-400' },
                  ].map((s, idx) => (
                    <Card key={idx} className="glass p-5 rounded-2xl border-white/5 text-center flex flex-col justify-between">
                      <div>
                        <div className="text-[10px] uppercase font-mono tracking-widest text-zinc-500 mb-2 whitespace-nowrap overflow-hidden">
                          {s.label}
                        </div>
                        <div className="text-3xl font-heading font-black text-white">
                          {s.value}
                        </div>
                      </div>
                      <div className="mt-3 flex items-center justify-center gap-1">
                        <s.icon className={cn("w-3.5 h-3.5", s.color)} />
                        {s.label === 'INGRESARON' && stats.vendidos > 0 && (
                          <span className="text-[10px] text-zinc-400 font-bold">
                            ({Math.round((stats.ingresaron / stats.vendidos) * 100)}%)
                          </span>
                        )}
                      </div>
                    </Card>
                  ))}
                </div>

                {/* Main QR Scanner Box */}
                <Card className="glass rounded-[2.5rem] border-white/5 p-8 overflow-hidden relative flex flex-col items-center justify-center min-h-[460px]">
                  
                  {/* Visual Validation Overlay */}
                  <AnimatePresence>
                    {scanFeedback && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className={cn(
                          "absolute inset-0 z-50 flex flex-col items-center justify-center p-6 text-center rounded-[2.3rem]",
                          scanFeedback.type === 'success' && "bg-green-600 text-white",
                          scanFeedback.type === 'warning' && "bg-amber-500 text-zinc-950",
                          scanFeedback.type === 'error' && "bg-red-600 text-white"
                        )}
                      >
                        <div className={cn(
                          "w-22 h-22 rounded-full flex items-center justify-center mb-6",
                          scanFeedback.type === 'success' && "bg-white/20 text-white",
                          scanFeedback.type === 'warning' && "bg-black/10 text-zinc-950",
                          scanFeedback.type === 'error' && "bg-white/20 text-white"
                        )}>
                          {scanFeedback.type === 'success' && <CheckCircle2 className="w-12 h-12" />}
                          {scanFeedback.type === 'warning' && <AlertTriangle className="w-12 h-12 animate-bounce" />}
                          {scanFeedback.type === 'error' && <XCircle className="w-12 h-12" />}
                        </div>
                        
                        <h2 className="text-3xl font-heading font-black uppercase tracking-tight mb-2">
                          {scanFeedback.message}
                        </h2>
                        
                        {scanFeedback.name && (
                          <div className="mt-2 space-y-1">
                            <p className="text-[10px] uppercase tracking-widest font-bold opacity-75">Asistente</p>
                            <p className="text-2xl font-black">{scanFeedback.name}</p>
                          </div>
                        )}
                        
                        {scanFeedback.ticketType && (
                          <div className={cn(
                            "mt-4 px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider inline-block",
                            scanFeedback.type === 'warning' ? "bg-black/10" : "bg-white/15"
                          )}>
                            Entrada: {scanFeedback.ticketType}
                          </div>
                        )}

                        {scanFeedback.sub && (
                          <p className="mt-4 text-base font-black uppercase tracking-wide opacity-95">
                            {scanFeedback.sub}
                          </p>
                        )}

                        {/* Cooldown progress bar */}
                        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 w-48 h-1 bg-black/10 rounded-full overflow-hidden">
                          <motion.div 
                            initial={{ width: "100%" }}
                            animate={{ width: "0%" }}
                            transition={{ duration: 2.5, ease: "linear" }}
                            className={cn(
                              "h-full",
                              scanFeedback.type === 'warning' ? "bg-zinc-950" : "bg-white"
                            )}
                          />
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Camera view element */}
                  <div className="w-full flex flex-col items-center justify-center space-y-6">
                    
                    {cameraActive ? (
                      <div className="relative w-full max-w-sm aspect-square bg-zinc-900 rounded-3xl overflow-hidden border border-white/10 flex items-center justify-center">
                        <div id="qr-reader-element" className="w-full h-full" />
                        
                        {/* Custom visual targets */}
                        <div className="absolute inset-0 pointer-events-none border-[30px] border-black/40 flex items-center justify-center">
                          <div className="w-48 h-48 border-2 border-primary rounded-2xl relative">
                            {/* Scanning horizontal line */}
                            <motion.div 
                              animate={{ y: [0, 188, 0] }}
                              transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
                              className="absolute top-0 left-0 w-full h-0.5 bg-primary shadow-[0_0_10px_#ff5c00]"
                            />
                          </div>
                        </div>
                      </div>
                    ) : (
                      /* Idle State (No Cam Active) */
                      <div className="text-center py-8 space-y-4">
                        <div className="w-24 h-24 bg-white/5 text-zinc-500 rounded-full flex items-center justify-center mx-auto border border-white/5">
                          <QrCode className="w-12 h-12" />
                        </div>
                        <div className="space-y-1">
                          <h4 className="font-heading font-bold text-white uppercase text-sm tracking-widest text-zinc-300">Cámara Inactiva</h4>
                          <p className="text-zinc-500 text-xs max-w-xs mx-auto">
                            Iniciá la cámara trasera del dispositivo para empezar a escanear entradas.
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Camera Trigger Buttons */}
                    <div className="flex gap-4 w-full max-w-sm justify-center">
                      {!cameraActive ? (
                        <Button 
                          onClick={() => { setCameraActive(true); setCameraError(null); }}
                          className="w-full h-13 orange-gradient border-none font-bold text-sm rounded-2xl flex items-center justify-center gap-2 text-white"
                        >
                          <Camera className="w-5 h-5" />
                          <span>Iniciar Cámara</span>
                        </Button>
                      ) : (
                        <Button 
                          onClick={() => setCameraActive(false)}
                          variant="outline"
                          className="w-full h-13 border-white/10 text-zinc-400 hover:text-white font-bold text-sm rounded-2xl flex items-center justify-center gap-2"
                        >
                          <Square className="w-5 h-5 fill-current shrink-0" />
                          <span>Pausar Escáner</span>
                        </Button>
                      )}
                    </div>

                    {cameraError && (
                      <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-500 text-xs max-w-sm text-center flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 shrink-0" />
                        <span>{cameraError}</span>
                      </div>
                    )}

                    {/* Buscar persona (sin QR): apellido, DNI o mail */}
                    <div className="w-full max-w-sm border-t border-white/5 pt-6 space-y-3">
                      <div className="text-xs uppercase font-mono tracking-widest text-zinc-500 text-center">
                        Buscar persona (sin QR)
                      </div>
                      <div className="flex gap-2">
                        <div className="relative flex-grow">
                          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                          <Input
                            placeholder="Apellido, DNI o mail..."
                            className="pl-10 h-11 bg-white/5 border-white/10 rounded-xl text-white placeholder:text-zinc-600 text-sm focus:border-primary/50"
                            value={personQuery}
                            onChange={(e) => setPersonQuery(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handlePersonSearch()}
                            disabled={searchingPerson}
                          />
                        </div>
                        <Button
                          onClick={handlePersonSearch}
                          disabled={searchingPerson || !personQuery.trim()}
                          className="px-5 h-11 orange-gradient border-none font-heading font-black text-xs rounded-xl text-white"
                        >
                          {searchingPerson ? '...' : 'Buscar'}
                        </Button>
                      </div>

                      {/* Resultados de la búsqueda */}
                      {personSearched && !searchingPerson && personResults.length === 0 && (
                        <p className="text-zinc-500 text-xs text-center py-2">No se encontró ninguna compra con ese dato.</p>
                      )}
                      <div className="space-y-2">
                        {personResults.map((t) => {
                          const used = t.status === 'used';
                          const dead = t.status === 'refunded' || t.status === 'cancelled';
                          return (
                            <div key={t.id} className="flex items-center justify-between gap-2 p-3 rounded-xl bg-white/5 border border-white/10 text-left">
                              <div className="min-w-0">
                                <p className="text-sm font-bold text-white truncate">{t.buyerName || 'Sin nombre'}</p>
                                <p className="text-[10px] text-zinc-500 truncate">
                                  {t.ticketType}{t.buyerDni ? ` · DNI ${t.buyerDni}` : (t.buyerEmail ? ` · ${t.buyerEmail}` : '')}
                                </p>
                                {used && <p className="text-[10px] text-red-400 font-bold mt-0.5">Ya ingresó {timeAgo(t.usedAt)}</p>}
                                {dead && <p className="text-[10px] text-red-400 font-bold mt-0.5">Devuelto / cancelado</p>}
                              </div>
                              <Button
                                onClick={() => handleValidateResult(t)}
                                disabled={processing || used || dead}
                                className={cn(
                                  "px-3 h-9 text-[11px] font-heading font-black rounded-lg shrink-0",
                                  used || dead ? "bg-white/5 text-zinc-500 border border-white/10" : "orange-gradient text-white"
                                )}
                              >
                                {used ? 'Usado' : dead ? '—' : 'Validar'}
                              </Button>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                  </div>
                </Card>
              </div>

              {/* Right Side: Check-Ins real-time log list (5 cols) */}
              <div className="lg:col-span-5 space-y-6">
                <Card className="glass p-6 rounded-[2rem] border-white/5 flex flex-col min-h-[460px]">
                  <h3 className="text-base font-heading font-bold text-white mb-4 flex items-center gap-2 uppercase tracking-wide">
                    <Scan className="w-4.5 h-4.5 text-primary" />
                    Historial de Ingresos ({stats.ingresaron})
                  </h3>

                  <div className="space-y-3 overflow-y-auto max-h-[400px] flex-grow pr-1">
                    {checkIns.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-20 text-center space-y-2">
                        <Users className="w-10 h-10 text-zinc-600" />
                        <p className="text-zinc-500 text-xs">No hay ingresos registrados en este navegador.</p>
                      </div>
                    ) : (
                      checkIns.map((log) => (
                        <div 
                          key={log.id} 
                          className="flex items-center justify-between p-3.5 rounded-xl bg-white/5 border border-white/5 hover:border-white/10 transition-colors"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div className={cn(
                              "w-8.5 h-8.5 rounded-full flex items-center justify-center shrink-0",
                              log.status === 'success' ? "bg-green-500/10 text-green-500" : "bg-red-500/10 text-red-500"
                            )}>
                              {log.status === 'success' ? <CheckCircle2 className="w-4.5 h-4.5" /> : <XCircle className="w-4.5 h-4.5" />}
                            </div>
                            <div className="min-w-0">
                              <h5 className="font-bold text-sm text-white truncate">{log.attendeeName}</h5>
                              <div className="flex items-center gap-2 text-[10px] text-zinc-400">
                                <Badge variant="outline" className="border-white/5 bg-white/5 text-[9px] px-1.5 py-0 rounded text-zinc-400 font-normal">
                                  {log.ticketType || 'Mismo Tipo'}
                                </Badge>
                                <span className="truncate">T: {log.ticketId.slice(0, 8)}...</span>
                              </div>
                            </div>
                          </div>
                          
                          <div className="text-right shrink-0 pl-2">
                            <span className="text-[10px] bg-zinc-900 px-2 py-0.5 rounded-md text-zinc-400 font-mono flex items-center gap-1">
                              <Clock className="w-3 h-3 text-primary shrink-0" />
                              {log.timestamp?.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                            </span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </Card>
              </div>

            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
