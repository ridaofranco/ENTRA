import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useLocation, useNavigate } from 'react-router-dom';
import { Button } from '@/src/components/ui/button';
import { Card } from '@/src/components/ui/card';
import { Input } from '@/src/components/ui/input';
import { ArrowLeft, CheckCircle2, ShieldCheck, Ticket as TicketIcon, Calendar, MapPin, Copy, Download, Tag, Percent, Trash, X, Loader2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { collection, addDoc, Timestamp, doc, getDoc, updateDoc, query, where, getDocs, increment } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '@/src/lib/firebase';
import { cn } from '@/lib/utils';
import { useAuth } from '@/src/context/AuthContext';

interface SelectedTicket {
  type: string;
  price: number;
  quantity: number;
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

// QR image URL from a value (uses api.qrserver.com — no dependency needed)
function qrImageUrl(value: string, size = 220): string {
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&margin=8&data=${encodeURIComponent(value)}`;
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

  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // --- Discount Code State ---
  const [discountCodeInput, setDiscountCodeInput] = useState('');
  const [appliedDiscount, setAppliedDiscount] = useState<{
    id: string;
    code: string;
    type: 'percentage' | 'fixed';
    value: number;
    amount: number;
  } | null>(null);
  const [discountError, setDiscountError] = useState<string | null>(null);
  const [isValidatingDiscount, setIsValidatingDiscount] = useState(false);

  // Toast auto-hide
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  if (!event || !selectedTickets) {
    return null;
  }

  // Calculate totals
  const subtotalOriginal = (selectedTickets || []).reduce(
    (acc: number, ticket: SelectedTicket) => acc + (Number(ticket.price) || 0) * (Number(ticket.quantity) || 0),
    0
  );

  const discountAmount = appliedDiscount?.amount || 0;
  const subtotal = Math.max(0, subtotalOriginal - discountAmount);

  // Usar la comisión snapshoteada en el evento. Fallback a 3.5% para eventos viejos.
  const eventCommission = Number(event.commissionRate) || 3.5;
  const platformFee = Math.round(subtotal * (eventCommission / 100));
  const total = subtotal + platformFee;

  const handleApplyDiscount = async () => {
    if (!discountCodeInput.trim()) return;
    
    setIsValidatingDiscount(true);
    setDiscountError(null);

    try {
      const code = discountCodeInput.trim().toUpperCase();
      const q = query(
        collection(db, 'discount_codes'),
        where('eventId', '==', event.id),
        where('code', '==', code),
        where('active', '==', true)
      );

      const querySnapshot = await getDocs(q);
      
      if (querySnapshot.empty) {
        setDiscountError('Código inválido o no disponible');
        return;
      }

      const discountDoc = querySnapshot.docs[0];
      const discountData = discountDoc.data();

      // Validar expiración
      if (discountData.validUntil && discountData.validUntil.toDate() < new Date()) {
        setDiscountError('Este código ha expirado');
        return;
      }

      // Validar usos
      if (discountData.maxUses && discountData.usedCount >= discountData.maxUses) {
        setDiscountError('Este código ya alcanzó su límite de usos');
        return;
      }

      // Calcular monto de descuento
      let amount = 0;
      if (discountData.type === 'percentage') {
        amount = Math.round(subtotalOriginal * (discountData.value / 100));
      } else {
        amount = discountData.value;
      }

      // No permitir que el descuento supere el subtotal
      amount = Math.min(amount, subtotalOriginal);

      setAppliedDiscount({
        id: discountDoc.id,
        code: discountData.code,
        type: discountData.type,
        value: discountData.value,
        amount
      });
      setDiscountCodeInput('');
      setToast({ message: '¡Código aplicado con éxito!', type: 'success' });
    } catch (error) {
      console.error('Error validating discount:', error);
      setDiscountError('Error al validar el código');
    } finally {
      setIsValidatingDiscount(false);
    }
  };

  const handleRemoveDiscount = () => {
    setAppliedDiscount(null);
    setDiscountError(null);
  };

  const handleConfirmPurchase = async () => {
    if (!buyerInfo.name || !buyerInfo.email || !buyerInfo.dni) {
      setToast({ message: 'Por favor completa todos los campos', type: 'error' });
      return;
    }

    setIsProcessing(true);
    try {
      const buyerId = user?.uid || `guest-${Date.now()}`;

      // Create order document
      const orderData: any = {
        buyerId,
        buyerEmail: buyerInfo.email,
        buyerName: buyerInfo.name,
        buyerDni: buyerInfo.dni,
        eventId: event.id,
        eventTitle: event.title,
        items: selectedTickets,
        subtotalBeforeDiscount: subtotalOriginal,
        discountCodeId: appliedDiscount?.id || null,
        discountCode: appliedDiscount?.code || null,
        discountAmount: discountAmount,
        subtotal,
        fee: platformFee,
        total,
        status: 'confirmed',
        paymentMethod: 'pending',
        createdAt: Timestamp.now(),
      };

      const orderDocRef = await addDoc(collection(db, 'orders'), orderData);
      const orderId = orderDocRef.id;

      // Incrementar contador de uso del código de descuento
      if (appliedDiscount) {
        try {
          const discountRef = doc(db, 'discount_codes', appliedDiscount.id);
          await updateDoc(discountRef, {
            usedCount: increment(1),
            updatedAt: Timestamp.now()
          });
        } catch (discountUpdateError) {
          console.error('Error updating discount usage count:', discountUpdateError);
          // No bloqueamos la compra si falla el incremento, pero lo logueamos
        }
      }

      // Create ticket documents
      const createdTickets: Array<{ id: string; qrCode: string; type: string }> = [];
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

          const totalQtyPurchased = selectedTickets.reduce(
            (sum: number, st: SelectedTicket) => sum + st.quantity,
            0
          );
          await updateDoc(eventRef, {
            tickets: updatedTickets,
            ticketsSold: (eventData.ticketsSold || 0) + totalQtyPurchased,
            totalRevenue: (eventData.totalRevenue || 0) + subtotal,
            updatedAt: Timestamp.now(),
          });
          console.log('Ticket availability updated successfully');
        }
      } catch (stockError) {
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
      setToast({ message: 'Error al procesar la compra. Por favor intenta nuevamente.', type: 'error' });
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

  // Generate downloadable HTML tickets (opens new tab + auto-print)
  // Much nicer than a plain PNG: styled cards with header, QR, buyer info, footer
  const handleDownloadTickets = () => {
    if (!successState) return;

    const eventDateStr = formatEventDate(event.date);
    const orderShort = successState.orderId.substring(0, 8).toUpperCase();

    const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<title>Entradas ENTRA - ${event.title}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, system-ui, sans-serif;
    background: #f5f5f5;
    padding: 20px;
    color: #1a1a1a;
  }
  .ticket {
    background: white;
    border-radius: 20px;
    margin: 24px auto;
    max-width: 640px;
    overflow: hidden;
    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.12);
    page-break-inside: avoid;
  }
  .ticket-header {
    background: linear-gradient(135deg, #FF5C00 0%, #FF8C00 100%);
    color: white;
    padding: 28px 32px;
    position: relative;
  }
  .ticket-header .brand {
    font-size: 11px;
    letter-spacing: 4px;
    text-transform: uppercase;
    opacity: 0.85;
    font-weight: 700;
  }
  .ticket-header h1 {
    font-size: 28px;
    font-weight: 900;
    margin-top: 8px;
    line-height: 1.1;
    letter-spacing: -0.5px;
  }
  .ticket-header .ticket-type {
    display: inline-block;
    margin-top: 12px;
    padding: 6px 14px;
    background: rgba(255, 255, 255, 0.22);
    backdrop-filter: blur(10px);
    border-radius: 100px;
    font-size: 11px;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 2px;
  }
  .ticket-body {
    padding: 32px;
    display: flex;
    gap: 32px;
    align-items: center;
  }
  .qr-section {
    text-align: center;
    flex-shrink: 0;
  }
  .qr-section .qr-wrap {
    background: white;
    border: 3px solid #FF5C00;
    border-radius: 16px;
    padding: 10px;
    display: inline-block;
  }
  .qr-section img {
    width: 160px;
    height: 160px;
    display: block;
  }
  .qr-section .code {
    font-family: 'Courier New', monospace;
    font-size: 10px;
    margin-top: 10px;
    color: #666;
    background: #f0f0f0;
    padding: 6px 10px;
    border-radius: 6px;
    word-break: break-all;
    max-width: 180px;
  }
  .info-section { flex-grow: 1; min-width: 0; }
  .info-row { margin-bottom: 14px; }
  .info-row:last-child { margin-bottom: 0; }
  .info-label {
    font-size: 9px;
    text-transform: uppercase;
    letter-spacing: 2px;
    color: #999;
    font-weight: 700;
    margin-bottom: 4px;
  }
  .info-value {
    font-size: 15px;
    font-weight: 700;
    color: #1a1a1a;
  }
  .info-value.small { font-size: 13px; }
  .ticket-footer {
    border-top: 2px dashed #e5e5e5;
    padding: 18px 32px;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .status {
    color: #22c55e;
    font-weight: 800;
    font-size: 12px;
    text-transform: uppercase;
    letter-spacing: 2px;
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }
  .status::before {
    content: '';
    display: inline-block;
    width: 8px;
    height: 8px;
    background: #22c55e;
    border-radius: 50%;
  }
  .brand-footer {
    color: #FF5C00;
    font-weight: 900;
    font-size: 14px;
    letter-spacing: 1px;
  }
  .order-badge {
    font-family: 'Courier New', monospace;
    font-size: 11px;
    color: #999;
    background: #f5f5f5;
    padding: 4px 10px;
    border-radius: 6px;
  }
  @media print {
    body { padding: 0; background: white; }
    .ticket {
      box-shadow: none;
      border: 1px solid #ddd;
      margin: 12px auto;
    }
  }
  @media (max-width: 600px) {
    .ticket-body { flex-direction: column; text-align: center; }
    .info-section { text-align: center; }
  }
</style>
</head>
<body>
${successState.tickets.map((ticket, i) => `
<div class="ticket">
  <div class="ticket-header">
    <div class="brand">ENTRA by DER</div>
    <h1>${event.title}</h1>
    <div class="ticket-type">${ticket.type}</div>
  </div>
  <div class="ticket-body">
    <div class="qr-section">
      <div class="qr-wrap">
        <img src="${qrImageUrl(ticket.qrCode, 320)}" alt="QR Code" />
      </div>
      <div class="code">${ticket.qrCode}</div>
    </div>
    <div class="info-section">
      <div class="info-row">
        <div class="info-label">Titular</div>
        <div class="info-value">${buyerInfo.name}</div>
      </div>
      <div class="info-row">
        <div class="info-label">DNI</div>
        <div class="info-value small">${buyerInfo.dni}</div>
      </div>
      <div class="info-row">
        <div class="info-label">Fecha</div>
        <div class="info-value small">${eventDateStr}</div>
      </div>
      <div class="info-row">
        <div class="info-label">Lugar</div>
        <div class="info-value small">${event.venue || ''}${event.location ? ', ' + event.location : ''}</div>
      </div>
    </div>
  </div>
  <div class="ticket-footer">
    <span class="status">VÁLIDO</span>
    <span class="order-badge">Orden #${orderShort} · ${i + 1}/${successState.tickets.length}</span>
    <span class="brand-footer">ENTRA</span>
  </div>
</div>
`).join('')}
<script>
  // Auto-print after images load
  window.addEventListener('load', function() {
    setTimeout(function() { window.print(); }, 500);
  });
</script>
</body>
</html>`;

    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
    // Revoke after a delay so the new tab has time to load
    setTimeout(() => URL.revokeObjectURL(url), 10000);
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
                  ${(Number(ticket.quantity || 0) * Number(ticket.price || 0)).toLocaleString('es-AR')}
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

  // Step 3: Success — muestra el QR visual, no solo el texto del UUID
  const step3Content = successState && (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="space-y-8"
    >
      {/* Header de éxito */}
      <div className="text-center space-y-4">
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
          <p className="text-sm text-muted-foreground">
            {successState.tickets.length} {successState.tickets.length === 1 ? 'entrada generada' : 'entradas generadas'}
          </p>
        </div>
      </div>

      {/* Botón prominente de descarga de todas las entradas */}
      <Button
        onClick={handleDownloadTickets}
        className="w-full h-14 orange-gradient border-none font-bold text-base rounded-2xl flex items-center justify-center gap-3"
      >
        <Download className="w-5 h-5" />
        Descargar {successState.tickets.length === 1 ? 'mi entrada' : `mis ${successState.tickets.length} entradas`} (PDF imprimible)
      </Button>

      {/* Tickets con QR visual grande */}
      <div className="space-y-6">
        {successState.tickets.map((ticket, index) => (
          <Card
            key={ticket.id}
            className="glass rounded-3xl border-white/10 overflow-hidden"
          >
            {/* Header del ticket */}
            <div className="orange-gradient p-5 flex items-center justify-between">
              <div className="text-white">
                <p className="text-[10px] font-bold uppercase tracking-widest opacity-80">
                  Entrada #{index + 1} de {successState.tickets.length}
                </p>
                <p className="text-lg font-heading font-black leading-tight">
                  {event.title}
                </p>
                <p className="text-xs font-bold uppercase tracking-wider opacity-90 mt-1">
                  {ticket.type}
                </p>
              </div>
              <TicketIcon className="w-10 h-10 text-white opacity-90" />
            </div>

            {/* Info + QR */}
            <div className="p-6 flex flex-col md:flex-row gap-6 items-center">
              <div className="flex-grow space-y-3 w-full md:w-auto">
                <div className="flex items-center gap-2 text-sm">
                  <Calendar className="w-4 h-4 text-primary flex-shrink-0" />
                  <span className="font-bold">{formatEventDate(event.date)}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <MapPin className="w-4 h-4 text-primary flex-shrink-0" />
                  <span className="font-bold">
                    {event.venue}{event.location ? `, ${event.location}` : ''}
                  </span>
                </div>
                <div className="pt-3 border-t border-white/10">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                    Titular
                  </p>
                  <p className="text-sm font-bold">{buyerInfo.name}</p>
                  <p className="text-xs text-muted-foreground">DNI {buyerInfo.dni}</p>
                </div>
                <div className="flex gap-2 pt-2">
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(ticket.qrCode);
                    }}
                    className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground hover:text-primary transition-colors px-3 py-1.5 rounded-lg bg-white/5 border border-white/10"
                  >
                    <Copy className="w-3 h-3" />
                    Copiar código
                  </button>
                  <button
                    onClick={handleDownloadTickets}
                    className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground hover:text-primary transition-colors px-3 py-1.5 rounded-lg bg-white/5 border border-white/10"
                  >
                    <Download className="w-3 h-3" />
                    Descargar PDF
                  </button>
                </div>
              </div>

              {/* QR Code visual */}
              <div className="flex-shrink-0">
                <div className="bg-white p-3 rounded-2xl">
                  <img
                    src={qrImageUrl(ticket.qrCode, 220)}
                    alt={`QR ticket ${ticket.type}`}
                    width={220}
                    height={220}
                    className="block"
                  />
                </div>
                <p className="text-[9px] font-mono text-center text-muted-foreground mt-2 break-all max-w-[220px]">
                  {ticket.qrCode}
                </p>
              </div>
            </div>
          </Card>
        ))}
      </div>

      <div className="bg-primary/10 border border-primary/20 rounded-2xl p-4">
        <p className="text-sm text-primary font-bold mb-2">
          Confirmación enviada a {buyerInfo.email}
        </p>
        <p className="text-xs text-primary/80">
          Guardá o descargá tus entradas. Presentá el QR en la puerta del evento.
        </p>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <Link to="/perfil" className="flex-grow">
          <Button className="w-full orange-gradient border-none font-bold h-12 rounded-2xl">
            Ver Mis Entradas
          </Button>
        </Link>
        <Link to="/eventos" className="flex-grow">
          <Button
            variant="outline"
            className="w-full h-12 rounded-2xl border-white/10 font-bold"
          >
            Seguir Explorando
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
              <div className="space-y-3">
                <div className="relative w-full h-24 rounded-2xl overflow-hidden">
                  <img
                    src={event.image || undefined}
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
                        ${((Number(ticket.quantity) || 0) * (Number(ticket.price) || 0)).toLocaleString('es-AR')}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="border-t border-white/5" />

              {/* Pricing */}
              <div className="space-y-4">
                {/* Discount Code Input */}
                {!appliedDiscount ? (
                  <div className="space-y-2">
                    <div className="flex gap-2">
                      <div className="relative flex-grow">
                        <Tag className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                          value={discountCodeInput}
                          onChange={(e) => setDiscountCodeInput(e.target.value.toUpperCase())}
                          placeholder="CÓDIGO"
                          className="pl-9 bg-white/5 border-white/10 h-10 rounded-xl text-xs font-bold"
                          onKeyDown={(e) => e.key === 'Enter' && handleApplyDiscount()}
                        />
                      </div>
                      <Button 
                        onClick={handleApplyDiscount}
                        disabled={!discountCodeInput.trim() || isValidatingDiscount}
                        className="h-10 px-4 orange-gradient border-none font-bold text-xs rounded-xl"
                      >
                        {isValidatingDiscount ? <Loader2 className="w-4 h-4 animate-spin" /> : 'APLICAR'}
                      </Button>
                    </div>
                    {discountError && (
                      <p className="text-[10px] font-bold text-red-500 ml-1 uppercase tracking-wider">
                        {discountError}
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="bg-green-500/10 border border-green-500/20 rounded-2xl p-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center text-green-500">
                        <Percent className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-widest text-green-500">
                          Descuento aplicado
                        </p>
                        <p className="text-sm font-black text-white">
                          {appliedDiscount.code}
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={handleRemoveDiscount}
                      className="h-8 w-8 rounded-full hover:bg-red-500/20 hover:text-red-500"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                )}

                <div className="space-y-3 pt-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Subtotal</span>
                    <div className="text-right">
                      {appliedDiscount && (
                        <p className="text-xs text-muted-foreground line-through opacity-50">
                          ${subtotalOriginal.toLocaleString('es-AR')}
                        </p>
                      )}
                      <p className="font-bold">${subtotal.toLocaleString('es-AR')}</p>
                    </div>
                  </div>

                  {appliedDiscount && (
                    <div className="flex justify-between text-sm text-green-500">
                      <span className="flex items-center gap-1">
                        <Tag className="w-3 h-3" />
                        Descuento ({appliedDiscount.type === 'percentage' ? `${appliedDiscount.value}%` : 'Fijo'})
                      </span>
                      <span className="font-bold">-${discountAmount.toLocaleString('es-AR')}</span>
                    </div>
                  )}

                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Comisión ({eventCommission}%)</span>
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

      {/* Toast Notification */}
      {toast && (
        <motion.div
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 50 }}
          className={`fixed bottom-8 right-8 px-6 py-4 rounded-2xl shadow-2xl z-50 flex items-center gap-3 ${
            toast.type === 'success' ? 'bg-green-600' : 'bg-red-600'
          } text-white font-bold`}
        >
          {toast.message}
        </motion.div>
      )}
    </div>
  );
}
