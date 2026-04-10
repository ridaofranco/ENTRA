import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useLocation, useNavigate } from 'react-router-dom';
import { Button } from '@/src/components/ui/button';
import { Card } from '@/src/components/ui/card';
import { Input } from '@/src/components/ui/input';
import { Badge } from '@/src/components/ui/badge';
import { ArrowLeft, CheckCircle2, ShieldCheck, Ticket as TicketIcon, Calendar, MapPin, Copy, Download } from 'lucide-react';
import { Link } from 'react-router-dom';
import { collection, addDoc, Timestamp, doc, getDoc, updateDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '@/src/lib/firebase';
import { cn } from '@/lib/utils';
import { useAuth } from '@/src/context/AuthContext';

interface SelectedTicket {
  type: string;
  price: number;
  quantity: number;
}

interface Event {
  id: string;
  title: string;
  date: any;
  venue: string;
  location: string;
  image: string;
  [key: string]: any;
}

interface OrderData {
  buyerId: string;
  buyerEmail: string;
  buyerName: string;
  buyerDni: string;
  eventId: string;
  eventTitle: string;
  items: SelectedTicket[];
  subtotal: number;
  fee: number;
  total: number;
  status: 'confirmed';
  paymentMethod: 'pending';
  createdAt: any;
}

interface TicketData {
  orderId: string;
  eventId: string;
  buyerId: string;
  buyerEmail: string;
  ticketType: string;
  price: number;
  status: 'valid';
  qrCode: string;
  createdAt: any;
}

interface SuccessState {
  orderId: string;
  tickets: Array<{
    id: string;
    qrCode: string;
    type: string;
  }>;
}

// Generate UUID for QR codes
function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export default function Checkout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();

  const { event, selectedTickets } = location.state || {};

  const [step, setStep] = useState(1);
  const [isProcessing, setIsProcessing] = useState(false);
  const [buyerInfo, setBuyerInfo] = useState({
    name: user?.displayName || '',
    email: user?.email || '',
    dni: '',
  });
  const [successState, setSuccessState] = useState<SuccessState | null>(null);

  // Redirect if no event data
  useEffect(() => {
    if (!event || !selectedTickets) {
      navigate('/eventos');
    }
  }, [event, selectedTickets, navigate]);

  if (!event || !selectedTickets) {
    return null;
  }

  // Calculate totals
  const subtotal = selectedTickets.reduce(
    (acc: number, ticket: SelectedTicket) => acc + ticket.price * ticket.quantity,
    0
  );
  const platformFee = Math.round(subtotal * 0.035); // 3.5% fee
  const total = subtotal + platformFee;

  const handleConfirmPurchase = async () => {
    // Validate buyer info
    if (!buyerInfo.name || !buyerInfo.email || !buyerInfo.dni) {
      alert('Por favor completa todos los campos');
      return;
    }

    setIsProcessing(true);
    try {
      const buyerId = user?.uid || `guest-${Date.now()}`;

      // Create order document
      const orderData: OrderData = {
        buyerId,
        buyerEmail: buyerInfo.email,
        buyerName: buyerInfo.name,
        buyerDni: buyerInfo.dni,
        eventId: event.id,
        eventTitle: event.title,
        items: selectedTickets,
        subtotal,
        fee: platformFee,
        total,
        status: 'confirmed',
        paymentMethod: 'pending',
        createdAt: Timestamp.now(),
      };

      const orderDocRef = await addDoc(collection(db, 'orders'), orderData);
      const orderId = orderDocRef.id;

      // Create ticket documents
      const createdTickets = [];
      for (const selectedTicket of selectedTickets) {
        for (let i = 0; i < selectedTicket.quantity; i++) {
          const qrCode = generateUUID();
          const ticketData: TicketData = {
            orderId,
            eventId: event.id,
            buyerId,
            buyerEmail: buyerInfo.email,
            ticketType: selectedTicket.type,
            price: selectedTicket.price,
            status: 'valid',
            qrCode,
            createdAt: Timestamp.now(),
          };

          const ticketDocRef = await addDoc(collection(db, 'tickets'), ticketData);
          createdTickets.push({
            id: ticketDocRef.id,
            qrCode,
            type: selectedTicket.type,
          });
        }
      }

      // ==================== DECREMENT TICKET AVAILABILITY ====================
      try {
        const eventRef = doc(db, 'events', event.id);
        const eventSnap = await getDoc(eventRef);
        if (eventSnap.exists()) {
          const eventData = eventSnap.data();
          const currentTickets = eventData.tickets || [];

          // For each purchased ticket type, subtract the quantity from available
          const updatedTickets = currentTickets.map((t: any) => {
            const purchased = selectedTickets.find((st: SelectedTicket) => st.type === t.type);
            if (purchased) {
              return {
                ...t,
                available: Math.max(0, (t.available || 0) - purchased.quantity),
              };
            }
            return t;
          });

          // Also update ticketsSold and totalRevenue
          const totalQtyPurchased = selectedTickets.reduce((sum: number, st: SelectedTicket) => sum + st.quantity, 0);
          await updateDoc(eventRef, {
            tickets: updatedTickets,
            ticketsSold: (eventData.ticketsSold || 0) + totalQtyPurchased,
            totalRevenue: (eventData.totalRevenue || 0) + subtotal,
            updatedAt: Timestamp.now(),
          });
          console.log('Ticket availability updated successfully');
        }
      } catch (stockError) {
        // Don't fail the purchase if stock update fails — order is already confirmed
        console.error('Error updating ticket availability:', stockError);
      }

      // Set success state and move to confirmation step
      setSuccessState({
        orderId,
        tickets: createdTickets,
      });
      setStep(3);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'orders/tickets');
      alert('Error al procesar la compra. Por favor intenta nuevamente.');
    } finally {
      setIsProcessing(false);
    }
  };

  const formatEventDate = (date: any) => {
    if (date?.toDate) {
      return date.toDate().toLocaleDateString('es-AR', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });
    }
    return '';
  };

  // Step 1: Buyer Information
  const step1Content = (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      className="space-y-6"
    >
      <h2 className="text-2xl font-heading font-black tracking-tighter">Tus Datos</h2>

      {!user && (
        <div className="bg-primary/10 border border-primary/20 rounded-2xl p-4">
          <p className="text-sm text-primary font-bold mb-3">
            Inicia sesión para una compra más rápida
          </p>
          <Link to="/auth/login">
            <Button className="w-full orange-gradient border-none font-bold rounded-xl h-11">
              Iniciar Sesión
            </Button>
          </Link>
        </div>
      )}

      <div className="space-y-4">
        <div className="space-y-2">
          <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
            Nombre Completo
          </label>
          <Input
            value={buyerInfo.name}
            onChange={(e) => setBuyerInfo({ ...buyerInfo, name: e.target.value })}
            placeholder="Como figura en tu documento"
            className="bg-white/5 border-white/10 h-12 rounded-2xl"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
              Email
            </label>
            <Input
              type="email"
              value={buyerInfo.email}
              onChange={(e) => setBuyerInfo({ ...buyerInfo, email: e.target.value })}
              placeholder="tu@email.com"
              className="bg-white/5 border-white/10 h-12 rounded-2xl"
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
              DNI
            </label>
            <Input
              value={buyerInfo.dni}
              onChange={(e) => setBuyerInfo({ ...buyerInfo, dni: e.target.value })}
              placeholder="Sin puntos ni espacios"
              className="bg-white/5 border-white/10 h-12 rounded-2xl"
            />
          </div>
        </div>
      </div>

      <Button
        disabled={!buyerInfo.name || !buyerInfo.email || !buyerInfo.dni}
        onClick={() => setStep(2)}
        className="w-full h-14 orange-gradient border-none font-bold text-lg rounded-2xl"
      >
        Siguiente: Revisar y Confirmar
      </Button>
    </motion.div>
  );

  // Step 2: Review and Confirm
  const step2Content = (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      className="space-y-6"
    >
      <h2 className="text-2xl font-heading font-black tracking-tighter">Revisar Compra</h2>

      <div className="space-y-4">
        <div className="bg-white/5 rounded-2xl p-4 border border-white/10">
          <h3 className="text-sm font-bold uppercase tracking-widest text-muted-foreground mb-4">
            Datos del Comprador
          </h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Nombre:</span>
              <span className="font-bold">{buyerInfo.name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Email:</span>
              <span className="font-bold">{buyerInfo.email}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">DNI:</span>
              <span className="font-bold">{buyerInfo.dni}</span>
            </div>
          </div>
          <Button
            variant="ghost"
            onClick={() => setStep(1)}
            className="w-full mt-4 text-xs font-bold"
          >
            Editar
          </Button>
        </div>

        <div className="bg-white/5 rounded-2xl p-4 border border-white/10">
          <h3 className="text-sm font-bold uppercase tracking-widest text-muted-foreground mb-4">
            Entradas
          </h3>
          <div className="space-y-2">
            {selectedTickets.map((ticket: SelectedTicket, index: number) => (
              <div key={index} className="flex justify-between text-sm">
                <span className="text-muted-foreground">
                  {ticket.quantity}x {ticket.type}
                </span>
                <span className="font-bold">
                  ${(ticket.quantity * ticket.price).toLocaleString('es-AR')}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="flex gap-4">
        <Button
          variant="ghost"
          onClick={() => setStep(1)}
          className="h-12 px-6 font-bold"
        >
          Volver
        </Button>
        <Button
          disabled={isProcessing}
          onClick={handleConfirmPurchase}
          className="flex-grow h-12 orange-gradient border-none font-bold rounded-2xl"
        >
          {isProcessing ? 'Procesando...' : 'Confirmar Compra'}
        </Button>
      </div>
    </motion.div>
  );

  // Step 3: Success
  const step3Content = successState && (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className="space-y-8"
    >
      <div className="text-center space-y-6">
        <div className="w-20 h-20 bg-green-500/20 text-green-500 rounded-full flex items-center justify-center mx-auto">
          <CheckCircle2 className="w-12 h-12" />
        </div>
        <div className="space-y-2">
          <h2 className="text-4xl font-heading font-black tracking-tighter">
            ¡Compra Exitosa!
          </h2>
          <p className="text-lg text-muted-foreground">
            Orden #{successState.orderId.substring(0, 8).toUpperCase()}
          </p>
        </div>
      </div>

      <div className="space-y-3">
        {successState.tickets.map((ticket, index) => (
          <Card
            key={index}
            className="glass p-4 rounded-2xl border-white/10 flex items-center justify-between"
          >
            <div className="flex items-center gap-3">
              <TicketIcon className="w-5 h-5 text-primary" />
              <div>
                <p className="text-sm font-bold">{ticket.type}</p>
                <p className="text-xs text-muted-foreground">{ticket.qrCode}</p>
              </div>
            </div>
            <button
              onClick={() => {
                navigator.clipboard.writeText(ticket.qrCode);
              }}
              className="hover:bg-white/10 p-2 rounded-lg transition-colors"
              title="Copiar código QR"
            >
              <Copy className="w-4 h-4" />
            </button>
          </Card>
        ))}
      </div>

      <div className="bg-primary/10 border border-primary/20 rounded-2xl p-4">
        <p className="text-sm text-primary font-bold mb-2">
          Confirmación enviada a {buyerInfo.email}
        </p>
        <p className="text-xs text-primary/80">
          Tus códigos QR y detalles de entrada han sido enviados. Preséntalos en la entrada del evento.
        </p>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <Button className="orange-gradient border-none font-bold h-12 rounded-2xl flex items-center justify-center gap-2">
          <Download className="w-4 h-4" />
          Descargar (PDF)
        </Button>
        <Link to="/eventos" className="flex-grow">
          <Button
            variant="outline"
            className="w-full h-12 rounded-2xl border-white/10 font-bold"
          >
            Volver al Inicio
          </Button>
        </Link>
      </div>
    </motion.div>
  );

  return (
    <div className="pt-32 pb-20 px-6 max-w-5xl mx-auto">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-8">
          {/* Header */}
          <div className="flex items-center gap-4">
            <Link to="/eventos">
              <Button
                variant="ghost"
                size="icon"
                className="rounded-full hover:bg-primary/10 hover:text-primary h-12 w-12"
              >
                <ArrowLeft className="w-5 h-5" />
              </Button>
            </Link>
            <h1 className="text-3xl font-heading font-black tracking-tighter uppercase">
              {step === 3 ? 'Compra Completada' : 'Finalizar Compra'}
            </h1>
          </div>

          {/* Progress Indicators */}
          {step !== 3 && (
            <div className="flex items-center gap-3">
              {[1, 2].map((i) => (
                <div key={i} className="flex items-center gap-3">
                  <motion.div
                    animate={{
                      backgroundColor: step >= i ? 'rgb(249, 115, 22)' : 'rgba(255, 255, 255, 0.05)',
                      borderColor:
                        step >= i ? 'rgb(249, 115, 22)' : 'rgba(255, 255, 255, 0.1)',
                    }}
                    className={cn(
                      'w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm border transition-colors'
                    )}
                  >
                    {step > i ? (
                      <CheckCircle2 className="w-5 h-5" />
                    ) : (
                      <span>{i}</span>
                    )}
                  </motion.div>
                  {i < 2 && (
                    <motion.div
                      animate={{
                        backgroundColor:
                          step > i ? 'rgb(249, 115, 22)' : 'rgba(255, 255, 255, 0.05)',
                      }}
                      className="w-12 h-1 rounded-full"
                    />
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Content */}
          <div className="mt-8">
            {step === 1 && step1Content}
            {step === 2 && step2Content}
            {step === 3 && step3Content}
          </div>
        </div>

        {/* Summary Sidebar */}
        {step !== 3 && (
          <div className="lg:sticky lg:top-28 lg:h-fit">
            <Card className="glass p-6 rounded-[2.5rem] border-white/10 space-y-6">
              {/* Event Info */}
              <div className="space-y-3">
                <div className="relative w-full h-24 rounded-2xl overflow-hidden">
                  <img
                    src={event.image}
                    alt={event.title}
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                </div>
                <h3 className="text-sm font-heading font-bold line-clamp-2">
                  {event.title}
                </h3>
                <div className="space-y-1 text-xs text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 flex-shrink-0" />
                    <span>{formatEventDate(event.date)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 flex-shrink-0" />
                    <span>{event.venue}</span>
                  </div>
                </div>
              </div>

              <div className="border-t border-white/5" />

              {/* Tickets Summary */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                  Entradas
                </h4>
                <div className="space-y-2">
                  {selectedTickets.map((ticket: SelectedTicket, i: number) => (
                    <div key={i} className="flex justify-between text-sm">
                      <span className="text-muted-foreground">
                        {ticket.quantity}x {ticket.type}
                      </span>
                      <span className="font-bold">
                        ${(ticket.quantity * ticket.price).toLocaleString('es-AR')}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="border-t border-white/5" />

              {/* Pricing */}
              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span className="font-bold">${subtotal.toLocaleString('es-AR')}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Comisión (3.5%)</span>
                  <span className="font-bold">
                    ${platformFee.toLocaleString('es-AR')}
                  </span>
                </div>

                <div className="border-t border-white/5 pt-3 flex justify-between items-end">
                  <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                    Total
                  </span>
                  <span className="text-3xl font-heading font-black orange-text-gradient">
                    ${total.toLocaleString('es-AR')}
                  </span>
                </div>
              </div>

              {/* Security Note */}
              <div className="bg-primary/5 rounded-2xl p-4 border border-primary/10 flex gap-3">
                <ShieldCheck className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                <p className="text-[11px] text-muted-foreground leading-relaxed uppercase tracking-wider font-bold">
                  Tu compra está protegida por ENTRA. Tus datos personales no son compartidos.
                </p>
              </div>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}

