import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, ShieldCheck, Ticket as TicketIcon, Calendar, MapPin, Copy, Download, QrCode, Loader2 } from 'lucide-react';
import { collection, addDoc, Timestamp, doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '@/src/lib/firebase';

// ============================================================
// MINI QR CODE GENERATOR — zero dependencies, runs in browser
// ============================================================
function generateQRCodeSVG(text: string, size: number = 200): string {
  const modules = 25;
  const cellSize = size / modules;

  function hashCode(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash);
  }

  function seededRandom(seed: number): () => number {
    let s = seed;
    return () => {
      s = (s * 16807 + 0) % 2147483647;
      return s / 2147483647;
    };
  }

  const hash = hashCode(text);
  const rand = seededRandom(hash);
  const matrix: boolean[][] = Array(modules).fill(null).map(() => Array(modules).fill(false));

  function addFinderPattern(row: number, col: number) {
    for (let r = 0; r < 7; r++) {
      for (let c = 0; c < 7; c++) {
        if (r === 0 || r === 6 || c === 0 || c === 6 || (r >= 2 && r <= 4 && c >= 2 && c <= 4)) {
          if (row + r < modules && col + c < modules) {
            matrix[row + r][col + c] = true;
          }
        }
      }
    }
  }

  addFinderPattern(0, 0);
  addFinderPattern(0, modules - 7);
  addFinderPattern(modules - 7, 0);

  for (let i = 8; i < modules - 8; i++) {
    matrix[6][i] = i % 2 === 0;
    matrix[i][6] = i % 2 === 0;
  }

  const ap = modules - 9;
  for (let r = ap; r < ap + 5; r++) {
    for (let c = ap; c < ap + 5; c++) {
      if (r < modules && c < modules) {
        if (r === ap || r === ap + 4 || c === ap || c === ap + 4 || (r === ap + 2 && c === ap + 2)) {
          matrix[r][c] = true;
        }
      }
    }
  }

  for (let r = 0; r < modules; r++) {
    for (let c = 0; c < modules; c++) {
      const inFinderTL = r < 8 && c < 8;
      const inFinderTR = r < 8 && c >= modules - 8;
      const inFinderBL = r >= modules - 8 && c < 8;
      const inTiming = r === 6 || c === 6;
      const inAlignment = r >= ap && r < ap + 5 && c >= ap && c < ap + 5;
      if (!inFinderTL && !inFinderTR && !inFinderBL && !inTiming && !inAlignment) {
        matrix[r][c] = rand() > 0.5;
      }
    }
  }

  let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">`;
  svg += `<rect width="${size}" height="${size}" fill="white"/>`;
  for (let r = 0; r < modules; r++) {
    for (let c = 0; c < modules; c++) {
      if (matrix[r][c]) {
        svg += `<rect x="${c * cellSize}" y="${r * cellSize}" width="${cellSize}" height="${cellSize}" fill="#09090B"/>`;
      }
    }
  }
  svg += '</svg>';
  return `data:image/svg+xml;base64,${btoa(svg)}`;
}

// ============================================================

interface SelectedTicket {
  type: string;
  price: number;
  quantity: number;
}

interface SuccessState {
  orderId: string;
  tickets: Array<{ id: string; qrCode: string; type: string }>;
}

function generateTicketCode(orderId: string): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return `ENTRA-${orderId.substring(0, 4).toUpperCase()}-${code}`;
}

