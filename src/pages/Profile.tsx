import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import {
  User, Ticket, LogOut, Calendar, MapPin, QrCode, Download,
  ChevronRight, Copy, CheckCircle2, ShieldCheck, Loader2, Clock,
  Settings, Save, Eye, EyeOff, AlertTriangle, Mail, Lock, Phone, CreditCard, Pencil, Send
} from 'lucide-react';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '@/src/lib/firebase';
import { useAuth } from '@/src/context/AuthContext';
import { TransferTicketModal } from '@/src/components/TransferTicketModal';
import { formatCurrency } from '@/src/lib/utils';
import { estadoOrden } from '@/src/lib/estados';

// ============================================================
// QR CODE GENERATOR (same as Checkout)
// ============================================================
function generateQRCodeSVG(text: string, size: number = 200): string {
  // QR REAL y escaneable, vía api.qrserver.com — igual que el checkout y el email.
  // Antes esta función dibujaba un patrón ALEATORIO (rand() > 0.5): parecía un QR
  // pero no codificaba nada, así que en la puerta no se podía escanear el ticket
  // desde el perfil. Ahora el QR del perfil coincide con el del ticket emitido.
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&margin=8&data=${encodeURIComponent(text)}`;
}

// Helper to determine accurate final price paid with ENTRÁ commissions
function getFinalPriceForTicket(ticketPrice: number): number {
  if (ticketPrice <= 0) return 0;
  const fee = ticketPrice * 0.08;
  const feeConIva = Math.round(fee * 1.21);
  const processorRate = 0.0499;
  return Math.round((ticketPrice + feeConIva) / (1 - processorRate));
}

// ============================================================

interface TicketData {
  id: string;
  orderId: string;
  eventId: string;
  eventTitle: string;
  ticketType: string;
  price: number;
  finalPricePaid?: number;
  status: string;
  qrCode: string;
  createdAt: any;
  buyerName: string;
  buyerEmail: string;
}

interface OrderData {
  id: string;
  eventId: string;
  eventTitle: string;
  items: Array<{ type: string; quantity: number; price: number }>;
  total: number;
  status: string;
  createdAt: any;
}

interface EventCache {
  [key: string]: { date: any; venue: string; location: string; image: string };
}

export default function Profile() {
  const navigate = useNavigate();
  const { user, profile, loading: authLoading, logout, updateUserProfile, changeEmail, changePassword } = useAuth();

  const [activeTab, setActiveTab] = useState<'tickets' | 'orders' | 'account'>('tickets');
  const [tickets, setTickets] = useState<TicketData[]>([]);
  const [orders, setOrders] = useState<OrderData[]>([]);
  const [eventCache, setEventCache] = useState<EventCache>({});
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState<string | null>(null);
  const [expandedTicket, setExpandedTicket] = useState<string | null>(null);
  const [transferringTicket, setTransferringTicket] = useState<any>(null);

  // ==================== ACCOUNT EDIT STATE ====================
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editDni, setEditDni] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileSuccess, setProfileSuccess] = useState('');
  const [profileError, setProfileError] = useState('');

  // ==================== EMAIL CHANGE STATE ====================
  const [newEmail, setNewEmail] = useState('');
  const [emailPassword, setEmailPassword] = useState('');
  const [savingEmail, setSavingEmail] = useState(false);
  const [emailSuccess, setEmailSuccess] = useState('');
  const [emailError, setEmailError] = useState('');

  // ==================== PASSWORD CHANGE STATE ====================
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPass, setShowCurrentPass] = useState(false);
  const [showNewPass, setShowNewPass] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordSuccess, setPasswordSuccess] = useState('');
  const [passwordError, setPasswordError] = useState('');

  // Provider detection
  const isGoogleUser = user?.providerData?.some(p => p.providerId === 'google.com') || false;
  const isEmailUser = user?.providerData?.some(p => p.providerId === 'password') || false;

  // Initialize edit fields when profile loads
  useEffect(() => {
    if (profile) {
      setEditName(profile.displayName || '');
      setEditPhone(profile.phone || '');
      setEditDni(profile.dni || '');
    }
  }, [profile]);

  // Redirect if not logged in
  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth/login');
    }
  }, [authLoading, user, navigate]);

  useEffect(() => {
    if (user) loadUserData();
  }, [user]);

  const loadUserData = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const ticketsQuery = query(
        collection(db, 'tickets'),
        where('buyerEmail', '==', user.email)
      );
      const ticketsSnap = await getDocs(ticketsQuery);
      const ticketsList: TicketData[] = ticketsSnap.docs.map(d => ({ id: d.id, ...d.data() } as TicketData));
      ticketsList.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
      setTickets(ticketsList);

      const ordersQuery = query(
        collection(db, 'orders'),
        where('buyerEmail', '==', user.email)
      );
      const ordersSnap = await getDocs(ordersQuery);
      const ordersList: OrderData[] = ordersSnap.docs.map(d => ({ id: d.id, ...d.data() } as OrderData));
      ordersList.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
      setOrders(ordersList);

      const eventIds = [...new Set([...ticketsList.map(t => t.eventId), ...ordersList.map(o => o.eventId)])];
      const cache: EventCache = {};
      for (const eid of eventIds) {
        try {
          const eventSnap = await getDoc(doc(db, 'events', eid));
          if (eventSnap.exists()) {
            const data = eventSnap.data();
            cache[eid] = {
              date: data.date,
              venue: data.venue || '',
              location: data.location || '',
              image: data.image || '',
            };
          }
        } catch { }
      }
      setEventCache(cache);
    } catch (error) {
      console.error('Error loading user data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(text);
    setTimeout(() => setCopied(null), 2000);
  };

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/');
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const formatDate = (date: any) => {
    try {
      if (date?.toDate) return date.toDate().toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
      if (date?.seconds) return new Date(date.seconds * 1000).toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
    } catch { }
    return '';
  };

  const formatShortDate = (date: any) => {
    try {
      if (date?.toDate) return date.toDate().toLocaleDateString('es-AR', { day: 'numeric', month: 'short' });
      if (date?.seconds) return new Date(date.seconds * 1000).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' });
    } catch { }
    return '';
  };

  const isUpcoming = (eventId: string) => {
    const ev = eventCache[eventId];
    if (!ev?.date) return true;
    try {
      const eventDate = ev.date?.toDate ? ev.date.toDate() : new Date(ev.date.seconds * 1000);
      return eventDate > new Date();
    } catch { return true; }
  };

  // ==================== PROFILE SAVE HANDLER ====================
  const handleSaveProfile = async () => {
    setProfileError('');
    setProfileSuccess('');

    if (!editName.trim()) {
      setProfileError('El nombre es obligatorio.');
      return;
    }

    setSavingProfile(true);
    try {
      await updateUserProfile({
        displayName: editName.trim(),
        phone: editPhone.trim(),
        dni: editDni.trim(),
      });
      setProfileSuccess('Datos actualizados correctamente.');
      setTimeout(() => setProfileSuccess(''), 4000);
    } catch (error: any) {
      setProfileError('Error al guardar los cambios. Intentá de nuevo.');
    } finally {
      setSavingProfile(false);
    }
  };

  // ==================== EMAIL CHANGE HANDLER ====================
  const handleChangeEmail = async () => {
    setEmailError('');
    setEmailSuccess('');

    if (!newEmail.trim()) {
      setEmailError('Ingresá el nuevo email.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)) {
      setEmailError('El formato del email no es válido.');
      return;
    }
    if (newEmail === user?.email) {
      setEmailError('El nuevo email es igual al actual.');
      return;
    }
    if (!emailPassword) {
      setEmailError('Ingresá tu contraseña actual para confirmar.');
      return;
    }

    setSavingEmail(true);
    try {
      await changeEmail(newEmail.trim(), emailPassword);
      setEmailSuccess('Email actualizado. Revisá tu nuevo email para verificarlo.');
      setNewEmail('');
      setEmailPassword('');
      setTimeout(() => setEmailSuccess(''), 6000);
    } catch (error: any) {
      if (error.message === 'GOOGLE_USER') {
        setEmailError('Tu cuenta usa Google. El email está vinculado a tu cuenta de Google y no se puede cambiar desde acá.');
      } else if (error.code === 'auth/wrong-password') {
        setEmailError('La contraseña es incorrecta.');
      } else if (error.code === 'auth/email-already-in-use') {
        setEmailError('Ese email ya está registrado en otra cuenta.');
      } else if (error.code === 'auth/invalid-email') {
        setEmailError('El formato del email no es válido.');
      } else if (error.code === 'auth/requires-recent-login') {
        setEmailError('Tu sesión expiró. Cerrá sesión, volvé a entrar, e intentá de nuevo.');
      } else {
        setEmailError('Error al cambiar el email. Intentá de nuevo.');
      }
    } finally {
      setSavingEmail(false);
    }
  };

  // ==================== PASSWORD CHANGE HANDLER ====================
  const handleChangePassword = async () => {
    setPasswordError('');
    setPasswordSuccess('');

    if (!currentPassword) {
      setPasswordError('Ingresá tu contraseña actual.');
      return;
    }
    if (!newPassword) {
      setPasswordError('Ingresá la nueva contraseña.');
      return;
    }
    if (newPassword.length < 6) {
      setPasswordError('La nueva contraseña debe tener al menos 6 caracteres.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('Las contraseñas no coinciden.');
      return;
    }
    if (currentPassword === newPassword) {
      setPasswordError('La nueva contraseña debe ser diferente a la actual.');
      return;
    }

    setSavingPassword(true);
    try {
      await changePassword(currentPassword, newPassword);
      setPasswordSuccess('Contraseña actualizada correctamente.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => setPasswordSuccess(''), 4000);
    } catch (error: any) {
      if (error.message === 'GOOGLE_USER') {
        setPasswordError('Tu cuenta usa Google. La contraseña se gestiona desde tu cuenta de Google.');
      } else if (error.code === 'auth/wrong-password') {
        setPasswordError('La contraseña actual es incorrecta.');
      } else if (error.code === 'auth/weak-password') {
        setPasswordError('La nueva contraseña es muy débil. Usá al menos 6 caracteres.');
      } else if (error.code === 'auth/requires-recent-login') {
        setPasswordError('Tu sesión expiró. Cerrá sesión, volvé a entrar, e intentá de nuevo.');
      } else {
        setPasswordError('Error al cambiar la contraseña. Intentá de nuevo.');
      }
    } finally {
      setSavingPassword(false);
    }
  };

  const handleDownloadQR = (ticket: TicketData, ev: any) => {
    const eventDateStr = ev ? formatDate(ev.date) : '';
    const orderShort = ticket.orderId.substring(0, 8).toUpperCase();

    const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<title>Entrada ENTRÁ - ${ticket.eventTitle}</title>
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
<div class="ticket">
  <div class="ticket-header">
    <div class="brand">ENTRA by DER</div>
    <h1>${ticket.eventTitle}</h1>
    <div class="ticket-type">${ticket.ticketType}</div>
  </div>
  <div class="ticket-body">
    <div class="qr-section">
      <div class="qr-wrap">
        <img src="${generateQRCodeSVG(ticket.qrCode, 320)}" alt="QR Code" />
      </div>
      <div class="code">${ticket.qrCode}</div>
    </div>
    <div class="info-section">
      <div class="info-row">
        <div class="info-label">Titular</div>
        <div class="info-value">${user?.displayName || user?.email || ''}</div>
      </div>
      <div class="info-row">
        <div class="info-label">Fecha</div>
        <div class="info-value small">${eventDateStr}</div>
      </div>
      <div class="info-row">
        <div class="info-label">Lugar</div>
        <div class="info-value small">${ev?.venue || ''}${ev?.location ? ', ' + ev.location : ''}</div>
      </div>
    </div>
  </div>
  <div class="ticket-footer">
    <span class="status">${ticket.status === 'valid' ? 'VÁLIDO' : ticket.status === 'used' ? 'USADA' : ticket.status === 'cancelled' ? 'CANCELADA' : ticket.status === 'refunded' ? 'DEVUELTA' : '—'}</span>
    <span class="order-badge">Orden #${orderShort}</span>
    <span class="brand-footer">ENTRÁ</span>
  </div>
</div>
<script>
  window.addEventListener('load', function() {
    setTimeout(function() { window.print(); }, 500);
  });
</script>
</body>
</html>`;

    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  };

  // ==================== LOADING / GUARD ====================
  if (authLoading || !user) return null;

  if (loading) {
    return (
      <div className="pt-32 pb-20 px-6 max-w-4xl mx-auto flex flex-col items-center justify-center min-h-[60vh]">
        <Loader2 className="w-10 h-10 text-orange-500 animate-spin mb-4" />
        <p className="text-zinc-400">Cargando tu perfil...</p>
      </div>
    );
  }

  // ==================== RENDER ====================
  return (
    <div className="pt-32 pb-20 px-6 max-w-4xl mx-auto">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-10">
        <div className="flex items-center gap-6">
          <div className="w-20 h-20 rounded-full orange-gradient flex items-center justify-center text-white text-3xl font-black overflow-hidden">
            {user.photoURL ? (
              <img src={user.photoURL} alt="Avatar" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
            ) : (
              user.displayName ? user.displayName.charAt(0).toUpperCase() : user.email?.charAt(0).toUpperCase()
            )}
          </div>
          <div className="flex-grow">
            <h1 className="text-3xl font-black tracking-tight">{profile?.displayName || user.displayName || 'Usuario'}</h1>
            <p className="text-zinc-400 mt-1">{user.email}</p>
            <div className="flex items-center gap-3 mt-3 flex-wrap">
              <span className="text-xs font-bold uppercase tracking-widest text-zinc-500 bg-white/5 px-3 py-1 rounded-full border border-white/10">
                {tickets.length} {tickets.length === 1 ? 'ticket' : 'tickets'}
              </span>
              <span className="text-xs font-bold uppercase tracking-widest text-zinc-500 bg-white/5 px-3 py-1 rounded-full border border-white/10">
                {orders.length} {orders.length === 1 ? 'compra' : 'compras'}
              </span>
              {isGoogleUser && (
                <span className="text-xs font-bold uppercase tracking-widest text-blue-400 bg-blue-500/10 px-3 py-1 rounded-full border border-blue-500/20">
                  Google
                </span>
              )}
              {profile?.role && profile.role !== 'buyer' && (
                <span className="text-xs font-bold uppercase tracking-widest text-orange-400 bg-orange-500/10 px-3 py-1 rounded-full border border-orange-500/20">
                  {profile.role}
                </span>
              )}
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 text-sm text-zinc-400 hover:text-red-400 px-4 py-2 rounded-xl hover:bg-red-500/10 transition-all"
          >
            <LogOut className="w-4 h-4" />
            <span className="hidden sm:inline">Cerrar sesión</span>
          </button>
        </div>
      </motion.div>

      {/* Tabs */}
      <div className="flex gap-2 mb-8 overflow-x-auto pb-1">
        <button
          onClick={() => setActiveTab('tickets')}
          className={`flex items-center gap-2 px-5 py-3 rounded-2xl font-bold text-sm transition-all whitespace-nowrap ${
            activeTab === 'tickets'
              ? 'bg-orange-500 text-white'
              : 'bg-white/5 text-zinc-400 hover:bg-white/10 border border-white/10'
          }`}
        >
          <QrCode className="w-4 h-4" />
          Mis Tickets
        </button>
        <button
          onClick={() => setActiveTab('orders')}
          className={`flex items-center gap-2 px-5 py-3 rounded-2xl font-bold text-sm transition-all whitespace-nowrap ${
            activeTab === 'orders'
              ? 'bg-orange-500 text-white'
              : 'bg-white/5 text-zinc-400 hover:bg-white/10 border border-white/10'
          }`}
        >
          <Ticket className="w-4 h-4" />
          Mis Compras
        </button>
        <button
          onClick={() => setActiveTab('account')}
          className={`flex items-center gap-2 px-5 py-3 rounded-2xl font-bold text-sm transition-all whitespace-nowrap ${
            activeTab === 'account'
              ? 'bg-orange-500 text-white'
              : 'bg-white/5 text-zinc-400 hover:bg-white/10 border border-white/10'
          }`}
        >
          <Settings className="w-4 h-4" />
          Mi Cuenta
        </button>
      </div>

      {/* ==================== TICKETS TAB ==================== */}
      {activeTab === 'tickets' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
          {tickets.length === 0 ? (
            <div className="text-center py-20 space-y-4">
              <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mx-auto">
                <Ticket className="w-10 h-10 text-zinc-600" />
              </div>
              <h3 className="text-xl font-bold text-zinc-400">No tenés tickets todavía</h3>
              <p className="text-zinc-500 text-sm">Cuando compres entradas, van a aparecer acá con su código QR.</p>
              <Link to="/eventos">
                <button className="mt-4 orange-gradient text-white font-heading font-black px-6 py-3 rounded-xl hover:brightness-110 transition-all">
                  Explorar Eventos
                </button>
              </Link>
            </div>
          ) : (
            tickets.map((ticket, index) => {
              const ev = eventCache[ticket.eventId];
              const upcoming = isUpcoming(ticket.eventId);
              const isExpanded = expandedTicket === ticket.id;

              return (
                <motion.div
                  key={ticket.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                >
                  <div className={`bg-white/5 rounded-3xl border border-white/10 overflow-hidden transition-all ${!upcoming ? 'opacity-60' : ''}`}>
                    <button
                      onClick={() => setExpandedTicket(isExpanded ? null : ticket.id)}
                      className="w-full p-5 flex items-center gap-4 text-left hover:bg-white/[0.02] transition-colors"
                    >
                      <div className="w-14 h-14 rounded-2xl overflow-hidden flex-shrink-0 bg-white/5">
                        {ev?.image ? (
                          <img src={ev.image} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center"><Ticket className="w-6 h-6 text-zinc-600" /></div>
                        )}
                      </div>
                      <div className="flex-grow min-w-0">
                        <h3 className="font-bold text-sm truncate">{ticket.eventTitle}</h3>
                        <div className="flex items-center gap-3 mt-1 text-xs text-zinc-400">
                          <span className="font-bold text-orange-500">{ticket.ticketType}</span>
                          {ev?.venue && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{ev.venue}</span>}
                          {ev?.date && <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{formatShortDate(ev.date)}</span>}
                        </div>
                      </div>
                      <div className="flex items-center gap-3 flex-shrink-0">
                        <span className={`text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded-full ${
                          ticket.status === 'valid'
                            ? 'bg-green-500/10 text-green-500'
                            : ticket.status === 'used'
                            ? 'bg-zinc-500/10 text-zinc-500'
                            : 'bg-red-500/10 text-red-500'
                        }`}>
                          {ticket.status === 'valid' ? 'Válido' : ticket.status === 'used' ? 'Usado' : 'Cancelado'}
                        </span>
                        <ChevronRight className={`w-4 h-4 text-zinc-500 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                      </div>
                    </button>

                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        className="border-t border-white/10"
                      >
                        <div className="p-6 flex flex-col sm:flex-row items-center gap-6">
                          <div className="bg-white rounded-2xl p-4 flex-shrink-0 shadow-lg">
                            <img src={generateQRCodeSVG(ticket.qrCode, 160)} alt="QR" className="w-[140px] h-[140px]" />
                          </div>
                          <div className="flex-grow text-center sm:text-left space-y-3">
                            <div>
                              <p className="text-xs uppercase tracking-widest text-zinc-400 font-bold">Código</p>
                              <div className="flex items-center gap-2 justify-center sm:justify-start mt-1">
                                <code className="text-sm font-mono bg-white/5 px-3 py-1.5 rounded-lg border border-white/10">{ticket.qrCode}</code>
                                <button onClick={() => handleCopy(ticket.qrCode)} className="hover:bg-white/10 p-2 rounded-lg transition-colors">
                                  {copied === ticket.qrCode ? <CheckCircle2 className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4 text-zinc-400" />}
                                </button>
                                <button onClick={() => handleDownloadQR(ticket, ev)} className="hover:bg-white/10 p-2 rounded-lg transition-colors" title="Descargar Entrada (PDF)">
                                  <Download className="w-4 h-4 text-zinc-400" />
                                </button>
                                {ticket.status === 'valid' && upcoming && ev?.allowTransfer !== false && (ticket as any).transferStatus !== 'pending' && (
                                  <button
                                    onClick={(e) => { e.stopPropagation(); setTransferringTicket({ ...ticket, eventData: ev }); }}
                                    className="hover:bg-orange-500/10 p-2 rounded-lg transition-colors"
                                    title="Transferir ticket"
                                  >
                                    <Send className="w-4 h-4 text-orange-500" />
                                  </button>
                                )}
                                {(ticket as any).transferStatus === 'pending' && (
                                  <span className="text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded-full bg-yellow-500/10 text-yellow-500 border border-yellow-500/30">
                                    Transferencia pendiente
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <p className="text-xs uppercase tracking-widest text-zinc-500 font-bold">Tipo</p>
                                <p className="font-bold text-orange-500">{ticket.ticketType}</p>
                              </div>
                              <div>
                                <p className="text-xs uppercase tracking-widest text-zinc-500 font-bold">Precio pagado</p>
                                <p className="font-bold text-white">
                                  {formatCurrency(ticket.finalPricePaid || getFinalPriceForTicket(ticket.price || 0))}
                                </p>
                                <p className="text-[10px] text-zinc-500 mt-0.5">Base: {formatCurrency(ticket.price || 0)}</p>
                              </div>
                            </div>
                            {ev?.date && (
                              <div>
                                <p className="text-xs uppercase tracking-widest text-zinc-500 font-bold">Fecha</p>
                                <p className="text-sm">{formatDate(ev.date)}</p>
                              </div>
                            )}
                            {ev?.venue && (
                              <div>
                                <p className="text-xs uppercase tracking-widest text-zinc-500 font-bold">Lugar</p>
                                <p className="text-sm">{ev.venue}{ev.location ? `, ${ev.location}` : ''}</p>
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="border-t border-dashed border-white/10 px-6 py-3 flex justify-between items-center text-xs">
                          <span className="text-zinc-500 flex items-center gap-1.5">
                            <Clock className="w-3.5 h-3.5" />
                            Comprado {formatDate(ticket.createdAt)}
                          </span>
                          <span className={`flex items-center gap-1.5 font-bold ${ticket.status === 'valid' ? 'text-green-500' : 'text-zinc-500'}`}>
                            <ShieldCheck className="w-3.5 h-3.5" />
                            {ticket.status === 'valid' ? 'VÁLIDO' : ticket.status === 'used' ? 'USADO' : 'CANCELADO'}
                          </span>
                        </div>
                      </motion.div>
                    )}
                  </div>
                </motion.div>
              );
            })
          )}
        </motion.div>
      )}

      {/* ==================== ORDERS TAB ==================== */}
      {activeTab === 'orders' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
          {orders.length === 0 ? (
            <div className="text-center py-20 space-y-4">
              <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mx-auto">
                <Ticket className="w-10 h-10 text-zinc-600" />
              </div>
              <h3 className="text-xl font-bold text-zinc-400">No tenés compras todavía</h3>
              <p className="text-zinc-500 text-sm">Tu historial de compras va a aparecer acá.</p>
              <Link to="/eventos">
                <button className="mt-4 orange-gradient text-white font-heading font-black px-6 py-3 rounded-xl hover:brightness-110 transition-all">
                  Explorar Eventos
                </button>
              </Link>
            </div>
          ) : (
            orders.map((order, index) => {
              const ev = eventCache[order.eventId];
              const totalItems = order.items?.reduce((a: number, t: any) => a + (t.quantity || 0), 0) || 0;

              return (
                <motion.div
                  key={order.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                >
                  <div className="bg-white/5 rounded-3xl border border-white/10 p-5">
                    <div className="flex items-center gap-4">
                      <div className="w-14 h-14 rounded-2xl overflow-hidden flex-shrink-0 bg-white/5">
                        {ev?.image ? (
                          <img src={ev.image} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center"><Ticket className="w-6 h-6 text-zinc-600" /></div>
                        )}
                      </div>
                      <div className="flex-grow min-w-0">
                        <h3 className="font-bold text-sm truncate">{order.eventTitle}</h3>
                        <div className="flex items-center gap-3 mt-1 text-xs text-zinc-400">
                          <span>{totalItems} {totalItems === 1 ? 'entrada' : 'entradas'}</span>
                          <span className="text-zinc-600">•</span>
                          <span>{formatShortDate(order.createdAt)}</span>
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-lg font-black text-orange-500">
                          {formatCurrency(order.total || 0)}
                        </p>
                        <span className={`text-[10px] font-bold uppercase tracking-widest ${
                          order.status === 'confirmed' ? 'text-green-500' : 'text-zinc-500'
                        }`}>
                          {estadoOrden(order.status)}
                        </span>
                      </div>
                    </div>

                    {order.items && order.items.length > 0 && (
                      <div className="mt-4 pt-4 border-t border-white/5 space-y-1.5">
                        {order.items.map((item: any, i: number) => (
                          <div key={i} className="flex justify-between text-xs text-zinc-400">
                            <span>{item.quantity}x {item.type} (Costo base c/u: {formatCurrency(item.price || 0)})</span>
                            <span>{formatCurrency((item.quantity || 0) * (item.price || 0))}</span>
                          </div>
                        ))}
                        {(order as any).fee > 0 && (
                          <>
                            <div className="flex justify-between text-[11px] text-zinc-500 pt-1.5 border-t border-white/5">
                              <span>Subtotal entradas</span>
                              <span>{formatCurrency((order as any).subtotal || 0)}</span>
                            </div>
                            <div className="flex justify-between text-[11px] text-zinc-500 font-medium">
                              <span>Cargos de servicio y procesamiento</span>
                              <span>{formatCurrency((order as any).fee || 0)}</span>
                            </div>
                          </>
                        )}
                      </div>
                    )}

                    <div className="mt-4 pt-3 border-t border-white/5 flex justify-between items-center">
                      <span className="text-xs text-zinc-600 font-mono">#{order.id.substring(0, 8).toUpperCase()}</span>
                      <Link to={`/evento/${(order as any).eventId}`}>
                        <button className="text-xs text-orange-500 font-bold hover:underline">Ver evento</button>
                      </Link>
                    </div>
                  </div>
                </motion.div>
              );
            })
          )}
        </motion.div>
      )}

      {/* ==================== MI CUENTA TAB ==================== */}
      {activeTab === 'account' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">

          {/* ────────── SECCIÓN 1: DATOS PERSONALES ────────── */}
          <div className="bg-white/5 rounded-3xl border border-white/10 p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 bg-orange-500/10 rounded-xl flex items-center justify-center">
                <User className="w-5 h-5 text-orange-500" />
              </div>
              <div>
                <h2 className="font-bold text-lg">Datos personales</h2>
                <p className="text-xs text-zinc-500">Tu nombre, teléfono y documento</p>
              </div>
            </div>

            <div className="space-y-4">
              {/* Nombre */}
              <div>
                <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 block mb-1.5">
                  Nombre completo *
                </label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder="Tu nombre completo"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-orange-500/50 transition-colors"
                />
              </div>

              {/* Teléfono */}
              <div>
                <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 block mb-1.5">
                  Teléfono
                </label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                  <input
                    type="tel"
                    value={editPhone}
                    onChange={(e) => setEditPhone(e.target.value)}
                    placeholder="+54 9 11 1234-5678"
                    className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-3 text-sm focus:outline-none focus:border-orange-500/50 transition-colors"
                  />
                </div>
              </div>

              {/* DNI */}
              <div>
                <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 block mb-1.5">
                  DNI / Documento
                </label>
                <div className="relative">
                  <CreditCard className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                  <input
                    type="text"
                    value={editDni}
                    onChange={(e) => setEditDni(e.target.value)}
                    placeholder="12345678"
                    className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-3 text-sm focus:outline-none focus:border-orange-500/50 transition-colors"
                  />
                </div>
              </div>

              {/* Success / Error */}
              <AnimatePresence>
                {profileSuccess && (
                  <motion.div
                    initial={{ opacity: 0, y: -5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="flex items-center gap-2 text-green-400 text-xs font-bold bg-green-500/10 px-4 py-2.5 rounded-xl"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    {profileSuccess}
                  </motion.div>
                )}
                {profileError && (
                  <motion.div
                    initial={{ opacity: 0, y: -5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="flex items-center gap-2 text-red-400 text-xs font-bold bg-red-500/10 px-4 py-2.5 rounded-xl"
                  >
                    <AlertTriangle className="w-4 h-4" />
                    {profileError}
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Save button */}
              <button
                onClick={handleSaveProfile}
                disabled={savingProfile}
                className="w-full orange-gradient text-white font-heading font-black py-3 rounded-xl hover:brightness-110 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {savingProfile ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                {savingProfile ? 'Guardando...' : 'Guardar cambios'}
              </button>
            </div>
          </div>

          {/* ────────── SECCIÓN 2: CAMBIAR EMAIL ────────── */}
          <div className="bg-white/5 rounded-3xl border border-white/10 p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 bg-blue-500/10 rounded-xl flex items-center justify-center">
                <Mail className="w-5 h-5 text-blue-400" />
              </div>
              <div>
                <h2 className="font-bold text-lg">Email</h2>
                <p className="text-xs text-zinc-500">
                  {user.email}
                  {isGoogleUser && ' — vinculado a Google'}
                </p>
              </div>
            </div>

            {isGoogleUser && !isEmailUser ? (
              <div className="flex items-start gap-3 bg-blue-500/5 border border-blue-500/10 rounded-xl p-4">
                <AlertTriangle className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm text-blue-300 font-bold">Cuenta de Google</p>
                  <p className="text-xs text-zinc-400 mt-1">
                    Tu email está vinculado a tu cuenta de Google. Para cambiarlo, tenés que hacerlo desde la configuración de tu cuenta de Google.
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 block mb-1.5">
                    Nuevo email
                  </label>
                  <input
                    type="email"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    placeholder="nuevo@email.com"
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-500/50 transition-colors"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 block mb-1.5">
                    Contraseña actual (para confirmar)
                  </label>
                  <input
                    type="password"
                    value={emailPassword}
                    onChange={(e) => setEmailPassword(e.target.value)}
                    placeholder="Tu contraseña actual"
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-500/50 transition-colors"
                  />
                </div>

                <AnimatePresence>
                  {emailSuccess && (
                    <motion.div
                      initial={{ opacity: 0, y: -5 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      className="flex items-center gap-2 text-green-400 text-xs font-bold bg-green-500/10 px-4 py-2.5 rounded-xl"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      {emailSuccess}
                    </motion.div>
                  )}
                  {emailError && (
                    <motion.div
                      initial={{ opacity: 0, y: -5 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      className="flex items-center gap-2 text-red-400 text-xs font-bold bg-red-500/10 px-4 py-2.5 rounded-xl"
                    >
                      <AlertTriangle className="w-4 h-4" />
                      {emailError}
                    </motion.div>
                  )}
                </AnimatePresence>

                <button
                  onClick={handleChangeEmail}
                  disabled={savingEmail}
                  className="w-full bg-white/5 border border-white/10 text-white font-heading font-black py-3 rounded-xl hover:bg-white/10 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {savingEmail ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Mail className="w-4 h-4" />
                  )}
                  {savingEmail ? 'Cambiando...' : 'Cambiar email'}
                </button>
              </div>
            )}
          </div>

          {/* ────────── SECCIÓN 3: CAMBIAR CONTRASEÑA ────────── */}
          <div className="bg-white/5 rounded-3xl border border-white/10 p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 bg-purple-500/10 rounded-xl flex items-center justify-center">
                <Lock className="w-5 h-5 text-purple-400" />
              </div>
              <div>
                <h2 className="font-bold text-lg">Contraseña</h2>
                <p className="text-xs text-zinc-500">Cambiá tu contraseña de acceso</p>
              </div>
            </div>

            {isGoogleUser && !isEmailUser ? (
              <div className="flex items-start gap-3 bg-purple-500/5 border border-purple-500/10 rounded-xl p-4">
                <AlertTriangle className="w-5 h-5 text-purple-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm text-purple-300 font-bold">Cuenta de Google</p>
                  <p className="text-xs text-zinc-400 mt-1">
                    Tu contraseña se gestiona desde Google. Para cambiarla, andá a la configuración de seguridad de tu cuenta de Google.
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Contraseña actual */}
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 block mb-1.5">
                    Contraseña actual
                  </label>
                  <div className="relative">
                    <input
                      type={showCurrentPass ? 'text' : 'password'}
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      placeholder="Tu contraseña actual"
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 pr-12 text-sm focus:outline-none focus:border-purple-500/50 transition-colors"
                    />
                    <button
                      type="button"
                      onClick={() => setShowCurrentPass(!showCurrentPass)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors"
                    >
                      {showCurrentPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Nueva contraseña */}
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 block mb-1.5">
                    Nueva contraseña
                  </label>
                  <div className="relative">
                    <input
                      type={showNewPass ? 'text' : 'password'}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Mínimo 6 caracteres"
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 pr-12 text-sm focus:outline-none focus:border-purple-500/50 transition-colors"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPass(!showNewPass)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors"
                    >
                      {showNewPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {newPassword && newPassword.length < 6 && (
                    <p className="text-[10px] text-red-400 mt-1">Mínimo 6 caracteres</p>
                  )}
                  {newPassword && newPassword.length >= 6 && (
                    <p className="text-[10px] text-green-400 mt-1">Contraseña válida</p>
                  )}
                </div>

                {/* Confirmar contraseña */}
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 block mb-1.5">
                    Confirmar nueva contraseña
                  </label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Repetí la nueva contraseña"
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-purple-500/50 transition-colors"
                  />
                  {confirmPassword && confirmPassword !== newPassword && (
                    <p className="text-[10px] text-red-400 mt-1">Las contraseñas no coinciden</p>
                  )}
                  {confirmPassword && confirmPassword === newPassword && newPassword.length >= 6 && (
                    <p className="text-[10px] text-green-400 mt-1">Las contraseñas coinciden</p>
                  )}
                </div>

                <AnimatePresence>
                  {passwordSuccess && (
                    <motion.div
                      initial={{ opacity: 0, y: -5 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      className="flex items-center gap-2 text-green-400 text-xs font-bold bg-green-500/10 px-4 py-2.5 rounded-xl"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      {passwordSuccess}
                    </motion.div>
                  )}
                  {passwordError && (
                    <motion.div
                      initial={{ opacity: 0, y: -5 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      className="flex items-center gap-2 text-red-400 text-xs font-bold bg-red-500/10 px-4 py-2.5 rounded-xl"
                    >
                      <AlertTriangle className="w-4 h-4" />
                      {passwordError}
                    </motion.div>
                  )}
                </AnimatePresence>

                <button
                  onClick={handleChangePassword}
                  disabled={savingPassword}
                  className="w-full bg-white/5 border border-white/10 text-white font-heading font-black py-3 rounded-xl hover:bg-white/10 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {savingPassword ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Lock className="w-4 h-4" />
                  )}
                  {savingPassword ? 'Cambiando...' : 'Cambiar contraseña'}
                </button>
              </div>
            )}
          </div>

          {/* ────────── SECCIÓN 4: INFO DE LA CUENTA ────────── */}
          <div className="bg-white/5 rounded-3xl border border-white/10 p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-zinc-500/10 rounded-xl flex items-center justify-center">
                <ShieldCheck className="w-5 h-5 text-zinc-400" />
              </div>
              <div>
                <h2 className="font-bold text-lg">Información de la cuenta</h2>
                <p className="text-xs text-zinc-500">Datos de solo lectura</p>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between py-2 border-b border-white/5">
                <span className="text-xs text-zinc-500 font-bold uppercase tracking-widest">Email</span>
                <span className="text-sm text-zinc-300">{user.email}</span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-white/5">
                <span className="text-xs text-zinc-500 font-bold uppercase tracking-widest">Proveedor</span>
                <span className="text-sm text-zinc-300">
                  {isGoogleUser && isEmailUser
                    ? 'Google + Email'
                    : isGoogleUser
                    ? 'Google'
                    : 'Email y contraseña'}
                </span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-white/5">
                <span className="text-xs text-zinc-500 font-bold uppercase tracking-widest">Rol</span>
                <span className={`text-sm font-bold ${
                  profile?.role === 'superadmin' ? 'text-red-400' :
                  profile?.role === 'admin' ? 'text-orange-400' :
                  profile?.role === 'organizer' ? 'text-blue-400' :
                  'text-zinc-300'
                }`}>
                  {profile?.role === 'superadmin' ? 'Super Admin' :
                   profile?.role === 'admin' ? 'Administrador' :
                   profile?.role === 'organizer' ? 'Organizador' :
                   'Comprador'}
                </span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-white/5">
                <span className="text-xs text-zinc-500 font-bold uppercase tracking-widest">Email verificado</span>
                <span className={`text-sm font-bold ${user.emailVerified ? 'text-green-400' : 'text-yellow-400'}`}>
                  {user.emailVerified ? 'Sí' : 'No'}
                </span>
              </div>
              <div className="flex items-center justify-between py-2">
                <span className="text-xs text-zinc-500 font-bold uppercase tracking-widest">UID</span>
                <span className="text-xs text-zinc-600 font-mono">{user.uid.substring(0, 16)}...</span>
              </div>
            </div>
          </div>

          {/* ────────── SECCIÓN 5: CERRAR SESIÓN ────────── */}
          <button
            onClick={handleLogout}
            className="w-full bg-red-500/10 border border-red-500/20 text-red-400 font-heading font-black py-4 rounded-xl hover:bg-red-500/20 transition-all flex items-center justify-center gap-2"
          >
            <LogOut className="w-5 h-5" />
            Cerrar sesión
          </button>
        </motion.div>
      )}

      {transferringTicket && (
        <TransferTicketModal
          ticket={transferringTicket}
          event={transferringTicket.eventData}
          currentUser={user}
          onClose={() => {
            setTransferringTicket(null);
            if (typeof loadUserData === 'function') loadUserData();
          }}
          onTransferCreated={() => {}}
        />
      )}
    </div>
  );
}
