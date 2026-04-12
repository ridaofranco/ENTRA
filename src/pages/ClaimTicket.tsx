import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Ticket, Loader2, AlertCircle, Check, LogIn, Calendar, MapPin, User } from 'lucide-react';
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  getDoc,
  updateDoc,
  Timestamp,
} from 'firebase/firestore';
import { db } from '@/src/lib/firebase';
import { useAuth } from '@/src/context/AuthContext';

// Generador simple de QR code (UUID style)
const generateQrCode = () => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};

export default function ClaimTicket() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();

  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [transfer, setTransfer] = useState<any>(null);
  const [transferId, setTransferId] = useState<string | null>(null);
  const [event, setEvent] = useState<any>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const loadTransfer = async () => {
      if (!token) {
        setError('Link inválido');
        setLoading(false);
        return;
      }
      try {
        const q = query(
          collection(db, 'ticket_transfers'),
          where('token', '==', token)
        );
        const snap = await getDocs(q);

        if (snap.empty) {
          setError('Esta transferencia no existe o el link es inválido.');
          setLoading(false);
          return;
        }

        const transferDoc = snap.docs[0];
        const transferData = transferDoc.data();

        if (transferData.status === 'claimed') {
          setError('Este ticket ya fue reclamado por alguien más.');
          setLoading(false);
          return;
        }

        if (transferData.status === 'cancelled') {
          setError('La transferencia fue cancelada por el remitente.');
          setLoading(false);
          return;
        }

        // Verificar si el evento ya pasó
        const eventDate = transferData.eventDate?.toDate
          ? transferData.eventDate.toDate()
          : new Date(transferData.eventDate);
        if (eventDate && eventDate.getTime() < Date.now()) {
          setError('Este evento ya pasó. No se puede reclamar el ticket.');
          setLoading(false);
          return;
        }

        // Cargar data del evento para mostrar imagen/venue
        try {
          const eventSnap = await getDoc(doc(db, 'events', transferData.eventId));
          if (eventSnap.exists()) setEvent({ id: eventSnap.id, ...eventSnap.data() });
        } catch (e) {
          console.warn('No se pudo cargar el evento:', e);
        }

        setTransfer(transferData);
        setTransferId(transferDoc.id);
      } catch (err: any) {
        console.error('Error cargando transferencia:', err);
        setError('Error al cargar la transferencia. Intentá de nuevo.');
      } finally {
        setLoading(false);
      }
    };

    loadTransfer();
  }, [token]);

  const handleClaim = async () => {
    if (!user || !transfer || !transferId) return;
    if (user.uid === transfer.fromUserId) {
      setError('No podés reclamar tu propio ticket.');
      return;
    }
    // Validación de email: el usuario logueado tiene que ser el destinatario
    if (
      transfer.toUserEmail &&
      (user.email || '').toLowerCase().trim() !==
        String(transfer.toUserEmail).toLowerCase().trim()
    ) {
      setError(
        `Este ticket fue enviado a ${transfer.toUserEmail}. Iniciá sesión con esa cuenta para reclamarlo.`
      );
      return;
    }
    setClaiming(true);
    setError(null);
    try {
      const newQrCode = generateQrCode();

      // 1. Actualizar el ticket con el nuevo owner + QR nuevo
      await updateDoc(doc(db, 'tickets', transfer.ticketId), {
        buyerId: user.uid,
        buyerEmail: user.email || '',
        qrCode: newQrCode,
        transferStatus: null,
        transferToken: null,
        transferredAt: Timestamp.now(),
        transferredFrom: transfer.fromUserEmail || null,
      });

      // 2. Marcar la transferencia como claimed
      await updateDoc(doc(db, 'ticket_transfers', transferId), {
        status: 'claimed',
        toUserId: user.uid,
        toUserEmail: user.email || '',
        claimedAt: Timestamp.now(),
      });

      setSuccess(true);
      setTimeout(() => {
        navigate('/perfil');
      }, 2500);
    } catch (err: any) {
      console.error('Error reclamando ticket:', err);
      setError('No se pudo reclamar el ticket. Intentá de nuevo.');
    } finally {
      setClaiming(false);
    }
  };

  const formatDate = (date: any) => {
    if (!date) return '';
    const d = date?.toDate ? date.toDate() : new Date(date);
    return d.toLocaleDateString('es-AR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  };

  // ============ LOADING ============
  if (loading || authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black">
        <Loader2 className="w-8 h-8 text-orange-500 animate-spin" />
      </div>
    );
  }

  // ============ ERROR ============
  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-md w-full p-8 rounded-3xl bg-zinc-900 border border-red-500/30 text-center"
        >
          <div className="w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/30 flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-8 h-8 text-red-500" />
          </div>
          <h1 className="text-2xl font-bold mb-2">No se puede reclamar</h1>
          <p className="text-sm text-zinc-400 mb-6">{error}</p>
          <Link to="/eventos">
            <button className="px-6 py-3 rounded-2xl bg-orange-500 hover:bg-orange-600 text-sm font-bold transition">
              Volver a ENTRÁ
            </button>
          </Link>
        </motion.div>
      </div>
    );
  }

  // ============ SUCCESS ============
  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black px-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-md w-full p-8 rounded-3xl bg-zinc-900 border border-green-500/30 text-center"
        >
          <div className="w-16 h-16 rounded-2xl bg-green-500/10 border border-green-500/30 flex items-center justify-center mx-auto mb-4">
            <Check className="w-8 h-8 text-green-500" />
          </div>
          <h1 className="text-2xl font-bold mb-2">¡Ticket reclamado!</h1>
          <p className="text-sm text-zinc-400 mb-4">
            Ya es tuyo. Lo vas a ver en tu sección "Mis Tickets".
          </p>
          <p className="text-xs text-zinc-500">Redirigiendo...</p>
        </motion.div>
      </div>
    );
  }

  // ============ MAIN ============
  return (
    <div className="min-h-screen bg-black px-4 py-16">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md mx-auto"
      >
        <div className="text-center mb-6">
          <div className="w-16 h-16 rounded-2xl bg-orange-500/10 border border-orange-500/30 flex items-center justify-center mx-auto mb-3">
            <Ticket className="w-8 h-8 text-orange-500" />
          </div>
          <h1 className="text-2xl font-bold mb-1">Te transfirieron un ticket</h1>
          <p className="text-sm text-zinc-400">
            <strong className="text-orange-500">{transfer?.fromUserName || 'Alguien'}</strong> te envió un ticket por ENTRÁ
          </p>
          {transfer?.toUserName && (
            <p className="text-xs text-zinc-500 mt-2">
              Para: <strong className="text-zinc-300">{transfer.toUserName}</strong> ({transfer.toUserEmail})
            </p>
          )}
          {transfer?.toUserNote && (
            <div className="mt-3 p-3 rounded-2xl bg-orange-500/5 border border-orange-500/30 max-w-xs mx-auto">
              <p className="text-xs italic text-zinc-300">"{transfer.toUserNote}"</p>
            </div>
          )}
        </div>

        {/* Event card */}
        <div className="rounded-3xl bg-zinc-900 border border-white/10 overflow-hidden mb-6">
          {event?.image && (
            <div className="h-40 bg-white/5 overflow-hidden">
              <img src={event.image} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
            </div>
          )}
          <div className="p-5 space-y-3">
            <h2 className="font-bold text-lg">{transfer?.eventTitle}</h2>
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs text-zinc-400">
                <User className="w-3.5 h-3.5" />
                <span>Tipo: <strong className="text-orange-500">{transfer?.ticketType}</strong></span>
              </div>
              {transfer?.eventDate && (
                <div className="flex items-center gap-2 text-xs text-zinc-400">
                  <Calendar className="w-3.5 h-3.5" />
                  <span>{formatDate(transfer.eventDate)}</span>
                </div>
              )}
              {event?.venue && (
                <div className="flex items-center gap-2 text-xs text-zinc-400">
                  <MapPin className="w-3.5 h-3.5" />
                  <span>{event.venue}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Email mismatch warning */}
        {user && transfer?.toUserEmail &&
          (user.email || '').toLowerCase().trim() !== String(transfer.toUserEmail).toLowerCase().trim() && (
          <div className="mb-4 p-4 rounded-2xl bg-red-500/10 border border-red-500/30 flex gap-3">
            <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
            <div className="text-xs text-zinc-300 space-y-1">
              <p className="font-bold text-red-400">Este ticket no es para vos</p>
              <p>
                Fue enviado a <strong>{transfer.toUserEmail}</strong>. Tenés que cerrar sesión e iniciar con esa cuenta para poder reclamarlo.
              </p>
            </div>
          </div>
        )}

        {/* CTA */}
        {!user ? (
          <Link to={`/auth/login?redirect=/claim/${token}`}>
            <button className="w-full px-6 py-4 rounded-2xl bg-orange-500 hover:bg-orange-600 text-sm font-bold transition flex items-center justify-center gap-2">
              <LogIn className="w-4 h-4" />
              {transfer?.toUserEmail
                ? `Iniciá sesión con ${transfer.toUserEmail}`
                : 'Iniciá sesión o registrate para reclamar'}
            </button>
          </Link>
        ) : (
          <button
            onClick={handleClaim}
            disabled={claiming}
            className="w-full px-6 py-4 rounded-2xl bg-orange-500 hover:bg-orange-600 text-sm font-bold transition flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {claiming ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" /> Reclamando...
              </>
            ) : (
              <>
                <Check className="w-4 h-4" /> Reclamar ticket gratis
              </>
            )}
          </button>
        )}

        <p className="text-xs text-zinc-500 text-center mt-4">
          Al reclamar, el ticket pasa a estar a tu nombre y el QR original del remitente queda invalidado.
        </p>
      </motion.div>
    </div>
  );
}