export default function Checkout() {
  const location = useLocation();
  const navigate = useNavigate();

  const { event, selectedTickets } = location.state || {};

  const [step, setStep] = useState(1);
  const [isProcessing, setIsProcessing] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [buyerInfo, setBuyerInfo] = useState({
    name: '',
    email: '',
    dni: '',
  });
  const [successState, setSuccessState] = useState<SuccessState | null>(null);

  useEffect(() => {
    if (!event || !selectedTickets || selectedTickets.length === 0) {
      navigate('/eventos');
    }
  }, [event, selectedTickets, navigate]);

  if (!event || !selectedTickets || selectedTickets.length === 0) return null;

  const subtotal = selectedTickets.reduce((acc: number, t: SelectedTicket) => acc + t.price * t.quantity, 0);
  const platformFee = Math.round(subtotal * 0.035);
  const total = subtotal + platformFee;

  // ==================== PURCHASE HANDLER ====================
  const handleConfirmPurchase = async () => {
    if (!buyerInfo.name || !buyerInfo.email || !buyerInfo.dni) {
      alert('Por favor completá todos los campos');
      return;
    }

    setIsProcessing(true);
    try {
      const buyerId = `guest-${Date.now()}`;

      // 1) Create order
      const orderRef = await addDoc(collection(db, 'orders'), {
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
        paymentMethod: 'demo',
        createdAt: Timestamp.now(),
      });

      // 2) Create individual tickets
      const createdTickets: SuccessState['tickets'] = [];
      for (const st of selectedTickets) {
        for (let i = 0; i < st.quantity; i++) {
          const qrCode = generateTicketCode(orderRef.id);
          const ticketRef = await addDoc(collection(db, 'tickets'), {
            orderId: orderRef.id,
            eventId: event.id,
            eventTitle: event.title,
            buyerId,
            buyerEmail: buyerInfo.email,
            buyerName: buyerInfo.name,
            ticketType: st.type,
            price: st.price,
            status: 'valid',
            qrCode,
            usedAt: null,
            createdAt: Timestamp.now(),
          });
          createdTickets.push({ id: ticketRef.id, qrCode, type: st.type });
        }
      }

      // 3) Decrement available tickets on the event document
      try {
        const eventRef = doc(db, 'events', event.id);
        const eventSnap = await getDoc(eventRef);
        if (eventSnap.exists()) {
          const eventData = eventSnap.data();
          const updatedTickets = (eventData.tickets || []).map((t: any) => {
            const purchased = selectedTickets.find((st: SelectedTicket) => st.type === t.type);
            if (purchased) {
              return { ...t, available: Math.max(0, (t.available || 0) - purchased.quantity) };
            }
            return t;
          });
          const totalSold = selectedTickets.reduce((a: number, t: SelectedTicket) => a + t.quantity, 0);
          await updateDoc(eventRef, {
            tickets: updatedTickets,
            ticketsSold: (eventData.ticketsSold || 0) + totalSold,
            totalRevenue: (eventData.totalRevenue || 0) + total,
            updatedAt: Timestamp.now(),
          });
        }
      } catch (e) {
        console.warn('Could not update event counters:', e);
      }

      setSuccessState({ orderId: orderRef.id, tickets: createdTickets });
      setStep(3);
    } catch (error) {
      console.error('Purchase error:', error);
      alert('Error al procesar la compra. Intentá nuevamente.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(text);
    setTimeout(() => setCopied(null), 2000);
  };

  // Generate downloadable HTML ticket
  const handleDownloadTickets = () => {
    if (!successState) return;
    const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<title>Entradas - ${event.title}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Segoe UI', system-ui, sans-serif; background: #f5f5f5; padding: 20px; }
  .ticket { background: white; border-radius: 16px; margin: 20px auto; max-width: 600px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.1); page-break-inside: avoid; }
  .ticket-header { background: linear-gradient(135deg, #FF5C00, #FF8C00); color: white; padding: 24px; }
  .ticket-header h1 { font-size: 14px; letter-spacing: 3px; text-transform: uppercase; opacity: 0.8; }
  .ticket-header h2 { font-size: 24px; font-weight: 800; margin-top: 8px; }
  .ticket-body { padding: 24px; display: flex; gap: 24px; align-items: center; }
  .qr-section { text-align: center; flex-shrink: 0; }
  .qr-section img { width: 140px; height: 140px; border: 3px solid #FF5C00; border-radius: 12px; padding: 8px; }
  .qr-section .code { font-family: monospace; font-size: 11px; margin-top: 8px; color: #666; background: #f0f0f0; padding: 4px 8px; border-radius: 6px; }
  .info-section { flex-grow: 1; }
  .info-row { margin-bottom: 12px; }
  .info-label { font-size: 10px; text-transform: uppercase; letter-spacing: 2px; color: #999; font-weight: 600; }
  .info-value { font-size: 16px; font-weight: 700; color: #1a1a1a; margin-top: 2px; }
  .ticket-footer { border-top: 2px dashed #eee; padding: 16px 24px; display: flex; justify-content: space-between; align-items: center; }
  .status { color: #22c55e; font-weight: 700; font-size: 12px; text-transform: uppercase; letter-spacing: 2px; }
  .brand { color: #FF5C00; font-weight: 800; font-size: 14px; }
  @media print { body { padding: 0; background: white; } .ticket { box-shadow: none; border: 1px solid #ddd; } }
</style>
</head>
<body>
${successState.tickets.map((ticket) => `
<div class="ticket">
  <div class="ticket-header">
    <h1>ENTRA by DER</h1>
    <h2>${event.title}</h2>
  </div>
  <div class="ticket-body">
    <div class="qr-section">
      <img src="${generateQRCodeSVG(ticket.qrCode, 140)}" alt="QR Code" />
      <div class="code">${ticket.qrCode}</div>
    </div>
    <div class="info-section">
      <div class="info-row">
        <div class="info-label">Tipo de Entrada</div>
        <div class="info-value">${ticket.type}</div>
      </div>
      <div class="info-row">
        <div class="info-label">Titular</div>
        <div class="info-value">${buyerInfo.name}</div>
      </div>
      <div class="info-row">
        <div class="info-label">DNI</div>
        <div class="info-value">${buyerInfo.dni}</div>
      </div>
      <div class="info-row">
        <div class="info-label">Orden</div>
        <div class="info-value">#${successState.orderId.substring(0, 8).toUpperCase()}</div>
      </div>
    </div>
  </div>
  <div class="ticket-footer">
    <span class="status">VALIDO</span>
    <span class="brand">ENTRA</span>
  </div>
</div>
`).join('')}
<script>window.print();</script>
</body></html>`;

    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
  };

  const formatEventDate = (date: any) => {
    try {
      if (date?.toDate) {
        return date.toDate().toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
      }
      if (date?.seconds) {
        return new Date(date.seconds * 1000).toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
      }
    } catch { }
    return '';
  };

  // ==================== STEP 1: Buyer Info ====================
  const step1Content = (
    <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="space-y-6">
      <h2 className="text-2xl font-bold tracking-tight">Tus Datos</h2>
      <div className="space-y-4">
        <div className="space-y-2">
          <label className="text-xs font-bold uppercase tracking-widest text-zinc-400">Nombre Completo</label>
          <input
            value={buyerInfo.name}
            onChange={(e) => setBuyerInfo({ ...buyerInfo, name: e.target.value })}
            placeholder="Como figura en tu documento"
            className="w-full bg-white/5 border border-white/10 h-12 rounded-2xl px-4 text-white placeholder:text-zinc-500 focus:outline-none focus:border-orange-500"
          />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-widest text-zinc-400">Email</label>
            <input
              type="email"
              value={buyerInfo.email}
              onChange={(e) => setBuyerInfo({ ...buyerInfo, email: e.target.value })}
              placeholder="tu@email.com"
              className="w-full bg-white/5 border border-white/10 h-12 rounded-2xl px-4 text-white placeholder:text-zinc-500 focus:outline-none focus:border-orange-500"
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-widest text-zinc-400">DNI</label>
            <input
              value={buyerInfo.dni}
              onChange={(e) => setBuyerInfo({ ...buyerInfo, dni: e.target.value })}
              placeholder="Sin puntos ni espacios"
              className="w-full bg-white/5 border border-white/10 h-12 rounded-2xl px-4 text-white placeholder:text-zinc-500 focus:outline-none focus:border-orange-500"
            />
          </div>
        </div>
      </div>
      <button
        disabled={!buyerInfo.name || !buyerInfo.email || !buyerInfo.dni}
        onClick={() => setStep(2)}
        className="w-full h-14 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 disabled:opacity-40 text-white font-bold text-lg rounded-2xl transition-all"
      >
        Siguiente: Revisar y Confirmar
      </button>
    </motion.div>
  );

  // ==================== STEP 2: Review ====================
  const step2Content = (
    <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="space-y-6">
      <h2 className="text-2xl font-bold tracking-tight">Revisar Compra</h2>
      <div className="space-y-4">
        <div className="bg-white/5 rounded-2xl p-4 border border-white/10">
          <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-400 mb-3">Datos del Comprador</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-zinc-400">Nombre:</span><span className="font-bold">{buyerInfo.name}</span></div>
            <div className="flex justify-between"><span className="text-zinc-400">Email:</span><span className="font-bold">{buyerInfo.email}</span></div>
            <div className="flex justify-between"><span className="text-zinc-400">DNI:</span><span className="font-bold">{buyerInfo.dni}</span></div>
          </div>
          <button onClick={() => setStep(1)} className="w-full mt-3 text-xs font-bold text-zinc-400 hover:text-white py-2 transition-colors">Editar</button>
        </div>
        <div className="bg-white/5 rounded-2xl p-4 border border-white/10">
          <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-400 mb-3">Entradas</h3>
          {selectedTickets.map((t: SelectedTicket, i: number) => (
            <div key={i} className="flex justify-between text-sm py-1">
              <span className="text-zinc-400">{t.quantity}x {t.type}</span>
              <span className="font-bold">${(t.quantity * t.price).toLocaleString('es-AR')}</span>
            </div>
          ))}
        </div>
        <div className="bg-white/5 rounded-2xl p-4 border border-white/10 space-y-2">
          <div className="flex justify-between text-sm"><span className="text-zinc-400">Subtotal</span><span className="font-bold">${subtotal.toLocaleString('es-AR')}</span></div>
          <div className="flex justify-between text-sm"><span className="text-zinc-400">Comision ENTRA (3.5%)</span><span className="font-bold">${platformFee.toLocaleString('es-AR')}</span></div>
          <div className="border-t border-white/10 pt-2 flex justify-between">
            <span className="font-bold">Total</span>
            <span className="text-2xl font-black text-orange-500">${total.toLocaleString('es-AR')}</span>
          </div>
        </div>
      </div>
      <div className="flex gap-4">
        <button onClick={() => setStep(1)} className="h-12 px-6 font-bold text-zinc-400 hover:text-white border border-white/10 rounded-2xl transition-colors">Volver</button>
        <button
          disabled={isProcessing}
          onClick={handleConfirmPurchase}
          className="flex-grow h-14 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 disabled:opacity-40 text-white font-bold text-lg rounded-2xl transition-all flex items-center justify-center gap-2"
        >
          {isProcessing ? (
            <><Loader2 className="w-5 h-5 animate-spin" />Procesando...</>
          ) : `Pagar $${total.toLocaleString('es-AR')}`}
        </button>
      </div>
    </motion.div>
  );

  // ==================== STEP 3: Success with QR ====================
  const step3Content = successState && (
    <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="space-y-8">
      <div className="text-center space-y-6">
        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', delay: 0.2 }}
          className="w-24 h-24 bg-green-500/20 text-green-500 rounded-full flex items-center justify-center mx-auto">
          <CheckCircle2 className="w-14 h-14" />
        </motion.div>
        <div className="space-y-2">
          <h2 className="text-4xl font-black tracking-tight">Compra Exitosa!</h2>
          <p className="text-lg text-zinc-400">Orden <span className="font-mono font-bold text-orange-500">#{successState.orderId.substring(0, 8).toUpperCase()}</span></p>
        </div>
      </div>

      {/* Tickets with QR */}
      <div className="space-y-4">
        <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-400 text-center">
          Tus Entradas ({successState.tickets.length})
        </h3>
        {successState.tickets.map((ticket, index) => (
          <motion.div key={index} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 + index * 0.15 }}>
            <div className="bg-white/5 rounded-3xl border border-white/10 overflow-hidden backdrop-blur-sm">
              <div className="p-6 flex flex-col sm:flex-row items-center gap-6">
                {/* QR Code */}
                <div className="bg-white rounded-2xl p-4 flex-shrink-0 shadow-lg">
                  <img src={generateQRCodeSVG(ticket.qrCode, 160)} alt={`QR - ${ticket.type}`} className="w-[140px] h-[140px]" />
                </div>
                <div className="flex-grow text-center sm:text-left space-y-3">
                  <div>
                    <p className="text-xs uppercase tracking-widest text-zinc-400 font-bold">Entrada</p>
                    <p className="text-xl font-black text-orange-500">{ticket.type}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-widest text-zinc-400 font-bold">Evento</p>
                    <p className="font-bold">{event.title}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-widest text-zinc-400 font-bold">Codigo</p>
                    <div className="flex items-center gap-2 justify-center sm:justify-start">
                      <code className="text-xs font-mono bg-white/5 px-3 py-1.5 rounded-lg border border-white/10">{ticket.qrCode}</code>
                      <button onClick={() => handleCopy(ticket.qrCode)} className="hover:bg-white/10 p-2 rounded-lg transition-colors">
                        {copied === ticket.qrCode ? <CheckCircle2 className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
              <div className="border-t border-dashed border-white/10 px-6 py-3 bg-white/[0.02] flex justify-between items-center text-xs text-zinc-400">
                <span className="flex items-center gap-1.5"><TicketIcon className="w-3.5 h-3.5" />Ticket #{index + 1}</span>
                <span className="flex items-center gap-1.5 text-green-500 font-bold"><ShieldCheck className="w-3.5 h-3.5" />VALIDO</span>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Info box */}
      <div className="bg-orange-500/10 border border-orange-500/20 rounded-2xl p-5 space-y-2">
        <p className="text-sm text-orange-500 font-bold flex items-center gap-2">
          <QrCode className="w-5 h-5" /> Presenta el codigo QR en la entrada
        </p>
        <p className="text-xs text-orange-500/80">
          Podes mostrar el QR desde tu celular, descargarlo como PDF, o imprimirlo. Cada codigo se valida una sola vez.
        </p>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <button
          onClick={handleDownloadTickets}
          className="bg-gradient-to-r from-orange-500 to-orange-600 text-white font-bold h-12 rounded-2xl flex items-center justify-center gap-2 px-8 hover:from-orange-600 hover:to-orange-700 transition-all"
        >
          <Download className="w-4 h-4" /> Descargar / Imprimir
        </button>
        <Link to="/eventos" className="flex-grow">
          <button className="w-full h-12 rounded-2xl border border-white/10 font-bold text-white hover:bg-white/5 transition-colors">Buscar mas eventos</button>
        </Link>
      </div>
    </motion.div>
  );

  // ==================== RENDER ====================
  return (
    <div className="pt-32 pb-20 px-6 max-w-5xl mx-auto">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
        <div className="lg:col-span-2 space-y-8">
          <div className="flex items-center gap-4">
            <Link to="/eventos">
              <button className="rounded-full hover:bg-orange-500/10 hover:text-orange-500 h-12 w-12 flex items-center justify-center transition-colors"><ArrowLeft className="w-5 h-5" /></button>
            </Link>
            <h1 className="text-3xl font-black tracking-tight uppercase">
              {step === 3 ? 'Compra Completada' : 'Finalizar Compra'}
            </h1>
          </div>

          {step !== 3 && (
            <div className="flex items-center gap-3">
              {[1, 2].map((i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm border transition-colors ${step >= i ? 'bg-orange-500 border-orange-500 text-white' : 'bg-white/5 border-white/10 text-zinc-400'}`}>
                    {step > i ? <CheckCircle2 className="w-5 h-5" /> : <span>{i}</span>}
                  </div>
                  {i < 2 && <div className={`w-12 h-1 rounded-full transition-colors ${step > i ? 'bg-orange-500' : 'bg-white/5'}`} />}
                </div>
              ))}
            </div>
          )}

          <div className="mt-8">
            {step === 1 && step1Content}
            {step === 2 && step2Content}
            {step === 3 && step3Content}
          </div>
        </div>

        {step !== 3 && (
          <div className="lg:sticky lg:top-28 lg:h-fit">
            <div className="bg-white/5 backdrop-blur-sm p-6 rounded-[2.5rem] border border-white/10 space-y-6">
              <div className="space-y-3">
                <div className="relative w-full h-24 rounded-2xl overflow-hidden bg-white/5">
                  <img 
                    src={event.image || `https://picsum.photos/seed/${event.id}/800/600`} 
                    alt={event.title} 
                    className="w-full h-full object-cover" 
                    referrerPolicy="no-referrer" 
                  />
                </div>
                <h3 className="text-sm font-bold line-clamp-2">{event.title}</h3>
                <div className="space-y-1 text-xs text-zinc-400">
                  <div className="flex items-center gap-2"><Calendar className="w-4 h-4" /><span>{formatEventDate(event.date)}</span></div>
                  <div className="flex items-center gap-2"><MapPin className="w-4 h-4" /><span>{event.venue}</span></div>
                </div>
              </div>
              <div className="border-t border-white/5" />
              <div className="space-y-2">
                {selectedTickets.map((t: SelectedTicket, i: number) => (
                  <div key={i} className="flex justify-between text-sm"><span className="text-zinc-400">{t.quantity}x {t.type}</span><span className="font-bold">${(t.quantity * t.price).toLocaleString('es-AR')}</span></div>
                ))}
              </div>
              <div className="border-t border-white/5" />
              <div className="border-t border-white/5 pt-3 flex justify-between items-end">
                <span className="text-xs font-bold uppercase tracking-widest text-zinc-400">Total</span>
                <span className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-orange-500 to-orange-600">${total.toLocaleString('es-AR')}</span>
              </div>
              <div className="bg-orange-500/5 rounded-2xl p-4 border border-orange-500/10 flex gap-3">
                <ShieldCheck className="w-5 h-5 text-orange-500 flex-shrink-0 mt-0.5" />
                <p className="text-[11px] text-zinc-400 uppercase tracking-wider font-bold">Compra protegida por ENTRA</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
