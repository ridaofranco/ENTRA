import { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ChevronDown, Mail, ShieldCheck, Ticket, Sparkles, HelpCircle } from 'lucide-react';
import { WhatsAppIcon } from '@/src/components/icons/WhatsAppIcon';

const whatsappNumber = '5491171540675';
const whatsappUrl = `https://wa.me/${whatsappNumber}?text=Hola!%20Necesito%20ayuda%20con%20una%20entrada%20de%20ENTRÁ`;

const faqs = [
  {
    q: '¿Cómo entro a mi evento?',
    a: 'Con el QR de tu entrada, que mostrás desde el celular. Lo tenés en tres lugares: en el mail de confirmación (el QR viene dentro del mensaje y además hay un PDF adjunto con todas las entradas de la compra), en la pantalla de confirmación apenas terminás de comprar, y en "Mis Tickets" dentro de tu perfil. En la puerta se escanea una sola vez: si el mismo código se intenta usar de nuevo, el sistema lo rechaza.'
  },
  {
    q: 'No me llegó la entrada, ¿qué hago?',
    a: 'La entrada se emite cuando el pago queda aprobado: si Mercado Pago lo dejó pendiente de acreditación, el mail sale solo cuando se acredita. Si el pago ya está aprobado, buscá en tu correo por el nombre del evento o por la palabra ENTRÁ (revisá Spam y, si usás Gmail, la pestaña Promociones). Si aun así no aparece, entrá a tu perfil: la entrada está ahí igual, mirá la pregunta de abajo. Y si escribiste mal tu mail al comprar, escribinos por WhatsApp con tu nombre, tu DNI y el número de orden que quedó en la pantalla de confirmación: esa corrección la hacemos nosotros a mano.'
  },
  {
    q: 'Compré como invitado, sin crear cuenta. ¿Dónde veo mi entrada?',
    a: 'Entrá con el MISMO mail que pusiste al comprar. En ENTRÁ las entradas se buscan por correo electrónico, no por cuenta: creás la cuenta (o iniciás sesión) con ese mail exacto y tus entradas aparecen solas en "Mis Tickets", con el QR para mostrar en la puerta y el botón para descargarlas. No hay trámite ni hay que esperar a que alguien te las asigne.'
  },
  {
    q: '¿Puedo transferir mi entrada a otra persona?',
    a: 'Sí, de forma oficial desde "Mis Tickets" en tu perfil. Cargás el nombre, el mail y el teléfono de la persona, y el sistema genera un link de reclamo: le llega por mail y además podés pasárselo vos por WhatsApp. Cuando esa persona lo reclama iniciando sesión con ESE mail, tu código queda invalidado y se genera un QR nuevo a su nombre. Tres cosas a tener en cuenta: solo ese mail puede reclamarlo, no se puede transferir si el evento ya pasó, y el organizador puede tener las transferencias deshabilitadas en su evento.'
  },
  {
    q: '¿Cómo pago y qué me cobran?',
    a: 'El pago lo procesa Mercado Pago, con los medios que tengas habilitados en tu cuenta al momento de pagar. Sobre el precio de la entrada se suma un cargo por servicio, que incluye el servicio de ENTRÁ y el procesamiento del pago. Ese cargo se muestra en el detalle del checkout antes de que confirmes: el total que ves ahí es el que se cobra, no se agrega nada después. En los eventos gratuitos la reserva no tiene ningún cargo.'
  },
  {
    q: 'Se canceló o se reprogramó el evento, ¿qué pasa con mi entrada?',
    a: 'Cuando un evento se cancela en la plataforma, sale un mail de aviso a todos los que compraron. La política de reintegro la define el organizador, que es el responsable del evento: si pagaste tu entrada, escribinos por WhatsApp y gestionamos la devolución con él. Si en cambio el evento se reprograma, tu entrada sigue siendo válida para la fecha nueva; si no podés ir, la podés transferir.'
  },
  {
    q: 'Soy organizador, ¿cómo publico un evento?',
    a: 'Creás tu cuenta en ENTRÁ y nos escribís a organizadores@entratickets.com o por WhatsApp. El panel de productor no se activa solo: lo habilita el equipo a mano, para saber quién vende y qué se vende. Una vez habilitado cargás el evento (fecha, lugar, flyer, tipos de entrada y cupo), lo publicás cuando querés con el botón de venta oficial, y desde el panel seguís las ventas, generás cortesías y códigos de descuento, y controlás la puerta con el escáner de QR.'
  }
];

