import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  Copy,
  Check,
  CheckCircle2,
  MessageCircle,
  Mail,
  Send,
  Loader2,
  AlertCircle,
  User,
  Phone,
  Ticket as TicketIcon,
  ChevronRight,
  ArrowLeft,
  Calendar,
  MapPin,
} from 'lucide-react';
import { doc, updateDoc, addDoc, collection, Timestamp } from 'firebase/firestore';
import { db } from '@/src/lib/firebase';

interface TransferTicketModalProps {
  ticket: any;
  event: any;
  currentUser: any;
  onClose: () => void;
  onTransferCreated?: () => void;
}

type Step = 'form' | 'confirm' | 'success';

const generateToken = () => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let t = '';
  for (let i = 0; i < 20; i++) t += chars[Math.floor(Math.random() * chars.length)];
  return t;
};

const isValidEmail = (email: string) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

const cleanPhone = (phone: string) => phone.replace(/[^\d]/g, '');

export const TransferTicketModal = ({
  ticket,
  event,
  currentUser,
  onClose,
  onTransferCreated,
}: TransferTicketModalProps) => {
  const [step, setStep] = useState<Step>('form');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [transferLink, setTransferLink] = useState<string>('');
  const [copied, setCopied] = useState(false);

  // Datos del destinatario
  const [recipientName, setRecipientName] = useState('');
  const [recipientEmail, setRecipientEmail] = useState('');
  const [recipientPhone, setRecipientPhone] = useState('+54 ');
  const [recipientNote, setRecipientNote] = useState('');

  const eventTitle = ticket.eventTitle || event?.title || 'Evento';
  const ticketType = ticket.ticketType || 'General';
  const senderName =
    currentUser?.displayName || currentUser?.email?.split('@')[0] || 'Un amigo';

  const formatDate = (date: any) => {
    if (!date) return '';
    const d = date?.toDate ? date.toDate() : new Date(date);
    return d.toLocaleDateString('es-AR', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  const formatFullDate = (date: any) => {
    if (!date) return '';
    const d = date?.toDate ? date.toDate() : new Date(date);
    return d.toLocaleDateString('es-AR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  };

  // =================== STEP 1 → STEP 2 ===================
  const handleContinueToConfirm = () => {
    setError(null);

    if (recipientName.trim().length < 2) {
      setError('Ingresá el nombre del destinatario');
      return;
    }
    if (!isValidEmail(recipientEmail)) {
      setError('El email no es válido');
      return;
    }
    const phoneDigits = cleanPhone(recipientPhone);
    if (phoneDigits.length < 10) {
      setError('El teléfono tiene que tener al menos 10 dígitos con código de país');
      return;
    }
    if (recipientEmail.trim().toLowerCase() === (currentUser?.email || '').toLowerCase()) {
      setError('No podés transferirte el ticket a vos mismo');
      return;
    }

    setStep('confirm');
  };

  // =================== CREATE TRANSFER ===================
  const handleConfirmTransfer = async () => {
    setLoading(true);
    setError(null);
    try {
      const eventDate = event?.date?.toDate ? event.date.toDate() : new Date(event?.date);
      if (eventDate && eventDate.getTime() < Date.now()) {
        setError('Este evento ya pasó, no se puede transferir el ticket.');
        setLoading(false);
        return;
      }
      if (event?.allowTransfer === false) {
        setError('El organizador deshabilitó las transferencias para este evento.');
        setLoading(false);
        return;
      }

      const token = generateToken();

      await addDoc(collection(db, 'ticket_transfers'), {
        token,
        ticketId: ticket.id,
        eventId: ticket.eventId,
        eventTitle,
        eventDate: event?.date || null,
        ticketType,
        fromUserId: currentUser?.uid || null,
        fromUserEmail: currentUser?.email || null,
        fromUserName: senderName,
        toUserId: null,
        toUserEmail: recipientEmail.trim().toLowerCase(),
        toUserName: recipientName.trim(),
        toUserPhone: cleanPhone(recipientPhone),
        toUserNote: recipientNote.trim() || null,
        status: 'pending',
        createdAt: Timestamp.now(),
        claimedAt: null,
      });

      await updateDoc(doc(db, 'tickets', ticket.id), {
        transferStatus: 'pending',
        transferToken: token,
      });

      const link = `${window.location.origin}/claim/${token}`;
      setTransferLink(link);
      setStep('success');
      if (onTransferCreated) onTransferCreated();
    } catch (err: any) {
      console.error('Error creando transferencia:', err);
      setError('No se pudo crear la transferencia. Intentá de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  // =================== SHARE ===================
  const shareMessage = `Hola ${recipientName}! Te transferí un ticket de "${eventTitle}" (${ticketType}) por ENTRÁ.${recipientNote ? `\n\n${recipientNote}` : ''}\n\nAbrí este link para reclamarlo (tiene que ser desde la cuenta con el email ${recipientEmail}):\n\n${transferLink}\n\nEste link es personal y solo lo podés reclamar vos.`;

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(transferLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const input = document.createElement('input');
      input.value = transferLink;
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      document.body.removeChild(input);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleShareWhatsApp = () => {
    const phone = cleanPhone(recipientPhone);
    const encoded = encodeURIComponent(shareMessage);
    window.open(`https://wa.me/${phone}?text=${encoded}`, '_blank');
  };

  const handleShareEmail = () => {
    const subject = encodeURIComponent(`Tu ticket para ${eventTitle}`);
    const body = encodeURIComponent(shareMessage);
    window.location.href = `mailto:${recipientEmail}?subject=${subject}&body=${body}`;
  };

  // =================== RENDER ===================
  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="bg-zinc-900 rounded-3xl border border-white/10 max-w-3xl w-full relative overflow-hidden max-h-[90vh] overflow-y-auto"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header con stepper */}
          <div className="sticky top-0 z-10 bg-zinc-900/95 backdrop-blur border-b border-white/10 px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div
                className={`w-10 h-10 rounded-2xl flex items-center justify-center ${
                  step === 'success'
                    ? 'bg-green-500/10 border border-green-500/30'
                    : 'bg-orange-500/10 border border-orange-500/30'
                }`}
              >
                {step === 'success' ? (
                  <Check className="w-5 h-5 text-green-500" />
                ) : (
                  <Send className="w-5 h-5 text-orange-500" />
                )}
              </div>
              <div>
                <h2 className="text-lg font-bold">
                  {step === 'form' && 'Transferir ticket'}
                  {step === 'confirm' && 'Confirmar transferencia'}
                  {step === 'success' && '¡Transferencia lista!'}
                </h2>
                <p className="text-[11px] text-zinc-400">
                  {step === 'form' && 'Paso 1 de 3 — Datos del destinatario'}
                  {step === 'confirm' && 'Paso 2 de 3 — Revisá y confirmá'}
                  {step === 'success' && 'Paso 3 de 3 — Compartí el link'}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/10 rounded-xl transition-colors"
            >
              <X className="w-5 h-5 text-zinc-400" />
            </button>
          </div>

          {/* =================== STEP 1 — FORM =================== */}
          {step === 'form' && (
            <div className="p-6 grid md:grid-cols-2 gap-6">
              {/* Ticket preview (izquierda) */}
              <div>
                <p className="text-[11px] uppercase tracking-widest text-zinc-400 font-bold mb-2">
                  Ticket a transferir
                </p>
                <div className="rounded-2xl bg-white/5 border border-white/10 overflow-hidden">
                  {event?.image && (
                    <div className="h-32 bg-white/5 overflow-hidden">
                      <img
                        src={event.image}
                        alt=""
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                    </div>
                  )}
                  <div className="p-4 space-y-2">
                    <div className="flex items-center gap-2">
                      <TicketIcon className="w-4 h-4 text-orange-500 flex-shrink-0" />
                      <h3 className="font-bold text-sm truncate">{eventTitle}</h3>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-zinc-400">Tipo</span>
                      <span className="font-bold text-orange-500">{ticketType}</span>
                    </div>
                    {event?.date && (
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-zinc-400">Fecha</span>
                        <span className="font-bold">{formatDate(event.date)}</span>
                      </div>
                    )}
                    {event?.venue && (
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-zinc-400">Lugar</span>
                        <span className="font-bold truncate ml-2">{event.venue}</span>
                      </div>
                    )}
                  </div>
                </div>
                <div className="mt-3 p-3 rounded-xl bg-yellow-500/5 border border-yellow-500/30 flex gap-2">
                  <AlertCircle className="w-4 h-4 text-yellow-500 flex-shrink-0 mt-0.5" />
                  <p className="text-[11px] text-zinc-400">
                    Al transferir, el QR actual se invalida y se genera uno nuevo para el destinatario.
                  </p>
                </div>
              </div>

              {/* Form destinatario (derecha) */}
              <div className="space-y-4">
                <p className="text-[11px] uppercase tracking-widest text-zinc-400 font-bold">
                  Datos del destinatario
                </p>

                <div>
                  <label className="text-xs font-bold text-zinc-300 block mb-1.5 flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-zinc-500" />
                    Nombre completo
                  </label>
                  <input
                    type="text"
                    value={recipientName}
                    onChange={(e) => setRecipientName(e.target.value)}
                    placeholder="Ej: María Pérez"
                    className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-sm focus:outline-none focus:border-orange-500/50 transition-colors"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-zinc-300 block mb-1.5 flex items-center gap-1.5">
                    <Mail className="w-3.5 h-3.5 text-zinc-500" />
                    Email
                  </label>
                  <input
                    type="email"
                    value={recipientEmail}
                    onChange={(e) => setRecipientEmail(e.target.value)}
                    placeholder="maria@ejemplo.com"
                    className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-sm focus:outline-none focus:border-orange-500/50 transition-colors"
                  />
                  <p className="text-[10px] text-zinc-500 mt-1">
                    Solo esta persona va a poder reclamar el ticket
                  </p>
                </div>

                <div>
                  <label className="text-xs font-bold text-zinc-300 block mb-1.5 flex items-center gap-1.5">
                    <Phone className="w-3.5 h-3.5 text-zinc-500" />
                    Teléfono (con código de país)
                  </label>
                  <input
                    type="tel"
                    value={recipientPhone}
                    onChange={(e) => setRecipientPhone(e.target.value)}
                    placeholder="+54 9 11 1234-5678"
                    className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-sm focus:outline-none focus:border-orange-500/50 transition-colors"
                  />
                  <p className="text-[10px] text-zinc-500 mt-1">
                    Para compartir por WhatsApp con 1 click
                  </p>
                </div>

                <div>
                  <label className="text-xs font-bold text-zinc-300 block mb-1.5">
                    Nota (opcional)
                  </label>
                  <textarea
                    value={recipientNote}
                    onChange={(e) => setRecipientNote(e.target.value)}
                    placeholder="Ej: Disfrutá el show, nos vemos en la puerta"
                    rows={2}
                    className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-sm focus:outline-none focus:border-orange-500/50 transition-colors resize-none"
                  />
                </div>

                {error && (
                  <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30">
                    <p className="text-xs text-red-400">{error}</p>
                  </div>
                )}

                <div className="flex gap-3 pt-2">
                  <button
                    onClick={onClose}
                    className="flex-1 px-4 py-3 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 text-sm font-bold transition"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleContinueToConfirm}
                    className="flex-1 px-4 py-3 rounded-2xl bg-orange-500 hover:bg-orange-600 text-sm font-bold transition flex items-center justify-center gap-2"
                  >
                    Continuar <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* =================== STEP 2 — CONFIRM =================== */}
          {step === 'confirm' && (
            <div className="p-6">
              <div className="p-5 rounded-2xl bg-white/5 border border-white/10 mb-4">
                <p className="text-[11px] uppercase tracking-widest text-zinc-400 font-bold mb-3">
                  Resumen
                </p>
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-4">
                    <span className="text-xs text-zinc-400">Ticket</span>
                    <div className="text-right">
                      <p className="font-bold text-sm">{eventTitle}</p>
                      <p className="text-xs text-orange-500 font-bold">{ticketType}</p>
                    </div>
                  </div>
                  <div className="h-px bg-white/10" />
                  <div className="flex items-start justify-between gap-4">
                    <span className="text-xs text-zinc-400">Destinatario</span>
                    <div className="text-right">
                      <p className="font-bold text-sm">{recipientName}</p>
                      <p className="text-xs text-zinc-400">{recipientEmail}</p>
                      <p className="text-xs text-zinc-400">{recipientPhone}</p>
                    </div>
                  </div>
                  {recipientNote && (
                    <>
                      <div className="h-px bg-white/10" />
                      <div>
                        <span className="text-xs text-zinc-400 block mb-1">Nota</span>
                        <p className="text-xs italic text-zinc-300">"{recipientNote}"</p>
                      </div>
                    </>
                  )}
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-red-500/5 border border-red-500/30 mb-4 flex gap-3">
                <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                <div className="text-xs text-zinc-300 space-y-1">
                  <p className="font-bold text-red-400">Esta acción no se puede deshacer fácilmente.</p>
                  <p>
                    El ticket va a quedar bloqueado para <strong>{recipientEmail}</strong>. Solo esa persona, iniciando sesión con ese email, va a poder reclamarlo.
                  </p>
                </div>
              </div>

              {error && (
                <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 mb-4">
                  <p className="text-xs text-red-400">{error}</p>
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={() => setStep('form')}
                  disabled={loading}
                  className="flex-1 px-4 py-3 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 text-sm font-bold transition flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  <ArrowLeft className="w-4 h-4" /> Volver
                </button>
                <button
                  onClick={handleConfirmTransfer}
                  disabled={loading}
                  className="flex-1 px-4 py-3 rounded-2xl bg-orange-500 hover:bg-orange-600 text-sm font-bold transition flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" /> Transfiriendo...
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" /> Sí, transferir
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* =================== STEP 3 — SUCCESS (estilo compra exitosa) =================== */}
          {step === 'success' && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="p-6 space-y-6"
            >
              {/* Header de éxito — estilo idéntico a "Compra Exitosa" */}
              <div className="text-center space-y-3">
                <div className="w-20 h-20 bg-green-500/20 text-green-500 rounded-full flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-12 h-12" />
                </div>
                <div className="space-y-1">
                  <h2 className="text-3xl font-black tracking-tighter">
                    ¡Transferencia Exitosa!
                  </h2>
                  <p className="text-sm text-zinc-400">
                    El ticket ahora está a nombre de <strong className="text-zinc-200">{recipientName}</strong>
                  </p>
                </div>
              </div>

              {/* Card del evento — estilo ticket con header naranja */}
              <div className="rounded-3xl border border-white/10 overflow-hidden bg-white/5">
                {/* Header naranja con título del evento */}
                <div className="bg-gradient-to-r from-orange-500 to-orange-600 p-5 flex items-center justify-between">
                  <div className="text-white min-w-0 flex-1">
                    <p className="text-[10px] font-bold uppercase tracking-widest opacity-80">
                      Ticket transferido
                    </p>
                    <p className="text-lg font-black leading-tight truncate">
                      {eventTitle}
                    </p>
                    <p className="text-xs font-bold uppercase tracking-wider opacity-90 mt-1">
                      {ticketType}
                    </p>
                  </div>
                  <TicketIcon className="w-10 h-10 text-white opacity-90 flex-shrink-0" />
                </div>

                {/* Info del evento + destinatario (sin QR ni código) */}
                <div className="p-5 space-y-3">
                  {event?.date && (
                    <div className="flex items-center gap-2 text-sm">
                      <Calendar className="w-4 h-4 text-orange-500 flex-shrink-0" />
                      <span className="font-bold capitalize">{formatFullDate(event.date)}</span>
                    </div>
                  )}
                  {event?.venue && (
                    <div className="flex items-center gap-2 text-sm">
                      <MapPin className="w-4 h-4 text-orange-500 flex-shrink-0" />
                      <span className="font-bold">
                        {event.venue}{event?.location ? `, ${event.location}` : ''}
                      </span>
                    </div>
                  )}
                  <div className="pt-3 border-t border-white/10">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">
                      Transferido a
                    </p>
                    <p className="text-sm font-bold mt-1">{recipientName}</p>
                    <p className="text-xs text-zinc-400">{recipientEmail}</p>
                    <p className="text-xs text-zinc-400">{recipientPhone}</p>
                  </div>
                </div>
              </div>

              {/* Link + compartir */}
              <div className="space-y-3">
                <p className="text-[11px] uppercase tracking-widest text-zinc-400 font-bold">
                  Compartí el link con el destinatario
                </p>

                <div className="p-3 rounded-2xl bg-white/5 border border-white/10 flex items-center gap-2">
                  <code className="text-xs text-zinc-300 font-mono flex-1 truncate">
                    {transferLink}
                  </code>
                  <button
                    onClick={handleCopyLink}
                    className="p-2 hover:bg-white/10 rounded-lg transition-colors flex-shrink-0"
                    title="Copiar link"
                  >
                    {copied ? (
                      <Check className="w-4 h-4 text-green-500" />
                    ) : (
                      <Copy className="w-4 h-4 text-zinc-400" />
                    )}
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={handleShareWhatsApp}
                    className="flex flex-col items-center gap-2 p-4 rounded-2xl bg-green-500/10 hover:bg-green-500/20 border border-green-500/30 transition-colors"
                  >
                    <MessageCircle className="w-6 h-6 text-green-500" />
                    <div className="text-center">
                      <p className="text-xs font-bold">WhatsApp</p>
                      <p className="text-[10px] text-zinc-400 truncate max-w-[120px]">{recipientPhone}</p>
                    </div>
                  </button>
                  <button
                    onClick={handleShareEmail}
                    className="flex flex-col items-center gap-2 p-4 rounded-2xl bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/30 transition-colors"
                  >
                    <Mail className="w-6 h-6 text-blue-500" />
                    <div className="text-center">
                      <p className="text-xs font-bold">Email</p>
                      <p className="text-[10px] text-zinc-400 truncate max-w-[120px]">{recipientEmail}</p>
                    </div>
                  </button>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-yellow-500/5 border border-yellow-500/30">
                <p className="text-xs text-zinc-300">
                  <strong className="text-yellow-500">Recordá:</strong> solo{' '}
                  <strong>{recipientEmail}</strong> puede reclamar el ticket. Si el link se filtra, nadie más lo puede usar.
                </p>
              </div>

              <button
                onClick={onClose}
                className="w-full px-4 py-3 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 text-sm font-bold transition"
              >
                Listo
              </button>
            </motion.div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default TransferTicketModal;
