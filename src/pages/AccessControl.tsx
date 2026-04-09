import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card } from '@/src/components/ui/card';
import { Button } from '@/src/components/ui/button';
import { Badge } from '@/src/components/ui/badge';
import { Input } from '@/src/components/ui/input';
import { QrCode, Users, CheckCircle2, XCircle, Search, Scan, BarChart, Ticket } from 'lucide-react';
import { collection, query, orderBy, limit, onSnapshot, addDoc, Timestamp, doc, updateDoc, where, getDocs } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '@/src/lib/firebase';
import { cn } from '@/lib/utils';

interface CheckIn {
  id: string;
  ticketId: string;
  attendeeName: string;
  timestamp: any;
  status: 'success' | 'error';
}

export default function AccessControl() {
  const [scanResult, setScanResult] = useState<'success' | 'error' | null>(null);
  const [checkIns, setCheckIns] = useState<CheckIn[]>([]);
  const [stats, setStats] = useState({
    ingresados: 0,
    capacidad: 1000,
    restantes: 1000
  });
  const [ticketId, setTicketId] = useState('');
  const [isScanning, setIsScanning] = useState(false);

  useEffect(() => {
    // Real-time listener for check-ins
    const checkinsCol = collection(db, 'checkins');
    const q = query(checkinsCol, orderBy('timestamp', 'desc'), limit(10));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const logs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as CheckIn));
      setCheckIns(logs);
      setStats(prev => ({
        ...prev,
        ingresados: snapshot.size,
        restantes: prev.capacidad - snapshot.size
      }));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'checkins');
    });

    return () => unsubscribe();
  }, []);

  const handleManualCheckIn = async () => {
    if (!ticketId) return;
    setIsScanning(true);
    try {
      // 1. Find the ticket
      const ticketsCol = collection(db, 'tickets');
      const q = query(ticketsCol, where('qrCode', '==', ticketId), limit(1));
      const snapshot = await getDocs(q);
      
      if (snapshot.empty) {
        setScanResult('error');
        return;
      }

      const ticketDoc = snapshot.docs[0];
      const ticketData = ticketDoc.data();

      if (ticketData.status === 'used') {
        setScanResult('error');
        return;
      }

      // 2. Mark ticket as used
      await updateDoc(doc(db, 'tickets', ticketDoc.id), { status: 'used' });

      // 3. Add check-in log
      await addDoc(collection(db, 'checkins'), {
        ticketId: ticketDoc.id,
        attendeeName: ticketData.buyerName,
        timestamp: Timestamp.now(),
        status: 'success',
        eventId: ticketData.eventId
      });

      setScanResult('success');
      setTicketId('');
    } catch (error) {
      setScanResult('error');
      handleFirestoreError(error, OperationType.WRITE, 'checkins');
    } finally {
      setIsScanning(false);
      setTimeout(() => setScanResult(null), 3000);
    }
  };

  return (
    <div className="pt-32 pb-20 px-6 max-w-7xl mx-auto">
      <div className="flex flex-col lg:flex-row gap-12">
        {/* Left: Scanner */}
        <div className="lg:w-1/2 space-y-8">
          <div>
            <h1 className="text-4xl font-heading font-black tracking-tighter uppercase mb-2">Control de Acceso</h1>
            <p className="text-muted-foreground">Escaneá el código QR del ticket para validar el ingreso.</p>
          </div>

          <Card className="glass p-12 rounded-[3rem] border-white/5 relative overflow-hidden flex flex-col items-center justify-center min-h-[400px]">
            <AnimatePresence mode="wait">
              {scanResult === null ? (
                <motion.div 
                  key="idle"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="relative"
                >
                  <div className="w-64 h-64 border-2 border-dashed border-primary/30 rounded-3xl flex items-center justify-center">
                    <QrCode className="w-32 h-32 text-primary/20" />
                  </div>
                  <motion.div 
                    animate={{ y: [0, 256, 0] }}
                    transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                    className="absolute top-0 left-0 w-full h-1 bg-primary shadow-[0_0_15px_rgba(255,92,0,0.8)]"
                  />
                </motion.div>
              ) : scanResult === 'success' ? (
                <motion.div 
                  key="success"
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="text-center"
                >
                  <div className="w-32 h-32 bg-green-500/20 text-green-500 rounded-full flex items-center justify-center mx-auto mb-6">
                    <CheckCircle2 className="w-16 h-16" />
                  </div>
                  <h3 className="text-3xl font-heading font-black text-green-500 uppercase">Acceso Permitido</h3>
                  <p className="text-muted-foreground mt-2">Ticket validado correctamente</p>
                </motion.div>
              ) : (
                <motion.div 
                  key="error"
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="text-center"
                >
                  <div className="w-32 h-32 bg-red-500/20 text-red-500 rounded-full flex items-center justify-center mx-auto mb-6">
                    <XCircle className="w-16 h-16" />
                  </div>
                  <h3 className="text-3xl font-heading font-black text-red-500 uppercase">Acceso Denegado</h3>
                  <p className="text-muted-foreground mt-2">Ticket inválido o ya utilizado</p>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="mt-12 w-full max-w-sm space-y-4">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <Input 
                  placeholder="Ingresar ID manualmente..." 
                  className="pl-12 h-14 bg-white/5 border-white/10 rounded-2xl"
                  value={ticketId}
                  onChange={(e) => setTicketId(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleManualCheckIn()}
                />
              </div>
              <Button 
                onClick={handleManualCheckIn}
                disabled={isScanning || !ticketId}
                className="w-full h-14 orange-gradient border-none font-bold text-lg rounded-2xl"
              >
                {isScanning ? "Validando..." : "Validar Ticket"}
              </Button>
            </div>
          </Card>
        </div>

        {/* Right: Stats & History */}
        <div className="lg:w-1/2 space-y-8">
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: 'Ingresados', value: stats.ingresados, icon: Users, color: 'text-primary' },
              { label: 'Capacidad', value: stats.capacidad, icon: BarChart, color: 'text-muted-foreground' },
              { label: 'Restantes', value: stats.restantes, icon: Ticket, color: 'text-green-500' },
            ].map((s, i) => (
              <Card key={i} className="glass p-6 rounded-3xl border-white/5 text-center">
                <s.icon className={cn("w-6 h-6 mx-auto mb-2", s.color)} />
                <div className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground mb-1">{s.label}</div>
                <div className="text-2xl font-heading font-black">{s.value}</div>
              </Card>
            ))}
          </div>

          <Card className="glass p-8 rounded-[3rem] border-white/5 flex-grow">
            <h3 className="text-xl font-heading font-bold mb-6 flex items-center gap-2">
              <Scan className="w-5 h-5 text-primary" />
              Últimos Ingresos
            </h3>
            <div className="space-y-4">
              {checkIns.length === 0 ? (
                <p className="text-center text-muted-foreground py-10">No hay ingresos registrados aún.</p>
              ) : (
                checkIns.map((log) => (
                  <div key={log.id} className="flex items-center justify-between p-4 rounded-2xl bg-white/5 border border-white/5">
                    <div className="flex items-center gap-4">
                      <div className={cn(
                        "w-10 h-10 rounded-full flex items-center justify-center",
                        log.status === 'success' ? "bg-green-500/10 text-green-500" : "bg-red-500/10 text-red-500"
                      )}>
                        {log.status === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <XCircle className="w-5 h-5" />}
                      </div>
                      <div>
                        <div className="font-bold text-sm">{log.attendeeName}</div>
                        <div className="text-[10px] text-muted-foreground uppercase font-bold">Ticket: {log.ticketId.substring(0, 8)}...</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs font-bold">{log.timestamp?.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
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