export default function Ayuda() {
  const [openIdx, setOpenIdx] = useState<number | null>(null);

  return (
    <div className="pb-24 pt-32 bg-[#09090b] text-foreground min-h-screen relative overflow-hidden">
      {/* Background visual support */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/10 via-transparent to-transparent opacity-60 pointer-events-none z-0" />

      <div className="max-w-4xl mx-auto px-6 relative z-10">
        
        {/* Hero Section */}
        <div className="text-center mb-20">
          <span className="block text-[10px] font-sans font-bold tracking-[0.3em] uppercase text-primary">
            SOPORTE OFICIAL · ENTRÁ
          </span>
          <h1 className="text-5xl sm:text-6xl md:text-7xl lg:text-[5.5rem] font-heading font-black tracking-tighter uppercase mt-6" style={{ lineHeight: '1.05' }}>
            Resolución <span className="orange-text-gradient">al toque.</span>
          </h1>
          <p className="text-lg text-muted-foreground/80 font-sans max-w-xl mx-auto leading-relaxed mt-8">
            Sin bots automáticos que repiten lo mismo sin entender nada. Detrás de ENTRÁ hay personas reales listas para resolver tus consultas sobre accesos.
          </p>
          <div className="mt-10 flex flex-col sm:flex-row gap-3 justify-center">
            <a href={whatsappUrl} target="_blank" rel="noopener noreferrer" className="w-full sm:w-auto">
              <Button className="w-full sm:w-auto h-14 px-8 orange-gradient border-none text-white font-heading font-black text-xs uppercase tracking-wide rounded-xl transition-all hover:brightness-110 flex items-center justify-center gap-2.5">
                <WhatsAppIcon className="w-4 h-4" />
                WhatsApp Directo
              </Button>
            </a>
            <a href="mailto:soporte@entratickets.com" className="w-full sm:w-auto">
              <Button variant="outline" className="w-full sm:w-auto h-14 px-8 bg-white/[0.03] border border-white/10 hover:border-white/20 hover:bg-white/[0.06] text-white font-heading font-black text-xs uppercase tracking-wide rounded-xl transition-all flex items-center justify-center gap-2.5">
                <Mail className="w-4 h-4 text-primary" />
                Soporte por Mail
              </Button>
            </a>
          </div>
        </div>

        {/* Benefits banner */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-20">
          {[
            {
              icon: <ShieldCheck className="w-5 h-5 text-primary" />,
              title: "Precio final a la vista",
              desc: "El cargo por servicio se muestra en el checkout antes de que pagues. Después no se suma nada."
            },
            {
              icon: <Ticket className="w-5 h-5 text-primary" />,
              title: "QR único por entrada",
              desc: "En la puerta se escanea una sola vez. Si el mismo código vuelve a pasar, el escáner lo rechaza."
            },
            {
              icon: <Sparkles className="w-5 h-5 text-primary" />,
              title: "Transferencia oficial",
              desc: "Se la pasás por mail y solo esa persona la puede reclamar. Al reclamarla, tu QR viejo queda invalidado."
            }
          ].map((item, i) => (
            <Card key={i} className="border border-white/5 bg-white/[0.01] rounded-3xl p-6 space-y-3">
              <div className="w-10 h-10 rounded-xl bg-primary/5 flex items-center justify-center border border-primary/10">
                {item.icon}
              </div>
              <h4 className="font-heading font-black text-sm uppercase text-white tracking-wider">{item.title}</h4>
              <p className="text-xs text-muted-foreground/85 leading-relaxed font-sans">{item.desc}</p>
            </Card>
          ))}
        </div>

        {/* FAQs */}
        <div className="space-y-6 max-w-3xl mx-auto">
          <div className="text-center space-y-2 mb-10">
            <HelpCircle className="w-6 h-6 text-primary mx-auto mb-2 opacity-50" />
            <h2 className="text-xl sm:text-2xl font-heading font-black text-white uppercase tracking-tight">
              Preguntas Frecuentes
            </h2>
            <p className="text-xs text-muted-foreground uppercase tracking-widest font-sans font-bold">
              Las consultas más usuales respondidas claro
            </p>
          </div>

          <div className="space-y-3">
            {faqs.map((faq, idx) => {
              const isOpen = openIdx === idx;
              return (
                <div key={idx} className="group">
                  <Card className={`rounded-[1.5rem] overflow-hidden border transition-all ${isOpen ? 'border-[#ff5c00]/30 bg-white/[0.02]' : 'border-white/5 bg-white/[0.01] hover:border-white/10'}`}>
                    <button
                      onClick={() => setOpenIdx(isOpen ? null : idx)}
                      className="w-full text-left p-6 flex justify-between items-center gap-4 hover:bg-white/[0.01] transition-colors focus:outline-none"
                    >
                      <span className="font-heading font-black text-sm sm:text-base uppercase tracking-tight text-white">{faq.q}</span>
                      <ChevronDown className={`w-5 h-5 text-primary transition-transform flex-shrink-0 duration-300 ${isOpen ? 'rotate-180' : ''}`} />
                    </button>
                    
                    <AnimatePresence initial={false}>
                      {isOpen && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.2, ease: 'easeInOut' }}
                        >
                          <div className="px-6 pb-6 pt-1 border-t border-white/5 text-muted-foreground/90 leading-relaxed font-sans text-xs sm:text-sm">
                            <p>{faq.a}</p>
                            {faq.q.includes('organizador') && (
                              <div className="mt-4">
                                <Link to="/productores" className="text-primary hover:underline font-heading font-black text-xs uppercase tracking-wider inline-flex items-center gap-1.5">
                                  Sección Productores &rarr;
                                </Link>
                              </div>
                            )}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </Card>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer CTA */}
        <div className="max-w-2xl mx-auto text-center mt-20 p-8 border border-white/5 bg-white/[0.01] rounded-[2rem] space-y-4">
          <p className="text-xs font-sans tracking-[0.2em] font-extrabold uppercase text-primary">¿No encontraste lo que buscabas?</p>
          <p className="text-xs text-muted-foreground leading-relaxed font-sans max-w-md mx-auto">
            Escribinos con el mail que usaste para comprar, tu DNI y el número de orden: con esos tres datos encontramos tu compra y te decimos cómo seguir. Te esperamos adentro.
          </p>
          <p className="text-xs text-muted-foreground/70 leading-relaxed font-sans max-w-md mx-auto">
            También tenemos guías más largas en{' '}
            <a href="/blog" className="text-primary hover:underline font-bold">el blog de ENTRÁ</a>: cómo funciona el QR,
            qué hacer si no te llegó la entrada y qué necesitás en la puerta el día del evento.
          </p>
          <div className="pt-2">
            <a href={whatsappUrl} target="_blank" rel="noopener noreferrer">
              <Button size="sm" variant="outline" className="h-11 px-6 bg-white/[0.03] border border-white/10 text-white hover:bg-white/[0.06] hover:border-white/20 text-xs font-heading font-black uppercase tracking-wide rounded-xl transition-all">
                Contactar a soporte en directo
              </Button>
            </a>
          </div>
        </div>

      </div>
    </div>
  );
}
