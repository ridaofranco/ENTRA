import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Button } from '@/src/components/ui/button';
import { Card } from '@/src/components/ui/card';
import { Badge } from '@/src/components/ui/badge';
import { Calendar, MapPin, Clock, Share2, Info, Ticket, ChevronRight, Minus, Plus, AlertTriangle } from 'lucide-react';
import { doc, getDoc, onSnapshot } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '@/src/lib/firebase';
import { formatCurrency } from '@/src/lib/utils';

interface TicketType {
  type: string;
  price: number;
  available: number;
  isEarlyBird?: boolean;
}

interface Event {
  id: string;
  title: string;
  description: string;
  date: any;
  location: string;
  venue: string;
  price: number;
  image: string;
  category: string;
  tickets: TicketType[];
  status?: string;
  officialSaleLaunched?: boolean;
  isDateTBD?: boolean;
  isTimeTBD?: boolean;
  isVenueTBD?: boolean;
}

export default function EventDetail() {
  const { id } = useParams();
  const [event, setEvent] = useState<Event | null>(null);
  const [loading, setLoading] = useState(true);
  const [quantities, setQuantities] = useState<Record<string, number>>({});

  useEffect(() => {
    if (!id) return;
    setLoading(true);

    const unsub = onSnapshot(doc(db, 'events', id), (docSnap) => {
      if (docSnap.exists()) {
        const data = { id: docSnap.id, ...docSnap.data() } as Event;
        setEvent(data);
        
        // Only set initial quantities once when first loaded
        setQuantities(prev => {
          if (Object.keys(prev).length > 0) return prev;
          const initial: Record<string, number> = {};
          data.tickets.forEach((t: TicketType) => {
            initial[t.type] = 0;
          });
          return initial;
        });
      }
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `events/${id}`);
      setLoading(false);
    });

    return () => unsub();
  }, [id]);

  const updateQty = (type: string, delta: number) => {
    setQuantities(prev => ({
      ...prev,
      [type]: Math.max(0, (prev[type] || 0) + delta)
    }));
  };

  const total = event?.tickets.reduce((acc, t) => acc + (quantities[t.type] || 0) * t.price, 0) || 0;
  const totalQty = Object.values(quantities).reduce((acc: number, q) => acc + (q as number), 0);

  // Fee calculation matching Checkout page exactly:
  // 8% + IVA service fee + 4.99% processor rate
  const subtotalVal = total;
  const feeEntra = subtotalVal > 0 ? (subtotalVal * 0.08) : 0;
  const feeEntraConIva = subtotalVal > 0 ? Math.round(feeEntra * 1.21) : 0;
  const processorRate = 0.0499;
  const finalCalculatedTotal = subtotalVal > 0 ? Math.round((subtotalVal + feeEntraConIva) / (1 - processorRate)) : 0;
  const processorFee = subtotalVal > 0 ? Math.max(0, finalCalculatedTotal - subtotalVal - feeEntraConIva) : 0;

  // Check if event is available for purchase
  const isEventActive = !event?.status || event.status === 'active';

  // Check if sold out (all tickets have 0 available)
  const isSoldOut = event?.tickets?.length
    ? event.tickets.every(t => (t.available || 0) <= 0)
    : false;

  if (loading) return <div className="pt-40 text-center">Cargando...</div>;
  if (!event) return <div className="pt-40 text-center">Evento no encontrado</div>;

  // Deleted events: show not found (buyer should not see them at all)
  if (event.status === 'deleted') {
    return (
      <div className="pt-40 text-center max-w-md mx-auto px-6">
        <AlertTriangle className="w-16 h-16 text-muted-foreground mx-auto mb-4 opacity-50" />
        <h2 className="text-2xl font-heading font-black mb-2">Evento no disponible</h2>
        <p className="text-muted-foreground mb-6">Este evento fue eliminado y ya no está disponible.</p>
        <Link to="/eventos">
          <Button variant="outline" className="font-bold border-white/10 hover:border-primary hover:text-primary">
            Ver otros eventos
          </Button>
        </Link>
      </div>
    );
  }

  const eventDate = event.date?.toDate();

  return (
    <div className="pb-20">
      {/* Banner */}
      <div className="relative h-[60vh] overflow-hidden">
        <img 
          src={event.image || undefined} 
          alt={event.title} 
          className="w-full h-full object-cover"
          referrerPolicy="no-referrer"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" />
        <div className="absolute bottom-0 left-0 w-full p-6 md:p-12 max-w-7xl mx-auto right-0">
          <Badge className="orange-gradient border-none font-bold uppercase tracking-widest text-xs px-4 py-1.5 mb-6">
            {event.category}
          </Badge>
          <h1 className="text-4xl md:text-7xl font-heading font-black tracking-tighter mb-6 max-w-4xl">
            {event.title}
          </h1>
          <div className="flex flex-wrap gap-6 text-sm font-bold uppercase tracking-wider">
            <div className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-primary" />
              {event.isDateTBD 
                ? "PROXIMAMENTE" 
                : eventDate?.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
            </div>
            <div className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-primary" />
              {event.isTimeTBD || event.isDateTBD
                ? "PROXIMAMENTE" 
                : `${eventDate?.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}hs`}
            </div>
            <div className="flex items-center gap-2">
              <MapPin className="w-5 h-5 text-primary" />
              {event.isVenueTBD 
                ? "LUGAR POR CONFIRMAR" 
                : `${event.venue}, ${event.location}`}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 lg:grid-cols-3 gap-12 mt-12">
        {/* Left Column: Info */}
        <div className="lg:col-span-2 space-y-12">
          <section>
            <h2 className="text-2xl font-heading font-black mb-6 flex items-center gap-3">
              <Info className="w-6 h-6 text-primary" />
              Sobre el evento
            </h2>
            <p className="text-muted-foreground leading-relaxed text-lg whitespace-pre-line">
              {event.description}
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-heading font-black mb-6 uppercase tracking-tight text-white">
              Ubicación
            </h2>
            <div className="relative glass rounded-3xl h-80 flex items-center justify-center text-muted-foreground overflow-hidden border border-white/5">
              <img 
                src={`https://picsum.photos/seed/${event.venue}/1200/400?blur=5`} 
                alt="Map placeholder" 
                className="w-full h-full object-cover opacity-30"
                referrerPolicy="no-referrer"
              />
              <div className="absolute bg-[#09090b]/90 backdrop-blur-md p-8 rounded-3xl border border-white/10 text-center max-w-sm">
                <p className="font-heading font-black uppercase text-xl text-primary">{event.isVenueTBD ? "LUGAR POR CONFIRMAR" : event.venue}</p>
                <p className="text-sm text-muted-foreground/80 font-sans mt-2">{event.location}</p>
                {!event.isVenueTBD && (
                  <a 
                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(event.venue + ' ' + event.location)}`} 
                    target="_blank" 
                    rel="noopener noreferrer"
                  >
                    <Button variant="link" className="text-primary hover:text-primary/85 font-black text-xs uppercase tracking-wider mt-4">
                      Ver en Google Maps &rarr;
                    </Button>
                  </a>
                )}
              </div>
            </div>
          </section>
        </div>

        {/* Right Column: Tickets */}
        <div className="space-y-6">
          <Card className="glass p-8 rounded-[2.5rem] border-white/10 sticky top-28 shadow-2xl bg-[#09090b]/80 backdrop-blur-xl">
            {!isEventActive ? (
              /* Event is paused — block purchases */
              <div className="text-center py-8">
                <div className="w-16 h-16 rounded-full bg-yellow-500/10 flex items-center justify-center mx-auto mb-4 border border-yellow-500/20">
                  <AlertTriangle className="w-8 h-8 text-yellow-500" />
                </div>
                <h3 className="text-xl font-heading font-black uppercase tracking-tight mb-2">Venta pausada</h3>
                <p className="text-[#a0a0aa] text-sm leading-relaxed mb-6 font-sans">
                  El organizador pausó temporalmente la venta de entradas. Volvé a revisar en un rato.
                </p>
                <Link to="/eventos">
                  <Button variant="outline" className="font-bold text-xs uppercase tracking-wider border-white/10 hover:border-primary hover:text-primary rounded-xl">
                    Ver otros eventos
                  </Button>
                </Link>
              </div>
            ) : isSoldOut ? (
              /* Event is sold out */
              <div className="text-center py-8">
                <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-4 border border-red-500/20">
                  <Ticket className="w-8 h-8 text-red-500" />
                </div>
                <h3 className="text-xl font-heading font-black text-red-500 uppercase tracking-widest mb-2">SOLD OUT</h3>
                <p className="text-[#a0a0aa] text-sm leading-relaxed mb-6 font-sans">
                  Todas las entradas disponibles de todas las tandas fueron vendidas. ¡Nos vemos adentro!
                </p>
                <Link to="/eventos">
                  <Button variant="outline" className="font-bold text-xs uppercase tracking-wider border-white/10 hover:border-primary hover:text-primary rounded-xl">
                    Ver cartelera
                  </Button>
                </Link>
              </div>
            ) : (
              /* Event is active — show ticket selector */
              <>
                <h3 className="text-2xl font-heading font-black uppercase tracking-tight mb-8">
                  ENTRADAS
                </h3>

                <div className="space-y-4 mb-8">
                  {event.tickets.map((t, idx) => {
                    const ticketTypeLower = t.type.toLowerCase();
                    const isPreSaleTicket = t.isEarlyBird || 
                                            ticketTypeLower.includes('preventa') || 
                                            ticketTypeLower.includes('pre venta') || 
                                            ticketTypeLower.includes('pre-venta') || 
                                            ticketTypeLower.includes('early') || 
                                            ticketTypeLower.includes('promo') ||
                                            ticketTypeLower.includes('anticipada') ||
                                            ticketTypeLower.includes('lote');
                    
                    const hasAnyPreSale = event.tickets.some(tick => {
                      const ttLower = tick.type.toLowerCase();
                      return tick.isEarlyBird || 
                             ttLower.includes('preventa') || 
                             ttLower.includes('pre venta') || 
                             ttLower.includes('pre-venta') || 
                             ttLower.includes('early') || 
                             ttLower.includes('promo') ||
                             ttLower.includes('anticipada') ||
                             ttLower.includes('lote');
                    });

                    const isVisible = event.officialSaleLaunched 
                      ? !isPreSaleTicket 
                      : (isPreSaleTicket || !hasAnyPreSale);

                    const isTicketSoldOut = (t.available || 0) <= 0;
                    
                    let statusLabel = "ACCESO ABIERTO";
                    let statusClasses = "text-primary border-primary/20 bg-primary/5";
                    
                    if (isTicketSoldOut) {
                      statusLabel = "AGOTADO";
                      statusClasses = "text-red-400 border-red-500/20 bg-red-950/10";
                    } else if (isPreSaleTicket && event.officialSaleLaunched) {
                      statusLabel = "FINALIZADO";
                      statusClasses = "text-zinc-500 border-white/5 bg-white/[0.02]";
                    } else if (!isVisible) {
                      statusLabel = "PRÓXIMA TANDA";
                      statusClasses = "text-zinc-400 border-white/10 bg-white/5";
                    } else if (t.available < 10) {
                      statusLabel = "ÚLTIMOS ACCESOS";
                      statusClasses = "text-orange-400 border-orange-500/20 bg-orange-950/10";
                    }

                    return (
                      <div 
                        key={idx} 
                        className={`p-5 rounded-2xl border ${isTicketSoldOut ? 'border-white/5 opacity-50 bg-white/[0.01]' : 'border-white/10 bg-white/[0.02] hover:border-primary/20'} transition-all`}
                      >
                        <div className="flex justify-between items-start gap-4">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-heading font-black text-lg text-white uppercase tracking-tight">
                                {t.type}
                              </span>
                              {t.isEarlyBird && (
                                <span className="text-[8px] font-sans font-extrabold tracking-widest bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded">
                                  EARLY BIRD
                                </span>
                              )}
                            </div>
                            
                            <span className="text-[9px] font-sans font-bold tracking-widest px-2.5 py-0.5 rounded-full border inline-block uppercase mt-1.5 transform scale-90 origin-left leading-none">
                              <span className={statusClasses}>{statusLabel}</span>
                            </span>

                            <div className="text-primary font-heading font-black text-2xl pt-2">
                              {formatCurrency(Number(t.price) || 0)}
                            </div>
                          </div>

                          <div className="flex items-center gap-3 bg-black/40 rounded-xl p-1.5 border border-white/5 self-end mt-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              disabled={!isVisible || isTicketSoldOut}
                              className="w-8 h-8 rounded-lg hover:bg-primary/20 hover:text-primary disabled:opacity-35"
                              onClick={() => updateQty(t.type, -1)}
                            >
                              <Minus className="w-3.5 h-3.5" />
                            </Button>
                            <span className="font-heading font-black text-base min-w-[20px] text-center text-white">
                              {quantities[t.type] || 0}
                            </span>
                            <Button
                              variant="ghost"
                              size="icon"
                              disabled={!isVisible || isTicketSoldOut || (quantities[t.type] || 0) >= Math.min(t.available, 4)}
                              className="w-8 h-8 rounded-lg hover:bg-primary/20 hover:text-primary disabled:opacity-35"
                              onClick={() => updateQty(t.type, 1)}
                            >
                              <Plus className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="pt-6 border-t border-white/10 space-y-4">
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground/80 font-medium font-sans">Subtotal</span>
                      <span className="font-bold text-white font-sans">{formatCurrency(subtotalVal)}</span>
                    </div>
                    {subtotalVal > 0 && (
                      <div className="space-y-1.5 border-t border-white/5 pt-2">
                        <div className="flex justify-between text-xs text-muted-foreground/75 font-sans">
                          <span>Cargo de Servicio (8% + IVA)</span>
                          <span>{formatCurrency(feeEntraConIva)}</span>
                        </div>
                        <div className="flex justify-between text-xs text-muted-foreground/75 font-sans">
                          <span>Costo Procesador (4.99%)</span>
                          <span>{formatCurrency(processorFee)}</span>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="border-t border-white/5 pt-3 flex justify-between items-end">
                    <div>
                      <div className="text-[10px] uppercase tracking-[0.2em] text-[#a0a0aa] font-bold font-sans">
                        Total Final ({totalQty} {totalQty === 1 ? 'entrada' : 'entradas'})
                      </div>
                      <div className="text-3xl font-heading font-black orange-text-gradient mt-1">
                        {formatCurrency(finalCalculatedTotal)}
                      </div>
                    </div>
                    <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-primary rounded-xl">
                      <Share2 className="w-5 h-5" />
                    </Button>
                  </div>

                  <Link
                    to="/checkout"
                    state={{
                      event: {
                        id: event.id,
                        title: event.title,
                        venue: event.venue,
                        location: event.location,
                        image: event.image,
                        date: event.date
                      },
                      selectedTickets: event.tickets
                        .filter(t => (quantities[t.type] || 0) > 0)
                        .map(t => ({
                          type: t.type,
                          price: t.price,
                          quantity: quantities[t.type]
                        }))
                    }}
                    className={totalQty === 0 ? "pointer-events-none" : ""}
                  >
                    <Button
                      disabled={totalQty === 0}
                      className="w-full h-16 orange-gradient border-none font-heading font-black text-2xl uppercase tracking-wider rounded-xl disabled:opacity-50 disabled:grayscale"
                    >
                      ENTRÁ
                      <ChevronRight className="ml-2 w-6 h-6" />
                    </Button>
                  </Link>
                  <p className="text-[10px] text-center text-muted-foreground uppercase tracking-widest font-bold">
                    Compra segura · Sin registro obligatorio · nos vemos adentro
                  </p>
                </div>
              </>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}

