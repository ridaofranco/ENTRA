import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useLocation, useNavigate } from 'react-router-dom';
import { Button } from '@/src/components/ui/button';
import { Card } from '@/src/components/ui/card';
import { Input } from '@/src/components/ui/input';
import { Badge } from '@/src/components/ui/badge';
import { CreditCard, Wallet, Landmark, Smartphone, CheckCircle2, ArrowLeft, ShieldCheck, Ticket as TicketIcon, Calendar, MapPin } from 'lucide-react';
import { Link } from 'react-router-dom';
import { collection, addDoc, Timestamp } from 'firebase/firestore';
import { db, auth, handleFirestoreError, OperationType } from '@/src/lib/firebase';
import { cn } from '@/lib/utils';
import { useAuth } from '@/src/context/AuthContext';

export default function Checkout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { event, selectedTickets } = location.state || { 
    event: { id: 'demo', title: 'Evento Demo', venue: 'Estadio Obras', location: 'CABA', image: 'https://images.unsplash.com/photo-1501386761578-eac5c94b800a?auto=format&fit=crop&q=80&w=1000' },
    selectedTickets: [{ type: 'General', price: 8500, quantity: 1 }]
  };

  const [step, setStep] = useState(1);
  const [paymentMethod, setPaymentMethod] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [guestInfo, setGuestInfo] = useState({ name: '', email: '', dni: '' });
  const { user } = useAuth();

  const methods = [
    { id: 'mp', name: 'Mercado Pago', icon: Smartphone, desc: 'Paga con tu saldo o tarjetas guardadas' },
    { id: 'card', name: 'Tarjeta de Crédito/Débito', icon: CreditCard, desc: 'Visa, Mastercard, Amex, Cabal' },
    { id: 'transf', name: 'Transferencia Bancaria', icon: Landmark, desc: 'CBU/CVU - Acreditación inmediata' },
    { id: 'crypto', name: 'Criptomonedas', icon: Wallet, desc: 'BTC, ETH, USDT (vía Binance Pay)' },
  ];

  const subtotal = selectedTickets.reduce((acc: number, t: any) => acc + (t.price * t.quantity), 0);
  const serviceFee = Math.round(subtotal * 0.1);
  const total = subtotal + serviceFee;

  const handlePayment = async () => {
    setIsProcessing(true);
    try {
      // Create a ticket for each selected ticket type and quantity
      for (const ticket of selectedTickets) {
        for (let i = 0; i < ticket.quantity; i++) {
          const ticketData = {
            eventId: event.id,
            buyerId: user?.uid || 'guest',
            buyerName: user?.displayName || guestInfo.name,
            buyerEmail: user?.email || guestInfo.email,
            buyerDni: guestInfo.dni,
            type: ticket.type,
            price: ticket.price,
            qrCode: `ENTRA-${Math.random().toString(36).substring(2, 11).toUpperCase()}`,
            status: 'valid',
            purchasedAt: Timestamp.now()
          };
          
          await addDoc(collection(db, 'tickets'), ticketData);
        }
      }
      setStep(3);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'tickets');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="pt-32 pb-20 px-6 max-w-5xl mx-auto">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
        {/* Left: Form */}
        <div className="lg:col-span-2 space-y-8">
          <div className="flex items-center gap-4 mb-8">
            <Link to="/eventos">
              <Button variant="ghost" size="icon" className="rounded-full hover:bg-primary/10 hover:text-primary">
                <ArrowLeft className="w-6 h-6" />
              </Button>
            </Link>
            <h1 className="text-3xl font-heading font-black tracking-tighter uppercase">Finalizar Compra</h1>
          </div>

          {/* Progress */}
          <div className="flex items-center gap-4 mb-12">
            {[1, 2, 3].map(i => (
              <div key={i} className="flex items-center gap-2">
                <div className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm transition-colors",
                  step >= i ? "bg-primary text-white" : "bg-white/5 text-muted-foreground border border-white/10"
                )}>
                  {i}
                </div>
                {i < 3 && <div className={cn("w-12 h-0.5 rounded-full", step > i ? "bg-primary" : "bg-white/5")} />}
              </div>
            ))}
          </div>

          {step === 1 && (
            <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="space-y-6">
              <div className="flex justify-between items-end mb-6">
                <h2 className="text-xl font-heading font-bold">Tus Datos</h2>
                {!user && (
                  <Button variant="link" onClick={() => window.location.href='/auth/login'} className="text-primary p-0 h-auto font-bold">
                    ¿Ya tenés cuenta? Iniciá sesión
                  </Button>
                )}
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Nombre Completo</label>
                  <Input 
                    value={user?.displayName || guestInfo.name} 
                    onChange={e => setGuestInfo({...guestInfo, name: e.target.value})}
                    placeholder="Como figura en tu DNI"
                    className="bg-white/5 border-white/10 h-12 rounded-xl" 
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">DNI</label>
                  <Input 
                    value={guestInfo.dni}
                    onChange={e => setGuestInfo({...guestInfo, dni: e.target.value})}
                    placeholder="Sin puntos" 
                    className="bg-white/5 border-white/10 h-12 rounded-xl" 
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Email</label>
                  <Input 
                    value={user?.email || guestInfo.email} 
                    onChange={e => setGuestInfo({...guestInfo, email: e.target.value})}
                    type="email" 
                    placeholder="Donde recibirás tus entradas"
                    className="bg-white/5 border-white/10 h-12 rounded-xl" 
                  />
                </div>
              </div>
              
              <Button 
                disabled={! (user || (guestInfo.name && guestInfo.email && guestInfo.dni))} 
                onClick={() => setStep(2)} 
                className="w-full h-14 orange-gradient border-none font-bold text-lg rounded-xl mt-8"
              >
                Siguiente: Método de Pago
              </Button>
            </motion.div>
          )}

          {step === 2 && (
            <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="space-y-6">
              <h2 className="text-xl font-heading font-bold mb-6">Método de Pago</h2>
              <div className="grid grid-cols-1 gap-4">
                {methods.map(m => (
                  <button
                    key={m.id}
                    onClick={() => setPaymentMethod(m.id)}
                    className={cn(
                      "flex items-center gap-4 p-6 rounded-2xl border transition-all text-left group",
                      paymentMethod === m.id ? "bg-primary/10 border-primary" : "bg-white/5 border-white/5 hover:border-white/20"
                    )}
                  >
                    <div className={cn(
                      "w-12 h-12 rounded-xl flex items-center justify-center transition-colors",
                      paymentMethod === m.id ? "bg-primary text-white" : "bg-white/10 text-muted-foreground group-hover:text-primary"
                    )}>
                      <m.icon className="w-6 h-6" />
                    </div>
                    <div>
                      <div className="font-bold">{m.name}</div>
                      <div className="text-xs text-muted-foreground">{m.desc}</div>
                    </div>
                    {paymentMethod === m.id && <CheckCircle2 className="ml-auto w-6 h-6 text-primary" />}
                  </button>
                ))}
              </div>

              {paymentMethod === 'mp' && (
                <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-2xl text-xs text-blue-400">
                  <strong>Nota:</strong> Para activar Mercado Pago real, cargá tu <code>MP_ACCESS_TOKEN</code> en los Secrets del proyecto.
                </div>
              )}

              <div className="flex gap-4 mt-8">
                <Button variant="ghost" onClick={() => setStep(1)} className="h-14 px-8 font-bold">Volver</Button>
                <Button 
                  disabled={!paymentMethod || isProcessing}
                  onClick={handlePayment} 
                  className="flex-grow h-14 orange-gradient border-none font-bold text-lg rounded-xl"
                >
                  {isProcessing ? "Procesando..." : "Confirmar y Pagar"}
                </Button>
              </div>
            </motion.div>
          )}

          {step === 3 && (
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="text-center py-12 space-y-6">
              <div className="w-24 h-24 bg-green-500/20 text-green-500 rounded-full flex items-center justify-center mx-auto mb-8">
                <CheckCircle2 className="w-12 h-12" />
              </div>
              <h2 className="text-4xl font-heading font-black tracking-tighter">¡Compra Exitosa!</h2>
              <p className="text-muted-foreground text-lg max-w-md mx-auto">
                Tus entradas han sido enviadas a <span className="text-foreground font-bold">{user?.email || guestInfo.email}</span>
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center pt-8">
                <Button className="orange-gradient border-none font-bold h-12 px-8 rounded-xl">Descargar Entradas (PDF)</Button>
                <Link to="/eventos">
                  <Button variant="outline" className="h-12 px-8 rounded-xl border-white/10">Volver al Inicio</Button>
                </Link>
              </div>
            </motion.div>
          )}
        </div>

        {/* Right: Summary */}
        <div className="space-y-6">
          <Card className="glass p-8 rounded-[2.5rem] border-white/10 sticky top-28">
            <h3 className="text-xl font-heading font-bold mb-6 flex items-center gap-2">
              <TicketIcon className="w-5 h-5 text-primary" />
              Resumen
            </h3>
            
            <div className="space-y-4 mb-8">
              {selectedTickets.map((t: any, i: number) => (
                <div key={i} className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{t.quantity}x {t.type}</span>
                  <span className="font-bold">${(t.price * t.quantity).toLocaleString('es-AR')}</span>
                </div>
              ))}
              <div className="flex justify-between text-sm pt-4 border-t border-white/5">
                <span className="text-muted-foreground">Subtotal</span>
                <span className="font-bold">${subtotal.toLocaleString('es-AR')}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Cargo por servicio (10%)</span>
                <span className="font-bold">${serviceFee.toLocaleString('es-AR')}</span>
              </div>
              <div className="pt-4 border-t border-white/5 flex justify-between items-end">
                <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Total</span>
                <span className="text-3xl font-heading font-black text-primary">${total.toLocaleString('es-AR')}</span>
              </div>
            </div>

            <div className="bg-primary/5 rounded-2xl p-4 border border-primary/10 flex items-start gap-3">
              <ShieldCheck className="w-5 h-5 text-primary mt-0.5" />
              <div className="text-[10px] text-muted-foreground leading-relaxed uppercase tracking-wider font-bold">
                Tu compra está protegida por el sistema de seguridad de ENTRÁ by DER.
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
