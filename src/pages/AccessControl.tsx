import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card } from '@/src/components/ui/card';
import { Button } from '@/src/components/ui/button';
import { Input } from '@/src/components/ui/input';
import {
  QrCode, Users, CheckCircle2, XCircle, Search, Scan, BarChart, Ticket,
  Camera, CameraOff, AlertTriangle, LogOut, Loader2
} from 'lucide-react';
import {
  collection, query, orderBy, limit, onSnapshot, addDoc, Timestamp,
  doc, updateDoc, where, getDocs
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '@/src/lib/firebase';
import { cn } from '@/lib/utils';
import { Html5Qrcode } from 'html5-qrcode';

interface CheckIn {
  id: string;
  ticketId: string;
  attendeeName: string;
  ticketType?: string;
  timestamp: any;
  status: 'success' | 'error' | 'duplicate';
  message?: string;
}

interface EventOption {
  id: string;
  title: string;
  date: any;
  venue: string;
  ticketsSold: number;
}

export default function AccessControl() {
  const [scanResult, setScanResult] = useState<'success' | 'error' | 'duplicate' | null>(null);
  const [scanMessage, setScanMessage] = useState('');
  const [scanTicketInfo, setScanTicketInfo] = useState<{ name: string; type: string } | null>(null);
  const [checkIns, setCheckIns] = useState<CheckIn[]>([]);
  const [stats, setStats] = useState({ ingresados: 0, vendidos: 0, restantes: 0 });
  const [ticketId, setTicketId] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);

  // Event selection
  const [selectedEvent, setSelectedEvent] = useState<EventOption | null>(null);
  const [events, setEvents] = useState<EventOption[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(true);

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const cooldownRef = useRef(false);
  const scannerContainerId = 'qr-scanner-container';

  // ==================== LOAD EVENTS ====================
  useEffect(() => {
    const loadEvents = async () => {
      try {
        const eventsSnap = await getDocs(collection(db, 'events'));
        const eventsList: EventOption[] = [];
        eventsSnap.forEach((d) => {
          const data = d.data();
          eventsList.push({
            id: d.id,
            title: data.title,
            date: data.date,
            venue: data.venue || '',
            ticketsSold: data.ticketsSold || 0,
          });
        });
        eventsList.sort((a, b) => {
          const dateA = a.date?.seconds || 0;
          const dateB = b.date?.seconds || 0;
          return dateB - dateA;
        });
        setEvents(eventsList);
      } catch (e) {
        console.error('Error loading events:', e);
      } finally {
        setLoadingEvents(false);
      }
    };
    loadEvents();
  }, []);

  // ==================== LIVE STATS & CHECK-INS ====================
  useEffect(() => {
    if (!selectedEvent) return;

    const ticketsQuery = query(
      collection(db, 'tickets'),
      where('eventId', '==', selectedEvent.id)
    );
    const unsubTickets = onSnapshot(ticketsQuery, (snapshot) => {
      let total = 0;
      let scanned = 0;
      snapshot.forEach((d) => {
        const data = d.data();
        if (data.status !== 'cancelled') {
          total++;
          if (data.status === 'used') scanned++;
        }
      });
      setStats({ ingresados: scanned, vendidos: total, restantes: total - scanned });
    });

    const checkinsQuery = query(
      collection(db, 'checkins'),
      where('eventId', '==', selectedEvent.id),
      orderBy('timestamp', 'desc'),
      limit(20)
    );
    const unsubCheckins = onSnapshot(checkinsQuery, (snapshot) => {
      const logs = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as CheckIn));
      setCheckIns(logs);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'checkins');
    });

    return () => { unsubTickets(); unsubCheckins(); };
  }, [selectedEvent]);

  // ==================== CAMERA ====================
  const startCamera = async () => {
    try {
      setCameraError(null);
      const html5QrCode = new Html5Qrcode(scannerContainerId);
      scannerRef.current = html5QrCode;

      await html5QrCode.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 250, height: 250 }, aspectRatio: 1 },
        (decodedText) => { handleValidateTicket(decodedText); },
        () => {}
      );
      setCameraActive(true);
    } catch (err: any) {
      console.error('Camera error:', err);
      setCameraError(
        err.toString().includes('NotAllowed')
          ? 'Permiso de camara denegado. Habilitalo en la config del navegador.'
          : 'No se pudo acceder a la camara.'
      );
    }
  };

  const stopCamera = async () => {
    if (scannerRef.current) {
      try {
        await scannerRef.current.stop();
        scannerRef.current.clear();
      } catch (e) { console.warn(e); }
      scannerRef.current = null;
    }
    setCameraActive(false);
  };

  useEffect(() => { return () => { stopCamera(); }; }, []);

  // ==================== VALIDATE TICKET ====================
  const handleValidateTicket = async (code: string) => {
    if (cooldownRef.current || processing) return;
    cooldownRef.current = true;
    setProcessing(true);

    if (navigator.vibrate) navigator.vibrate(100);

    try {
      const ticketsCol = collection(db, 'tickets');
      const q = query(ticketsCol, where('qrCode', '==', code), limit(1));
      const snapshot = await getDocs(q);

      if (snapshot.empty) {
        setScanResult('error');
        setScanMessage('Ticket no encontrado');
        setScanTicketInfo(null);
        if (navigator.vibrate) navigator.vibrate([200, 100, 200]);

        await addDoc(collection(db, 'checkins'), {
          ticketId: code,
          attendeeName: 'Desconocido',
          timestamp: Timestamp.now(),
          status: 'error',
          message: 'No encontrado',
          eventId: selectedEvent?.id || ''
        });
        return;
      }

      const ticketDoc = snapshot.docs[0];
      const ticketData = ticketDoc.data();

      if (selectedEvent && ticketData.eventId !== selectedEvent.id) {
        setScanResult('error');
        setScanMessage('Ticket de otro evento');
        setScanTicketInfo({ name: ticketData.buyerName, type: ticketData.ticketType });
        if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
        return;
      }

      if (ticketData.status === 'used') {
        const usedAt = ticketData.usedAt?.toDate?.();
        setScanResult('duplicate');
        setScanMessage(usedAt ? `Ya ingreso a las ${usedAt.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}` : 'Ya utilizado');
        setScanTicketInfo({ name: ticketData.buyerName, type: ticketData.ticketType });
        if (navigator.vibrate) navigator.vibrate([200, 100, 200, 100, 200]);

        await addDoc(collection(db, 'checkins'), {
          ticketId: ticketDoc.id,
          attendeeName: ticketData.buyerName,
          ticketType: ticketData.ticketType,
          timestamp: Timestamp.now(),
          status: 'duplicate',
          message: 'Ya utilizado',
          eventId: selectedEvent?.id || ''
        });
        return;
      }

      if (ticketData.status === 'cancelled') {
        setScanResult('error');
        setScanMessage('Ticket cancelado');
        setScanTicketInfo({ name: ticketData.buyerName, type: ticketData.ticketType });
        if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
        return;
      }

      // VALID
      await updateDoc(doc(db, 'tickets', ticketDoc.id), {
        status: 'used',
        usedAt: Timestamp.now()
      });

      await addDoc(collection(db, 'checkins'), {
        ticketId: ticketDoc.id,
        attendeeName: ticketData.buyerName,
        ticketType: ticketData.ticketType,
        timestamp: Timestamp.now(),
        status: 'success',
        message: 'Ingreso OK',
        eventId: selectedEvent?.id || ''
      });

      setScanResult('success');
      setScanMessage('Acceso Permitido');
      setScanTicketInfo({ name: ticketData.buyerName, type: ticketData.ticketType });
      if (navigator.vibrate) navigator.vibrate(50);
      setTicketId('');

    } catch (error) {
      setScanResult('error');
      setScanMessage('Error de conexion');
      setScanTicketInfo(null);
      handleFirestoreError(error, OperationType.WRITE, 'checkins');
    } finally {
      setProcessing(false);
      setTimeout(() => {
        cooldownRef.current = false;
        setScanResult(null);
        setScanMessage('');
        setScanTicketInfo(null);
      }, 2500);
    }
  };

  const handleManualCheckIn = () => {
    if (!ticketId) return;
    handleValidateTicket(ticketId);
  };

  // ==================== EVENT SELECTOR ====================
  if (!selectedEvent) {
    return (
      <div className="pt-32 pb-20 px-6 max-w-3xl mx-auto">
        <div className="text-center space-y-4 mb-10">
          <div className="w-20 h-20 bg-primary/20 rounded-full flex items-center justify-center mx-auto">
            <Scan className="w-10 h-10 text-primary" />
          </div>
          <h1 className="text-4xl font-heading font-black tracking-tighter uppercase">Control de Acceso</h1>
          <p className="text-muted-foreground">Selecciona el evento para controlar el ingreso</p>
        </div>

        {loadingEvents ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : events.length === 0 ? (
          <p className="text-center text-muted-foreground py-12">No hay eventos creados</p>
        ) : (
          <div className="space-y-3">
            {events.map((ev) => (
              <Card
                key={ev.id}
                onClick={() => setSelectedEvent(ev)}
                className="glass p-6 rounded-3xl border-white/5 cursor-pointer hover:border-primary/50 transition-all group"
              >
                <h3 className="font-heading font-bold text-lg group-hover:text-primary transition-colors">{ev.title}</h3>
                <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                  {ev.venue && <span>{ev.venue}</span>}
                  <span>{ev.ticketsSold} tickets vendidos</span>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    );
  }

  // ==================== MAIN SCANNER VIEW ====================
  return (
    <div className="pt-28 pb-20 px-4 md:px-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-heading font-black tracking-tighter uppercase">{selectedEvent.title}</h1>
          <p className="text-muted-foreground text-sm">{selectedEvent.venue}</p>
        </div>
        <Button
          variant="outline"
          onClick={() => { stopCamera(); setSelectedEvent(null); setCheckIns([]); }}
          className="rounded-2xl"
        >
          <LogOut className="w-4 h-4 mr-2" /> Cambiar evento
        </Button>
      </div>

      <div className="flex flex-col lg:flex-row gap-8">
        {/* Left: Scanner */}
        <div className="lg:w-1/2 space-y-6">
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Ingresaron', value: stats.ingresados, icon: Users, color: 'text-primary' },
              { label: 'Vendidos', value: stats.vendidos, icon: Ticket, color: 'text-muted-foreground' },
              { label: 'Faltan', value: stats.restantes, icon: BarChart, color: 'text-green-500' },
            ].map((s, i) => (
              <Card key={i} className="glass p-4 rounded-2xl border-white/5 text-center">
                <s.icon className={cn("w-5 h-5 mx-auto mb-1", s.color)} />
                <div className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground">{s.label}</div>
                <div className="text-2xl font-heading font-black">{s.value}</div>
              </Card>
            ))}
          </div>

          {/* Camera */}
          <Card className="glass rounded-[2rem] border-white/5 overflow-hidden relative">
            <div id={scannerContainerId} className="w-full aspect-square bg-black/50" />

            {!cameraActive && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/90">
                {cameraError ? (
                  <div className="text-center px-6 space-y-3">
                    <CameraOff className="w-14 h-14 text-destructive mx-auto" />
                    <p className="text-sm text-destructive">{cameraError}</p>
                    <Button onClick={startCamera} variant="outline" className="rounded-2xl">Reintentar</Button>
                  </div>
                ) : (
                  <div className="text-center space-y-3">
                    <QrCode className="w-20 h-20 text-muted-foreground/30 mx-auto" />
                    <p className="text-muted-foreground text-sm">Camara apagada</p>
                  </div>
                )}
              </div>
            )}

            <AnimatePresence>
              {scanResult && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  className={cn(
                    "absolute inset-0 flex flex-col items-center justify-center backdrop-blur-sm",
                    scanResult === 'success' ? 'bg-green-500/90' :
                    scanResult === 'duplicate' ? 'bg-amber-500/90' : 'bg-red-500/90'
                  )}
                >
                  <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 300 }}>
                    {scanResult === 'success' ? <CheckCircle2 className="w-24 h-24 text-white" /> :
                     scanResult === 'duplicate' ? <AlertTriangle className="w-24 h-24 text-white" /> :
                     <XCircle className="w-24 h-24 text-white" />}
                  </motion.div>
                  <p className="text-white text-2xl font-heading font-black mt-4 uppercase">{scanMessage}</p>
                  {scanTicketInfo && (
                    <div className="mt-2 text-white/80 text-center">
                      <p className="font-bold">{scanTicketInfo.name}</p>
                      <p className="text-sm">{scanTicketInfo.type}</p>
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            {processing && !scanResult && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm">
                <Loader2 className="w-12 h-12 text-primary animate-spin" />
              </div>
            )}
          </Card>

          <Button
            onClick={cameraActive ? stopCamera : startCamera}
            className={cn(
              "w-full h-14 font-bold text-lg rounded-2xl",
              cameraActive
                ? "bg-destructive/20 text-destructive border border-destructive/30 hover:bg-destructive/30"
                : "orange-gradient border-none"
            )}
          >
            {cameraActive ? <><CameraOff className="w-5 h-5 mr-2" /> Detener Camara</> :
             <><Camera className="w-5 h-5 mr-2" /> Iniciar Escaneo</>}
          </Button>

          <div className="flex gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Codigo manual..."
                className="pl-11 h-12 bg-white/5 border-white/10 rounded-2xl"
                value={ticketId}
                onChange={(e) => setTicketId(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleManualCheckIn()}
              />
            </div>
            <Button
              onClick={handleManualCheckIn}
              disabled={processing || !ticketId}
              className="h-12 px-6 orange-gradient border-none font-bold rounded-2xl"
            >
              Validar
            </Button>
          </div>
        </div>

        {/* Right: History */}
        <div className="lg:w-1/2">
          <Card className="glass p-6 rounded-[2rem] border-white/5">
            <h3 className="text-lg font-heading font-bold mb-4 flex items-center gap-2">
              <Scan className="w-5 h-5 text-primary" />
              Ultimos Ingresos ({checkIns.length})
            </h3>
            <div className="space-y-3 max-h-[600px] overflow-y-auto">
              {checkIns.length === 0 ? (
                <p className="text-center text-muted-foreground py-10">No hay ingresos registrados aun.</p>
              ) : (
                checkIns.map((log) => (
                  <div key={log.id} className={cn(
                    "flex items-center justify-between p-4 rounded-2xl border",
                    log.status === 'success' ? "bg-green-500/5 border-green-500/20" :
                    log.status === 'duplicate' ? "bg-amber-500/5 border-amber-500/20" :
                    "bg-red-500/5 border-red-500/20"
                  )}>
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "w-10 h-10 rounded-full flex items-center justify-center",
                        log.status === 'success' ? "bg-green-500/10 text-green-500" :
                        log.status === 'duplicate' ? "bg-amber-500/10 text-amber-500" :
                        "bg-red-500/10 text-red-500"
                      )}>
                        {log.status === 'success' ? <CheckCircle2 className="w-5 h-5" /> :
                         log.status === 'duplicate' ? <AlertTriangle className="w-5 h-5" /> :
                         <XCircle className="w-5 h-5" />}
                      </div>
                      <div>
                        <div className="font-bold text-sm">{log.attendeeName}</div>
                        <div className="text-[10px] text-muted-foreground uppercase font-bold">
                          {log.ticketType || 'General'} - {log.message || log.status}
                        </div>
                      </div>
                    </div>
                    <div className="text-xs font-bold text-muted-foreground">
                      {log.timestamp?.toDate?.()?.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }) || ''}
                    </div>
                  </div>
                ))
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
